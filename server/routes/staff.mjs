import { HttpError, invalid, notFound } from "../lib/http.mjs";
import { assignmentForStaff, audit, decide, markArrived } from "../lib/allocation.mjs";
import { freshness } from "../lib/freshness.mjs";
import { imageOut, readImage } from "../lib/images.mjs";
import { intParam } from "../lib/router.mjs";

const PRIORITY_ORDER = { RED_FLAG: 0, NEEDS_REVIEW: 1, ELEVATED: 2, STANDARD: 3 };
const QUEUE = { pending: ["PENDING"], accepted: ["ACCEPTED"], declined: ["REJECTED", "TIMED_OUT"] };
export const SERVICES = ["general_emergency", "trauma_care", "burn_care", "orthopaedics", "cardiac_care"];

function rowOut(store, a) {
  const r = store.get("requests", a.request_id);
  return {
    assignment_id: a.id,
    request_code: r.public_code,
    priority: r.priority,
    injury_type: r.injury_type,
    patient_age: r.patient_age,
    patient_sex: r.patient_sex,
    distance_km: a.distance_km,
    status: a.status,
    received_at: a.created_at,
    deadline_at: a.deadline_at,
    arrived_at: a.arrived_at ?? null,
    sensitive: Boolean(r.sensitive),
    seconds_left: a.status === "PENDING" ? Math.max(0, Math.floor((Date.parse(a.deadline_at) - Date.now()) / 1000)) : 0,
  };
}

function caseOut(store, a) {
  const r = store.get("requests", a.request_id);
  return {
    ...rowOut(store, a),
    priority_reasons: r.priority_reasons,
    rule_set_version: r.rule_set_version,
    symptoms: r.symptoms,
    packet: {
      request_code: r.public_code,
      priority: r.priority,
      patient_age: r.patient_age,
      patient_sex: r.patient_sex,
      injury_type: r.injury_type,
      blood_group: r.blood_group ?? r.passport?.blood_group ?? null,
      allergies: r.allergies ?? r.passport?.allergies ?? null,
      conditions: r.passport?.conditions ?? null,
      emergency_contacts: r.passport?.contacts ?? [],
      passport_shared: Boolean(r.passport),
      description: r.description,
      contact_name: r.contact_name,
      contact_phone: r.contact_phone,
      lat: r.lat,
      lng: r.lng,
      location_source: r.location_source,
    },
    decline_reason: a.reason,
  };
}

export function hospitalOut(h) {
  const { created_at: _created, ...rest } = h;
  return { ...rest, freshness: freshness(h.beds_updated_at) };
}

function ownAssignment(store, ctx, user) {
  try {
    return assignmentForStaff(store, intParam(ctx.params.id), user);
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) {
      audit(store, user.id, "ACCESS_DENIED", "assignment", ctx.params.id);
      ctx.markChanged();
    }
    throw error;
  }
}

export function registerStaff(router, store) {
  router.get(
    "/api/staff/requests",
    (ctx) => {
      const user = ctx.user();
      const which = ctx.query.get("status") ?? "pending";
      if (!QUEUE[which]) throw invalid("Status must be pending, accepted or declined.");
      const rows = store
        .filter("assignments", (a) => a.hospital_id === user.hospital_id && QUEUE[which].includes(a.status))
        .sort((x, y) => {
          const px = PRIORITY_ORDER[store.get("requests", x.request_id).priority];
          const py = PRIORITY_ORDER[store.get("requests", y.request_id).priority];
          return px - py || Date.parse(x.deadline_at) - Date.parse(y.deadline_at);
        })
        .slice(0, 200)
        .map((a) => rowOut(store, a));
      return { body: rows, readOnly: true };
    },
    "staff",
  );

  router.get(
    "/api/staff/requests/:id",
    (ctx) => {
      const user = ctx.user();
      const a = ownAssignment(store, ctx, user);
      audit(store, user.id, "VIEW_CASE", "assignment", a.id);
      return { body: caseOut(store, a) };
    },
    "staff",
  );

  router.post(
    "/api/staff/requests/:id/decision",
    async (ctx) => {
      const user = ctx.user();
      ownAssignment(store, ctx, user);
      const body = await ctx.json();
      const a = decide(store, intParam(ctx.params.id), user, body.action, body.reason);
      audit(store, user.id, `DECISION_${String(body.action).toUpperCase()}`, "assignment", a.id);
      return { body: caseOut(store, a) };
    },
    "staff",
  );

  router.post(
    "/api/staff/requests/:id/arrived",
    (ctx) => {
      const user = ctx.user();
      const a = ownAssignment(store, ctx, user);
      markArrived(store, a, user);
      audit(store, user.id, "MARK_ARRIVED", "assignment", a.id);
      return { body: caseOut(store, a) };
    },
    "staff",
  );

  router.get(
    "/api/staff/requests/:id/images",
    (ctx) => {
      const user = ctx.user();
      const a = ownAssignment(store, ctx, user);
      return { body: store.filter("images", (i) => i.request_id === a.request_id).map(imageOut) };
    },
    "staff",
  );

  router.get(
    "/api/staff/images/:id",
    (ctx) => {
      const user = ctx.user();
      const record = store.get("images", intParam(ctx.params.id));
      const allowed = record && store.find("assignments", (a) => a.request_id === record.request_id && a.hospital_id === user.hospital_id);
      if (!allowed) {
        audit(store, user.id, "ACCESS_DENIED", "image", ctx.params.id);
        ctx.markChanged();
        throw notFound("Image not found.");
      }
      const variant = ctx.query.get("variant") ?? "photo";
      const key = variant === "heatmap" ? record.heatmap_key : record.storage_key;
      if (!key) throw notFound("No heat-map for this photo.");
      const data = readImage(key);
      audit(store, user.id, "IMAGE_VIEW", "image", record.id);
      return { raw: data, headers: { "Content-Type": "image/jpeg", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } };
    },
    "staff",
  );

  router.get(
    "/api/staff/hospital",
    (ctx) => {
      const h = store.get("hospitals", ctx.user().hospital_id);
      if (!h) throw notFound("Your account is not linked to a hospital.");
      return { body: hospitalOut(h), readOnly: true };
    },
    "staff",
  );

  router.patch(
    "/api/staff/hospital",
    async (ctx) => {
      const user = ctx.user();
      const h = store.get("hospitals", user.hospital_id);
      if (!h) throw notFound("Your account is not linked to a hospital.");
      const body = await ctx.json();
      if ("free_beds" in body) {
        const beds = body.free_beds === null ? null : Number(body.free_beds);
        if (beds !== null && (!Number.isInteger(beds) || beds < 0 || beds > 500)) throw invalid("Beds must be between 0 and 500.");
        h.free_beds = beds;
        h.beds_updated_at = new Date().toISOString();
      }
      if ("services" in body) {
        if (!Array.isArray(body.services) || body.services.some((s) => !SERVICES.includes(s))) throw invalid("Unknown service.");
        h.services = [...new Set(body.services)].sort();
      }
      if ("diversion" in body) h.diversion = Boolean(body.diversion);
      if ("open_for_emergency" in body) h.open_for_emergency = Boolean(body.open_for_emergency);
      audit(store, user.id, "UPDATE_RESOURCES", "hospital", h.id);
      return { body: hospitalOut(h) };
    },
    "staff",
  );
}
