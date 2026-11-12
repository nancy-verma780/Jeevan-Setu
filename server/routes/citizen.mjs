import { config } from "../lib/config.mjs";
import { freshness } from "../lib/freshness.mjs";
import { conflict, HttpError, invalid, notFound, readMultipartFile, readBody } from "../lib/http.mjs";
import { ACTIVE_STATUSES, cancelRequest, recordEvent, reliabilityFor, startAllocation } from "../lib/allocation.mjs";
import { analyzer } from "../lib/analyzer.mjs";
import { checkQuality, decodeImage, heatmapKeyFor, imageOut, RETAKE_MESSAGES, saveJpeg } from "../lib/images.mjs";
import { evaluatePriority, SYMPTOM_FIELDS } from "../lib/priority.mjs";
import { REQUIRED_SERVICES, rank } from "../lib/ranking.mjs";
import { currentParams } from "../lib/settings.mjs";
import { intParam } from "../lib/router.mjs";
import { normaliseIndianMobile } from "../lib/security.mjs";

const INJURIES = Object.keys(REQUIRED_SERVICES);
const SOURCES = ["gps", "map_pin", "manual"];
const SEXES = ["female", "male", "other", "unknown"];
const BLOOD = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

function validSymptoms(raw = {}) {
  if (typeof raw !== "object" || raw === null) throw invalid("Symptoms must be an object.");
  for (const [key, value] of Object.entries(raw)) {
    if (!SYMPTOM_FIELDS.includes(key)) throw invalid(`Unknown symptom field: ${key}.`);
    if (!["yes", "no", "unknown"].includes(value)) throw invalid("Each answer must be yes, no or unknown.");
  }
  // Every missing answer becomes "unknown". It is never read as "no".
  return Object.fromEntries(SYMPTOM_FIELDS.map((f) => [f, raw[f] ?? "unknown"]));
}

function validLocation(raw) {
  const lat = Number(raw?.lat);
  const lng = Number(raw?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || !SOURCES.includes(raw?.source)) {
    throw invalid("Choose a valid location.");
  }
  return { lat, lng, source: raw.source };
}

function validAge(raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 120) throw invalid("Age must be between 0 and 120.");
  return n;
}

export function ownRequest(store, user, id) {
  const request = store.get("requests", intParam(id));
  if (!request || request.reporter_id !== user.id) throw notFound("Request not found.");
  return request;
}

const latestAssignment = (store, requestId) => store.filter("assignments", (a) => a.request_id === requestId).at(-1) ?? null;

function currentHospital(store, a) {
  if (!a || !["PENDING", "ACCEPTED"].includes(a.status)) return null;
  const h = store.get("hospitals", a.hospital_id);
  const accepted = a.status === "ACCEPTED";
  return {
    assignment_id: a.id,
    status: a.status,
    hospital_id: h.id,
    name: h.name,
    services: h.services,
    free_beds: h.free_beds,
    beds_updated_at: h.beds_updated_at,
    freshness: freshness(h.beds_updated_at),
    is_simulated: h.is_simulated,
    deadline_at: a.deadline_at,
    seconds_left: accepted ? 0 : Math.max(0, Math.floor((Date.parse(a.deadline_at) - Date.now()) / 1000)),
    terms: {
      distance_km: a.distance_km,
      distance_term: a.distance_term,
      resource_term: a.resource_term,
      reliability: a.reliability,
      reliability_term: a.reliability_term,
      score: a.score,
      availability_flag: a.availability_flag,
    },
    // Contact details are shown only after the hospital accepts.
    address: accepted ? h.address : null,
    phone: accepted ? h.phone : null,
  };
}

export function detailOut(store, r) {
  return {
    id: r.id,
    public_code: r.public_code,
    injury_type: r.injury_type,
    priority: r.priority,
    priority_reasons: r.priority_reasons,
    rule_set_version: r.rule_set_version,
    status: r.status,
    created_at: r.created_at,
    lat: r.lat,
    lng: r.lng,
    location_source: r.location_source,
    sensitive: Boolean(r.sensitive),
    passport_shared: Boolean(r.passport),
    feedback: store.find("feedback", (f) => f.request_id === r.id),
    current_hospital: currentHospital(store, latestAssignment(store, r.id)),
    events: store.filter("events", (e) => e.request_id === r.id).map(({ id, type, data, created_at }) => ({ id, type, data, created_at })),
  };
}

export function registerCitizen(router, store) {
  router.post(
    "/api/emergencies",
    async (ctx) => {
      const user = ctx.user();
      const key = ctx.req.headers["idempotency-key"];
      if (!key || !/^[A-Za-z0-9_-]{8,100}$/.test(key)) throw invalid("Missing or invalid Idempotency-Key header.");
      const body = await ctx.json();
      if (!body.consent?.accepted) throw invalid("Consent is required before a request can be sent.");
      if (body.consent.policy_version !== config.consentPolicyVersion) throw invalid("The consent text has changed. Read and accept the current version.");

      const existing = store.find("requests", (r) => r.reporter_id === user.id && r.idempotency_key === key);
      if (existing) return { status: 200, body: detailOut(store, existing) };

      // Prank shield: a limit per hour. The Call 112 screen on the phone is shown before sending, so it is never blocked.
      const recent = store.filter("requests", (r) => r.reporter_id === user.id && Date.now() - Date.parse(r.created_at) < 3600_000).length;
      if (recent >= config.reportsPerHour) {
        throw new HttpError(429, "You have sent many reports in a short time. If someone needs help now, call 112.", "rate_limited");
      }

      if (!INJURIES.includes(body.injury_type)) throw invalid("Choose what happened.");
      const symptoms = validSymptoms(body.symptoms ?? {});
      const location = validLocation(body.location);
      const age = validAge(body.patient_age);
      const sex = body.patient_sex ?? "unknown";
      if (!SEXES.includes(sex)) throw invalid("Choose a valid sex.");
      const description = String(body.description ?? "").trim();
      if (description.length > 1000) throw invalid("Keep the description under 1000 characters.");
      if (body.blood_group && !BLOOD.includes(body.blood_group)) throw invalid("Choose a valid blood group.");
      const allergies = String(body.allergies ?? "").trim().slice(0, 200) || null;
      const contactPhone = body.contact_phone ? normaliseIndianMobile(body.contact_phone) : null;

      const result = evaluatePriority(body.injury_type, symptoms, age);
      const now = new Date();
      const request = store.insert("requests", {
        public_code: null,
        reporter_id: user.id,
        idempotency_key: key,
        injury_type: body.injury_type,
        description,
        symptoms,
        patient_age: age,
        patient_sex: sex,
        blood_group: body.blood_group ?? null,
        allergies,
        contact_name: body.contact_name ? String(body.contact_name).slice(0, 100) : null,
        contact_phone: contactPhone ?? user.phone,
        lat: location.lat,
        lng: location.lng,
        location_source: location.source,
        priority: result.category,
        priority_reasons: result.reasons,
        rule_set_version: result.ruleSetVersion,
        sensitive: Boolean(body.sensitive),
        // Emergency Passport: copied only when the reporter says the patient is them and agrees to share it.
        passport: body.share_passport && user.passport ? { ...user.passport } : null,
        status: "SUBMITTED",
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      });
      request.public_code = `JS-${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}-${String(request.id).padStart(4, "0")}`;
      store.insert("consents", { request_id: request.id, user_id: user.id, policy_version: body.consent.policy_version, accepted_at: now.toISOString() });
      recordEvent(store, request, "SUBMITTED", { location_source: location.source }, user.id);
      recordEvent(store, request, "PRIORITY_SET", { priority: result.category, reasons: result.reasons, rule_set_version: result.ruleSetVersion });
      startAllocation(store, request);
      return { status: 201, body: detailOut(store, request) };
    },
    "citizen",
  );

  router.get(
    "/api/emergencies",
    (ctx) => {
      const user = ctx.user();
      const rows = store
        .filter("requests", (r) => r.reporter_id === user.id)
        .reverse()
        .slice(0, 50)
        .map((r) => {
          const a = latestAssignment(store, r.id);
          return { id: r.id, public_code: r.public_code, injury_type: r.injury_type, priority: r.priority, status: r.status, created_at: r.created_at, hospital_name: a ? store.get("hospitals", a.hospital_id).name : null };
        });
      return { body: rows };
    },
    "citizen",
  );

  router.get("/api/emergencies/:id", (ctx) => ({ body: detailOut(store, ownRequest(store, ctx.user(), ctx.params.id)) }), "citizen");

  router.post(
    "/api/emergencies/:id/cancel",
    (ctx) => {
      const user = ctx.user();
      const request = ownRequest(store, user, ctx.params.id);
      cancelRequest(store, request, user);
      return { body: detailOut(store, request) };
    },
    "citizen",
  );

  router.post(
    "/api/emergencies/:id/images",
    async (ctx) => {
      const user = ctx.user();
      const request = ownRequest(store, user, ctx.params.id);
      if (request.status === "CANCELLED") throw conflict("This request was cancelled.");
      if (store.filter("images", (i) => i.request_id === request.id).length >= 3) throw conflict("You can add up to 3 photos to a request.");
      const raw = await readBody(ctx.req, config.imageMaxBytes + 64 * 1024);
      const file = readMultipartFile(raw, ctx.req.headers["content-type"], "photo");
      if (!file.length) throw invalid("The photo is empty. Take it again.", "corrupt");
      const image = decodeImage(file);
      const quality = checkQuality(image);
      if (quality.flags.length) throw invalid(RETAKE_MESSAGES[quality.flags[0]], `retake_${quality.flags[0]}`);
      const { key, size } = saveJpeg(image);
      const result = await analyzer.analyze(image);
      const heatmapKey = result.heatmap ? saveJpeg(result.heatmap, heatmapKeyFor(key)).key : null;
      const record = store.insert("images", {
        request_id: request.id,
        uploaded_by_id: user.id,
        storage_key: key,
        mime_type: "image/jpeg",
        width: image.width,
        height: image.height,
        size_bytes: size,
        quality_flags: [],
        analyzer_name: analyzer.name,
        analyzer_version: analyzer.version,
        prediction: result.prediction,
        confidence: result.confidence,
        abstained: result.abstained,
        heatmap_key: heatmapKey,
        created_at: new Date().toISOString(),
      });
      return { status: 201, body: imageOut(record) };
    },
    "citizen",
  );

  router.get("/api/hospitals", (ctx) => {
    ctx.user();
    const pins = store
      .filter("hospitals", (h) => h.open_for_emergency)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((h) => ({ id: h.id, name: h.name, address: h.address, phone: h.phone, lat: h.lat, lng: h.lng, services: h.services, is_simulated: h.is_simulated, diversion: h.diversion }));
    return { body: pins };
  });

  // Practice drill: real rules and ranking, but nothing is written, so it can never reach a hospital.
  router.post(
    "/api/drill/preview",
    async (ctx) => {
      ctx.user();
      const body = await ctx.json();
      if (!INJURIES.includes(body.injury_type)) throw invalid("Choose what happened.");
      const symptoms = validSymptoms(body.symptoms ?? {});
      const location = validLocation(body.location);
      const result = evaluatePriority(body.injury_type, symptoms, validAge(body.patient_age));
      const hospitals = store.all("hospitals");
      const ranked = rank(location.lat, location.lng, body.injury_type, hospitals, new Set(), currentParams(store), Date.now(), reliabilityFor(store, hospitals.map((h) => h.id)));
      return {
        body: {
          priority: result.category,
          priority_reasons: result.reasons,
          rule_set_version: result.ruleSetVersion,
          candidates: ranked.slice(0, 3).map((c) => ({ ...c, name: store.get("hospitals", c.hospital_id).name })),
        },
        readOnly: true,
      };
    },
    "citizen",
  );
}

export { ACTIVE_STATUSES };
