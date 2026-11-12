/** Two-stage allocation: eligibility filter, then the additive score of Eq. (8). */
export const EARTH_RADIUS_KM = 6371;
const rad = (d) => (d * Math.PI) / 180;

/** Great-circle distance, Eq. (6)-(7). */
export function haversineKm(lat1, lng1, lat2, lng2) {
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(Math.min(1, a)));
}

export function destinationPoint(lat, lng, bearingDeg, distanceKm) {
  const delta = distanceKm / EARTH_RADIUS_KM;
  const theta = rad(bearingDeg);
  const phi1 = rad(lat);
  const lambda1 = rad(lng);
  const phi2 = Math.asin(Math.sin(phi1) * Math.cos(delta) + Math.cos(phi1) * Math.sin(delta) * Math.cos(theta));
  const lambda2 = lambda1 + Math.atan2(Math.sin(theta) * Math.sin(delta) * Math.cos(phi1), Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2));
  return [(phi2 * 180) / Math.PI, ((((lambda2 * 180) / Math.PI + 540) % 360) - 180)];
}

/** Table II of the paper: a project assumption, not clinical routing guidance. */
export const REQUIRED_SERVICES = {
  road_accident: ["general_emergency", "trauma_care"],
  burn: ["general_emergency", "burn_care"],
  fall_fracture: ["general_emergency", "orthopaedics"],
  cardiac: ["general_emergency", "cardiac_care"],
  breathing: ["general_emergency"],
  cut: ["general_emergency"],
  other: ["general_emergency"],
};

export const NEUTRAL_RELIABILITY = 0.5;

export const DEFAULT_PARAMS = {
  wDistance: 0.7,
  wResource: 0.3,
  wReliability: 0.05,
  bedCap: 5,
  maxDistanceKm: 25,
  staleAfterMs: 6 * 3600 * 1000,
};

const round = (n, places) => Math.round(n * 10 ** places) / 10 ** places;

export function availabilityFlag(hospital, nowMs, params) {
  if (hospital.free_beds === null || hospital.free_beds === undefined || !hospital.beds_updated_at) return "missing";
  if (nowMs - Date.parse(hospital.beds_updated_at) > params.staleAfterMs) return "stale";
  return null;
}

export function rank(lat, lng, injuryType, hospitals, excludedIds, params, nowMs, reliability = {}) {
  const needed = REQUIRED_SERVICES[injuryType];
  const candidates = [];
  for (const h of hospitals) {
    const distance = haversineKm(lat, lng, h.lat, h.lng);
    if (excludedIds.has(h.id) || !h.open_for_emergency || h.diversion) continue;
    if (distance > params.maxDistanceKm) continue;
    if (!needed.every((s) => h.services.includes(s))) continue;
    const flag = availabilityFlag(h, nowMs, params);
    // Missing or stale availability keeps the hospital eligible but earns nothing here.
    const resourcePart = flag ? 0 : Math.min(Math.max(h.free_beds, 0), params.bedCap) / params.bedCap;
    const rel = reliability[h.id] ?? NEUTRAL_RELIABILITY;
    const distanceTerm = params.wDistance * (1 - distance / params.maxDistanceKm);
    const resourceTerm = params.wResource * resourcePart;
    const reliabilityTerm = params.wReliability * rel;
    candidates.push({
      hospital_id: h.id,
      distance_km: round(distance, 3),
      distance_term: round(distanceTerm, 4),
      resource_term: round(resourceTerm, 4),
      reliability: round(rel, 4),
      reliability_term: round(reliabilityTerm, 4),
      score: round(distanceTerm + resourceTerm + reliabilityTerm, 4),
      availability_flag: flag,
    });
  }
  candidates.sort((a, b) => b.score - a.score || a.distance_km - b.distance_km || a.hospital_id - b.hospital_id);
  return candidates;
}

/** Hospital Reliability Score: smoothed accept rate plus reply speed, 0..1. */
export function reliabilityFromHistory(outcomes, timeoutSeconds) {
  if (!outcomes.length) return NEUTRAL_RELIABILITY;
  const accepted = outcomes.filter((o) => o.status === "ACCEPTED").length;
  const acceptRate = (accepted + 1) / (outcomes.length + 2);
  const replies = outcomes.filter((o) => o.status !== "TIMED_OUT" && o.seconds !== null).map((o) => o.seconds).sort((a, b) => a - b);
  let speed = 0;
  if (replies.length) {
    const mid = Math.floor(replies.length / 2);
    const median = replies.length % 2 ? replies[mid] : (replies[mid - 1] + replies[mid]) / 2;
    speed = Math.max(0, 1 - median / timeoutSeconds);
  }
  return round(0.7 * acceptRate + 0.3 * speed, 4);
}
