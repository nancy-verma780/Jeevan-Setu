/**
 * Report trust score, visible only to administrators. It never blocks anything:
 * a red-flag report always gets the Call 112 screen on the phone, before sending.
 */
export function trustScore(store, userId, nowMs = Date.now()) {
  const reports = store.filter("requests", (r) => r.reporter_id === userId);
  const cancelled = reports.filter((r) => r.status === "CANCELLED").length;
  const arrived = reports.filter((r) => r.status === "PATIENT_ARRIVED").length;
  const lastDay = reports.filter((r) => nowMs - Date.parse(r.created_at) < 24 * 3600_000).length;
  const score = Math.max(0, Math.min(100, 100 - 15 * cancelled - 10 * Math.max(0, lastDay - 3) + 5 * arrived));
  return { score, level: score >= 70 ? "high" : score >= 40 ? "medium" : "low", reports: reports.length, cancelled };
}
