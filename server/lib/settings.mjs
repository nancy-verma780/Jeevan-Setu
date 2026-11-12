/**
 * Surge / Disaster Mode and other system-wide settings, kept in one row.
 * While surge mode is on, the search radius Dmax is temporarily widened and a
 * broadcast message is shown to citizens and hospital staff.
 */
import { DEFAULT_PARAMS } from "./ranking.mjs";

export function settings(store) {
  return store.get("settings", 1) ?? store.insert("settings", { surge: { active: false, message: "", radius_km: 40, started_at: null } });
}

export function surge(store) {
  return settings(store).surge;
}

/** Ranking parameters in force right now. */
export function currentParams(store) {
  const s = surge(store);
  return s.active ? { ...DEFAULT_PARAMS, maxDistanceKm: s.radius_km } : DEFAULT_PARAMS;
}

/**
 * Capability Truth Panel. Staff confirm live readiness; each confirmation
 * expires after two hours and then shows as expired. Informational only: it is
 * shown to staff and admins but does not change the ranking.
 */
export const READINESS_ITEMS = ["trauma_surgeon", "ot_free", "blood_available", "ventilator_free"];
export const READINESS_TTL_MS = 2 * 3600_000;

export function readinessOut(hospital, nowMs = Date.now()) {
  return Object.fromEntries(
    READINESS_ITEMS.map((item) => {
      const r = hospital.readiness?.[item];
      if (!r) return [item, { state: "unknown", confirmed_at: null, expires_at: null }];
      const expired = nowMs > Date.parse(r.expires_at);
      return [item, { state: expired ? "expired" : r.available ? "available" : "not_available", confirmed_at: r.confirmed_at, expires_at: r.expires_at }];
    }),
  );
}
