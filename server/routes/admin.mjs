import { conflict, invalid, notFound, toCsv } from "../lib/http.mjs";
import { audit } from "../lib/allocation.mjs";
import { intParam } from "../lib/router.mjs";
import { hashPassword } from "../lib/security.mjs";
import { trustScore } from "../lib/trust.mjs";
import { hospitalStats } from "./extra.mjs";
import { hospitalOut, SERVICES } from "./staff.mjs";

const STATUSES = ["SUBMITTED", "FINDING_HOSPITAL", "AWAITING_HOSPITAL_RESPONSE", "HOSPITAL_ACCEPTED", "PATIENT_ARRIVED", "NO_SUITABLE_HOSPITAL", "CANCELLED"];
const dayStart = (d) => Date.parse(`${d}T00:00:00`);
const dayEnd = (d) => Date.parse(`${d}T23:59:59.999`);

function inRange(iso, from, to) {
  const t = Date.parse(iso);
  return (!from || t >= dayStart(from)) && (!to || t <= dayEnd(to));
}

function respond(ctx, store, admin, rows, columns, name) {
  if (ctx.query.get("format") !== "csv") return { body: rows };
  audit(store, admin.id, "EXPORT_CSV", name, rows.length);
  return {
    raw: Buffer.from(toCsv(rows, columns)),
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="jeevansetu-${name}.csv"`, "Cache-Control": "no-store" },
  };
}

function median(values) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const staffOut = (store, u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  hospital_id: u.hospital_id,
  hospital_name: u.hospital_id ? store.get("hospitals", u.hospital_id)?.name ?? null : null,
  is_active: u.is_active,
  created_at: u.created_at,
});

export function registerAdmin(router, store) {
  router.get(
    "/api/admin/overview",
    () => {
      const by_status = Object.fromEntries(STATUSES.map((s) => [s, store.filter("requests", (r) => r.status === s).length]));
      const replies = store.filter("assignments", (a) => ["ACCEPTED", "REJECTED", "TIMED_OUT"].includes(a.status));
      const answered = replies.filter((a) => a.status !== "TIMED_OUT" && a.decided_at).map((a) => (Date.parse(a.decided_at) - Date.parse(a.created_at)) / 1000);
      const accepted = replies.filter((a) => a.status === "ACCEPTED").length;
      const med = median(answered);
      return {
        body: {
          total_requests: store.all("requests").length,
          by_status,
          median_response_seconds: med === null ? null : Math.round(med * 10) / 10,
          accept_rate: replies.length ? Math.round((accepted / replies.length) * 10000) / 10000 : null,
          no_hospital_cases: by_status.NO_SUITABLE_HOSPITAL,
          per_hospital: hospitalStats(store),
        },
        readOnly: true,
      };
    },
    "admin",
  );

  router.get(
    "/api/admin/requests",
    (ctx) => {
      const q = ctx.query;
      const code = (q.get("q") ?? "").trim().toUpperCase();
      const rows = store
        .filter(
          "requests",
          (r) =>
            (!q.get("status") || r.status === q.get("status")) &&
            (!q.get("priority") || r.priority === q.get("priority")) &&
            inRange(r.created_at, q.get("date_from"), q.get("date_to")) &&
            (!code || r.public_code.includes(code)),
        )
        .reverse()
        .slice(0, 500)
        .map((r) => {
          const asked = store.filter("assignments", (a) => a.request_id === r.id);
          const live = [...asked].reverse().find((a) => ["PENDING", "ACCEPTED"].includes(a.status));
          return {
            id: r.id,
            public_code: r.public_code,
            created_at: r.created_at,
            injury_type: r.injury_type,
            priority: r.priority,
            status: r.status,
            hospitals_asked: asked.length,
            current_hospital: live ? store.get("hospitals", live.hospital_id).name : null,
            lat: r.lat,
            lng: r.lng,
            sensitive: Boolean(r.sensitive),
            reporter_trust: trustScore(store, r.reporter_id).score,
          };
        });
      return respond(ctx, store, ctx.user(), rows, ["id", "public_code", "created_at", "injury_type", "priority", "status", "hospitals_asked", "current_hospital", "lat", "lng", "sensitive", "reporter_trust"], "requests");
    },
    "admin",
  );

  router.get(
    "/api/admin/hospitals",
    (ctx) => {
      const rows = [...store.all("hospitals")].sort((a, b) => a.name.localeCompare(b.name)).map(hospitalOut);
      return respond(ctx, store, ctx.user(), rows, ["id", "name", "address", "phone", "lat", "lng", "services", "free_beds", "beds_updated_at", "open_for_emergency", "diversion", "is_simulated"], "hospitals");
    },
    "admin",
  );

  router.post(
    "/api/admin/hospitals",
    async (ctx) => {
      const admin = ctx.user();
      const b = await ctx.json();
      const lat = Number(b.lat);
      const lng = Number(b.lng);
      if (!String(b.name ?? "").trim() || !Number.isFinite(lat) || !Number.isFinite(lng)) throw invalid("Name, latitude and longitude are required.");
      if (!Array.isArray(b.services) || !b.services.length || b.services.some((s) => !SERVICES.includes(s))) throw invalid("Choose at least one valid service.");
      const now = new Date().toISOString();
      const h = store.insert("hospitals", {
        name: String(b.name).trim(),
        address: String(b.address ?? "").trim(),
        phone: String(b.phone ?? "").trim(),
        lat,
        lng,
        services: [...new Set(b.services)].sort(),
        free_beds: b.free_beds ?? null,
        beds_updated_at: b.free_beds === null || b.free_beds === undefined ? null : now,
        open_for_emergency: true,
        diversion: false,
        is_simulated: true,
        created_at: now,
      });
      audit(store, admin.id, "CREATE_HOSPITAL", "hospital", h.id);
      return { status: 201, body: hospitalOut(h) };
    },
    "admin",
  );

  router.patch(
    "/api/admin/hospitals/:id",
    async (ctx) => {
      const admin = ctx.user();
      const h = store.get("hospitals", intParam(ctx.params.id));
      if (!h) throw notFound("Hospital not found.");
      const b = await ctx.json();
      for (const field of ["name", "address", "phone"]) if (field in b) h[field] = String(b[field]).trim();
      if ("services" in b) h.services = [...new Set(b.services)].sort();
      if ("open_for_emergency" in b) h.open_for_emergency = Boolean(b.open_for_emergency);
      if ("diversion" in b) h.diversion = Boolean(b.diversion);
      audit(store, admin.id, "UPDATE_HOSPITAL", "hospital", h.id);
      return { body: hospitalOut(h) };
    },
    "admin",
  );

  router.get(
    "/api/admin/staff",
    (ctx) => {
      const hid = ctx.query.get("hospital_id");
      const active = ctx.query.get("active");
      const rows = store
        .filter("users", (u) => u.role === "staff" && (!hid || u.hospital_id === Number(hid)) && (active === null || String(u.is_active) === active))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((u) => staffOut(store, u));
      return respond(ctx, store, ctx.user(), rows, ["id", "name", "email", "hospital_id", "hospital_name", "is_active", "created_at"], "staff");
    },
    "admin",
  );

  router.post(
    "/api/admin/staff",
    async (ctx) => {
      const admin = ctx.user();
      const b = await ctx.json();
      const email = String(b.email ?? "").trim().toLowerCase();
      if (String(b.name ?? "").trim().length < 2) throw invalid("Enter the full name.");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw invalid("Enter a valid email.");
      if (String(b.password ?? "").length < 10) throw invalid("The password must have at least 10 characters.");
      if (!store.get("hospitals", Number(b.hospital_id))) throw invalid("Choose an existing hospital.");
      if (store.find("users", (u) => u.email === email)) throw conflict("An account with this email already exists.");
      const u = store.insert("users", { role: "staff", name: String(b.name).trim(), phone: null, email, password_hash: hashPassword(String(b.password)), hospital_id: Number(b.hospital_id), is_active: true, created_at: new Date().toISOString() });
      audit(store, admin.id, "CREATE_STAFF", "user", u.id);
      return { status: 201, body: staffOut(store, u) };
    },
    "admin",
  );

  router.patch(
    "/api/admin/staff/:id",
    async (ctx) => {
      const admin = ctx.user();
      const u = store.get("users", intParam(ctx.params.id));
      if (!u || u.role !== "staff") throw notFound("Staff account not found.");
      const b = await ctx.json();
      if ("hospital_id" in b) {
        if (!store.get("hospitals", Number(b.hospital_id))) throw invalid("Choose an existing hospital.");
        u.hospital_id = Number(b.hospital_id);
      }
      if ("is_active" in b) u.is_active = Boolean(b.is_active);
      audit(store, admin.id, "UPDATE_STAFF", "user", u.id);
      return { body: staffOut(store, u) };
    },
    "admin",
  );

  router.get(
    "/api/admin/audit",
    (ctx) => {
      const q = ctx.query;
      const action = (q.get("action") ?? "").toUpperCase();
      const actor = q.get("actor_user_id");
      const rows = store
        .filter("audit", (a) => (!action || a.action === action) && (!actor || a.actor_user_id === Number(actor)) && inRange(a.created_at, q.get("date_from"), q.get("date_to")))
        .reverse()
        .slice(0, 1000);
      return respond(ctx, store, ctx.user(), rows, ["id", "created_at", "actor_user_id", "action", "entity_type", "entity_id"], "audit");
    },
    "admin",
  );
}
