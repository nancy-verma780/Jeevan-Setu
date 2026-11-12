import { config } from "../lib/config.mjs";
import { conflict, HttpError, invalid, notFound, toCsv } from "../lib/http.mjs";
import { audit } from "../lib/allocation.mjs";
import { DEFAULT_PARAMS, rank } from "../lib/ranking.mjs";
import { intParam } from "../lib/router.mjs";
import { hashToken, newToken, normaliseIndianMobile } from "../lib/security.mjs";
import { ownRequest } from "./citizen.mjs";

const FINAL = ["PATIENT_ARRIVED", "CANCELLED", "NO_SUITABLE_HOSPITAL"];
const BLOOD = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const ANSWERS = ["yes", "no", "unsure"];

function median(values) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
const round1 = (n) => (n === null ? null : Math.round(n * 10) / 10);
const replySeconds = (a) => (Date.parse(a.decided_at) - Date.parse(a.created_at)) / 1000;

/** Per-hospital response figures used by the admin overview and the public scorecard. */
export function hospitalStats(store) {
  return store.all("hospitals").map((h) => {
    const asked = store.filter("assignments", (a) => a.hospital_id === h.id);
    const decided = asked.filter((a) => ["ACCEPTED", "REJECTED", "TIMED_OUT"].includes(a.status));
    const accepted = decided.filter((a) => a.status === "ACCEPTED").length;
    const replies = decided.filter((a) => a.status !== "TIMED_OUT").map(replySeconds);
    return {
      hospital_id: h.id,
      name: h.name,
      asked: asked.length,
      accepted,
      declined: decided.filter((a) => a.status === "REJECTED").length,
      timed_out: decided.filter((a) => a.status === "TIMED_OUT").length,
      accept_rate: decided.length ? Math.round((accepted / decided.length) * 1000) / 1000 : null,
      median_reply_seconds: round1(median(replies)),
    };
  });
}

export function registerExtra(router, store) {
  // ---- Share live status with family (view-only link that expires) ----
  router.post(
    "/api/emergencies/:id/share",
    (ctx) => {
      const user = ctx.user();
      const request = ownRequest(store, user, ctx.params.id);
      if (FINAL.includes(request.status)) throw conflict("This request is closed, so it can no longer be shared.");
      const token = newToken();
      const expires = new Date(Date.now() + config.shareTtlHours * 3600_000).toISOString();
      store.insert("shares", { request_id: request.id, token_hash: hashToken(token), created_at: new Date().toISOString(), expires_at: expires });
      audit(store, user.id, "SHARE_LINK", "request", request.id);
      return { status: 201, body: { path: `/track/${token}`, expires_at: expires } };
    },
    "citizen",
  );

  router.get("/api/track/:token", (ctx) => {
    const share = store.find("shares", (s) => s.token_hash === hashToken(ctx.params.token));
    if (!share) throw notFound("This link is not valid.");
    const request = store.get("requests", share.request_id);
    const closedLongAgo = FINAL.includes(request.status) && Date.now() - Date.parse(request.updated_at) > config.shareAfterCloseHours * 3600_000;
    if (Date.now() > Date.parse(share.expires_at) || closedLongAgo) throw new HttpError(410, "This link has expired.");
    const live = store.filter("assignments", (a) => a.request_id === request.id && ["PENDING", "ACCEPTED"].includes(a.status)).at(-1);
    const hospital = live ? store.get("hospitals", live.hospital_id) : null;
    return {
      readOnly: true,
      body: {
        public_code: request.public_code,
        status: request.status,
        created_at: request.created_at,
        expires_at: share.expires_at,
        hospital: hospital ? { name: hospital.name, accepted: live.status === "ACCEPTED", address: live.status === "ACCEPTED" ? hospital.address : null } : null,
        // Times and hospital names only. No patient details, symptoms or priority reasons.
        events: store
          .filter("events", (e) => e.request_id === request.id && e.type !== "PRIORITY_SET")
          .map((e) => ({ id: e.id, type: e.type, created_at: e.created_at, hospital_name: e.data.hospital_name ?? null })),
      },
    };
  });

  // ---- Emergency Passport ----
  router.get("/api/me/passport", (ctx) => ({ body: ctx.user().passport ?? null, readOnly: true }), "citizen");
  router.put(
    "/api/me/passport",
    async (ctx) => {
      const user = ctx.user();
      const b = await ctx.json();
      if (b.blood_group && !BLOOD.includes(b.blood_group)) throw invalid("Choose a valid blood group.");
      const contacts = Array.isArray(b.contacts) ? b.contacts.slice(0, 3) : [];
      const cleanContacts = contacts
        .filter((c) => c && (c.name || c.phone))
        .map((c) => {
          const phone = normaliseIndianMobile(c.phone);
          if (!phone) throw invalid("Enter a 10-digit mobile number for each emergency contact.");
          return { name: String(c.name ?? "").trim().slice(0, 60), relation: String(c.relation ?? "").trim().slice(0, 30), phone };
        });
      user.passport = {
        blood_group: b.blood_group || null,
        allergies: String(b.allergies ?? "").trim().slice(0, 200) || null,
        conditions: String(b.conditions ?? "").trim().slice(0, 300) || null,
        contacts: cleanContacts,
        updated_at: new Date().toISOString(),
      };
      audit(store, user.id, "UPDATE_PASSPORT", "user", user.id);
      return { body: user.passport };
    },
    "citizen",
  );

  // ---- Patient-side access log ----
  router.get(
    "/api/emergencies/:id/access-log",
    (ctx) => {
      const request = ownRequest(store, ctx.user(), ctx.params.id);
      const assignmentIds = new Set(store.filter("assignments", (a) => a.request_id === request.id).map((a) => String(a.id)));
      const imageIds = new Set(store.filter("images", (i) => i.request_id === request.id).map((i) => String(i.id)));
      const rows = store
        .filter(
          "audit",
          (a) => (a.entity_type === "assignment" && assignmentIds.has(a.entity_id) && a.action !== "ACCESS_DENIED") || (a.entity_type === "image" && imageIds.has(a.entity_id) && a.action === "IMAGE_VIEW"),
        )
        .map((a) => {
          const staff = store.get("users", a.actor_user_id);
          const hospital = staff?.hospital_id ? store.get("hospitals", staff.hospital_id) : null;
          return { id: a.id, action: a.action, created_at: a.created_at, staff_name: staff?.name ?? "", hospital_name: hospital?.name ?? "" };
        })
        .reverse();
      return { body: rows, readOnly: true };
    },
    "citizen",
  );

  // ---- Outcome feedback ----
  router.post(
    "/api/emergencies/:id/feedback",
    async (ctx) => {
      const user = ctx.user();
      const request = ownRequest(store, user, ctx.params.id);
      if (!["HOSPITAL_ACCEPTED", "PATIENT_ARRIVED"].includes(request.status)) throw conflict("Feedback opens after a hospital has accepted the request.");
      if (store.find("feedback", (f) => f.request_id === request.id)) throw conflict("Feedback was already sent for this request.");
      const b = await ctx.json();
      if (!ANSWERS.includes(b.hospital_ready) || !ANSWERS.includes(b.info_correct)) throw invalid("Answer both questions.");
      const row = store.insert("feedback", {
        request_id: request.id,
        hospital_id: store.filter("assignments", (a) => a.request_id === request.id && a.status === "ACCEPTED").at(-1)?.hospital_id ?? null,
        hospital_ready: b.hospital_ready,
        info_correct: b.info_correct,
        comment: String(b.comment ?? "").trim().slice(0, 500),
        created_at: new Date().toISOString(),
      });
      return { status: 201, body: row };
    },
    "citizen",
  );

  // ---- Public accountability scorecard (aggregates only) ----
  router.get("/api/public/scorecard", () => {
    const rows = hospitalStats(store).map(({ hospital_id: _id, ...rest }) => rest);
    return { body: { hospitals: rows, updated_at: new Date().toISOString() }, readOnly: true };
  });

  // ---- Admin: insights, what-if sandbox, notifications, case report ----
  router.get(
    "/api/admin/insights",
    () => {
      const declined = store.filter("assignments", (a) => a.status === "REJECTED");
      const byReason = {};
      for (const a of declined) byReason[a.reason] = (byReason[a.reason] ?? 0) + 1;
      const nearestArea = (lat, lng) => {
        let best = null;
        for (const h of store.all("hospitals")) {
          const d = (h.lat - lat) ** 2 + (h.lng - lng) ** 2;
          if (!best || d < best.d) best = { d, label: h.address.split(",")[0] };
        }
        return best?.label ?? "Unknown";
      };
      const byArea = {};
      const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, requests: 0, replies: [], accepted: 0, decided: 0 }));
      for (const r of store.all("requests")) {
        const area = nearestArea(r.lat, r.lng);
        byArea[area] ??= { area, requests: 0, declined: 0, no_hospital: 0 };
        byArea[area].requests += 1;
        if (r.status === "NO_SUITABLE_HOSPITAL") byArea[area].no_hospital += 1;
        const hour = new Date(r.created_at).getHours();
        byHour[hour].requests += 1;
        for (const a of store.filter("assignments", (x) => x.request_id === r.id)) {
          if (a.status === "REJECTED") byArea[area].declined += 1;
          if (["ACCEPTED", "REJECTED", "TIMED_OUT"].includes(a.status)) {
            byHour[hour].decided += 1;
            if (a.status === "ACCEPTED") byHour[hour].accepted += 1;
            if (a.status !== "TIMED_OUT") byHour[hour].replies.push(replySeconds(a));
          }
        }
      }
      const feedback = store.all("feedback");
      const yesRate = (field) => (feedback.length ? Math.round((feedback.filter((f) => f[field] === "yes").length / feedback.length) * 1000) / 1000 : null);
      return {
        readOnly: true,
        body: {
          refusals_by_reason: Object.entries(byReason).map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
          by_hospital: hospitalStats(store),
          by_area: Object.values(byArea).sort((a, b) => b.requests - a.requests),
          by_hour: byHour
            .filter((h) => h.requests)
            .map((h) => ({ hour: h.hour, requests: h.requests, accept_rate: h.decided ? Math.round((h.accepted / h.decided) * 1000) / 1000 : null, median_reply_seconds: round1(median(h.replies)) })),
          feedback: { count: feedback.length, hospital_ready_yes: yesRate("hospital_ready"), info_correct_yes: yesRate("info_correct") },
        },
      };
    },
    "admin",
  );

  router.post(
    "/api/admin/whatif",
    async (ctx) => {
      const b = await ctx.json();
      const num = (v, lo, hi, name) => {
        const n = Number(v);
        if (!Number.isFinite(n) || n < lo || n > hi) throw invalid(`${name} must be between ${lo} and ${hi}.`);
        return n;
      };
      const params = {
        ...DEFAULT_PARAMS,
        wDistance: num(b.wd, 0, 1, "Distance weight"),
        wResource: num(b.wr, 0, 1, "Bed weight"),
        maxDistanceKm: num(b.dmax, 1, 100, "Radius"),
        bedCap: Math.round(num(b.bcap, 1, 50, "Bed cap")),
      };
      const hospitals = store.all("hospitals");
      const name = (id) => hospitals.find((h) => h.id === id)?.name ?? null;
      const requests = store.all("requests").slice(-200);
      let changed = 0;
      let noneBase = 0;
      let noneNew = 0;
      const distBase = [];
      const distNew = [];
      const examples = [];
      for (const r of requests) {
        // Replays on today's hospital data and ignores who already declined; nothing is written.
        const base = rank(r.lat, r.lng, r.injury_type, hospitals, new Set(), DEFAULT_PARAMS, Date.now())[0];
        const next = rank(r.lat, r.lng, r.injury_type, hospitals, new Set(), params, Date.now())[0];
        if (!base) noneBase += 1;
        else distBase.push(base.distance_km);
        if (!next) noneNew += 1;
        else distNew.push(next.distance_km);
        if ((base?.hospital_id ?? null) !== (next?.hospital_id ?? null)) {
          changed += 1;
          if (examples.length < 20) examples.push({ code: r.public_code, injury_type: r.injury_type, before: name(base?.hospital_id), after: name(next?.hospital_id) });
        }
      }
      const avg = (xs) => (xs.length ? Math.round((xs.reduce((a, c) => a + c, 0) / xs.length) * 100) / 100 : null);
      return {
        readOnly: true,
        body: { requests: requests.length, changed, no_hospital_before: noneBase, no_hospital_after: noneNew, avg_distance_before: avg(distBase), avg_distance_after: avg(distNew), examples },
      };
    },
    "admin",
  );

  router.get(
    "/api/admin/notifications",
    (ctx) => {
      const rows = [...store.all("notifications")].reverse().slice(0, 500);
      if (ctx.query.get("format") === "csv") {
        return { raw: Buffer.from(toCsv(rows, ["id", "created_at", "channel", "to", "text", "request_id", "status"])), headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="jeevansetu-notifications.csv"' } };
      }
      return { body: rows, readOnly: true };
    },
    "admin",
  );

  router.get(
    "/api/admin/requests/:id",
    (ctx) => {
      const r = store.get("requests", intParam(ctx.params.id));
      if (!r) throw notFound("Request not found.");
      audit(store, ctx.user().id, "VIEW_CASE_REPORT", "request", r.id);
      return {
        body: {
          id: r.id,
          public_code: r.public_code,
          created_at: r.created_at,
          updated_at: r.updated_at,
          injury_type: r.injury_type,
          priority: r.priority,
          priority_reasons: r.priority_reasons,
          rule_set_version: r.rule_set_version,
          status: r.status,
          sensitive: Boolean(r.sensitive),
          location_source: r.location_source,
          assignments: store.filter("assignments", (a) => a.request_id === r.id).map((a) => ({
            hospital: store.get("hospitals", a.hospital_id).name,
            status: a.status,
            created_at: a.created_at,
            decided_at: a.decided_at,
            arrived_at: a.arrived_at ?? null,
            reason: a.reason,
            distance_km: a.distance_km,
            distance_term: a.distance_term,
            resource_term: a.resource_term,
            reliability_term: a.reliability_term,
            score: a.score,
            availability_flag: a.availability_flag,
          })),
          events: store.filter("events", (e) => e.request_id === r.id).map(({ id, type, data, created_at }) => ({ id, type, created_at, hospital_name: data.hospital_name ?? null, reason: data.reason ?? null })),
          feedback: store.find("feedback", (f) => f.request_id === r.id),
        },
      };
    },
    "admin",
  );
}
