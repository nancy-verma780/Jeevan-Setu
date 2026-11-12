/** Must match JS_CONSENT_POLICY_VERSION on the server. */
export const CONSENT_POLICY_VERSION = "2026-10-01";

/** Shown to the citizen when the browser cannot get a location (Pari Chowk, Greater Noida). */
export const DEFAULT_MAP_CENTER: [number, number] = [28.4744, 77.504];

export const RANKING = {
  wDistance: 0.7,
  wResource: 0.3,
  bedCap: 5,
  maxDistanceKm: 25,
} as const;

/** Fallback polling; live updates arrive through the event stream. */
export const ACTIVE_POLL_MS = 15000;
