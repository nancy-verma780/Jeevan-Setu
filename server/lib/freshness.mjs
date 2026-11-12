/**
 * Data Freshness Confidence. Every hospital figure carries its age. Confidence
 * falls linearly from 1 to 0 over six hours; after that the figure is stale and
 * the ranking gives it a zero resource score (see availabilityFlag in ranking.mjs).
 */
export const STALE_AFTER_MINUTES = 360;

export function freshness(updatedAt, nowMs = Date.now()) {
  if (!updatedAt) return { level: "missing", age_minutes: null, confidence: 0 };
  const minutes = Math.max(0, (nowMs - Date.parse(updatedAt)) / 60000);
  const confidence = Math.max(0, Math.min(1, 1 - minutes / STALE_AFTER_MINUTES));
  const level = minutes <= 60 ? "fresh" : minutes <= STALE_AFTER_MINUTES ? "ageing" : "stale";
  return { level, age_minutes: Math.round(minutes), confidence: Math.round(confidence * 100) / 100 };
}
