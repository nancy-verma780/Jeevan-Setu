/**
 * Algorithm 1 of the paper: REASSIGN, DECIDE and the periodic timeout check.
 * Each decision first checks the assignment is still PENDING and only then
 * changes it, in one synchronous step, so two clicks (or a click racing the
 * timeout checker) cannot both win. The loser gets HTTP 409.
 */
import { config } from "./config.mjs";
import { conflict, invalid, notFound } from "./http.mjs";
import { notifyEvent } from "./notify.mjs";
import { rank, reliabilityFromHistory } from "./ranking.mjs";
import { currentParams } from "./settings.mjs";

export const DECLINE_REASONS = {
  no_bed: "No free emergency bed",
  specialist_unavailable: "Specialist not available",
  equipment_unavailable: "Equipment not available",
  other: "Other",
};
export const ACTIVE_STATUSES = ["SUBMITTED", "FINDING_HOSPITAL", "AWAITING_HOSPITAL_RESPONSE"];

const nowIso = () => new Date().toISOString();

export function recordEvent(store, request, type, data = {}, actorId = null) {
  store.insert("events", { request_id: request.id, type, data, actor_user_id: actorId, created_at: nowIso() });
  notifyEvent(store, request, type, data);
}

export function markArrived(store, assignment, staff) {
  const request = store.get("requests", assignment.request_id);
  if (assignment.status !== "ACCEPTED" || request.status !== "HOSPITAL_ACCEPTED") throw conflict("Only an accepted request can be marked as arrived.");
  const now = nowIso();
  assignment.arrived_at = now;
  request.status = "PATIENT_ARRIVED";
  request.updated_at = now;
  recordEvent(store, request, "PATIENT_ARRIVED", { hospital_id: assignment.hospital_id, hospital_name: store.get("hospitals", assignment.hospital_id).name }, staff.id);
}

export function audit(store, actorId, action, entityType, entityId) {
  store.insert("audit", { actor_user_id: actorId, action, entity_type: entityType, entity_id: String(entityId), created_at: nowIso() });
}

export function reliabilityFor(store, hospitalIds) {
  const result = {};
  for (const id of hospitalIds) {
    const decided = store
      .filter("assignments", (a) => a.hospital_id === id && ["ACCEPTED", "REJECTED", "TIMED_OUT"].includes(a.status))
      .slice(-50)
      .map((a) => ({
        status: a.status,
        seconds: a.status !== "TIMED_OUT" && a.decided_at ? (Date.parse(a.decided_at) - Date.parse(a.created_at)) / 1000 : null,
      }));
    result[id] = reliabilityFromHistory(decided, config.replyTimeoutSeconds);
  }
  return result;
}

/** Asks the best hospital not yet asked, or ends the search. */
export function reassign(store, request) {
  const asked = new Set(store.filter("assignments", (a) => a.request_id === request.id).map((a) => a.hospital_id));
  const hospitals = store.all("hospitals");
  const candidates = rank(
    request.lat,
    request.lng,
    request.injury_type,
    hospitals,
    asked,
    currentParams(store),
    Date.now(),
    reliabilityFor(store, hospitals.filter((h) => !asked.has(h.id)).map((h) => h.id)),
  );
  if (!candidates.length) {
    request.status = "NO_SUITABLE_HOSPITAL";
    request.updated_at = nowIso();
    recordEvent(store, request, "NO_SUITABLE_HOSPITAL", { hospitals_asked: asked.size });
    return null;
  }
  const best = candidates[0];
  const hospital = store.get("hospitals", best.hospital_id);
  const now = Date.now();
  // At most one pending or accepted assignment per request (the paper's partial unique index).
  if (store.find("assignments", (a) => a.request_id === request.id && ["PENDING", "ACCEPTED"].includes(a.status))) {
    throw conflict("This request already has a hospital working on it.");
  }
  const assignment = store.insert("assignments", {
    request_id: request.id,
    hospital_id: best.hospital_id,
    status: "PENDING",
    ...best,
    candidates_considered: candidates.length,
    created_at: new Date(now).toISOString(),
    deadline_at: new Date(now + config.replyTimeoutSeconds * 1000).toISOString(),
    decided_at: null,
    decided_by_id: null,
    reason: null,
  });
  request.status = "AWAITING_HOSPITAL_RESPONSE";
  request.updated_at = nowIso();
  recordEvent(store, request, "SENT_TO_HOSPITAL", {
    hospital_id: hospital.id,
    hospital_name: hospital.name,
    distance_km: best.distance_km,
    free_beds: hospital.free_beds,
    score: best.score,
    availability_flag: best.availability_flag,
  });
  return assignment;
}

export function startAllocation(store, request) {
  request.status = "FINDING_HOSPITAL";
  return reassign(store, request);
}

/** Lines 7-10 of Algorithm 1. */
export function applyOutcome(store, assignment, outcome, actor, reason = null) {
  const request = store.get("requests", assignment.request_id);
  if (assignment.status !== "PENDING") throw conflict("This request has already been decided.");
  if (request.status !== "AWAITING_HOSPITAL_RESPONSE") throw conflict("The request changed while you were deciding. Refresh and try again.");
  const now = nowIso();
  const hospital = store.get("hospitals", assignment.hospital_id);
  Object.assign(assignment, { status: outcome, decided_at: now, decided_by_id: actor?.id ?? null, reason });

  if (outcome === "ACCEPTED") {
    request.status = "HOSPITAL_ACCEPTED";
    request.updated_at = now;
    const bedReserved = (hospital.free_beds ?? 0) > 0;
    if (bedReserved) {
      hospital.free_beds -= 1;
      hospital.beds_updated_at = now;
    }
    recordEvent(store, request, "HOSPITAL_ACCEPTED", { hospital_id: hospital.id, hospital_name: hospital.name, bed_reserved: bedReserved }, actor?.id ?? null);
    return;
  }
  request.status = "FINDING_HOSPITAL";
  request.updated_at = now;
  const data = { hospital_id: hospital.id, hospital_name: hospital.name };
  if (reason) Object.assign(data, { reason, reason_text: DECLINE_REASONS[reason] });
  recordEvent(store, request, outcome === "REJECTED" ? "HOSPITAL_DECLINED" : "HOSPITAL_TIMED_OUT", data, actor?.id ?? null);
  reassign(store, request);
}

export function assignmentForStaff(store, assignmentId, staff) {
  const assignment = store.get("assignments", assignmentId);
  // Same answer for "missing" and "someone else's", so existence is not revealed.
  if (!assignment || !staff.hospital_id || assignment.hospital_id !== staff.hospital_id) throw notFound("Request not found.");
  return assignment;
}

export function decide(store, assignmentId, staff, action, reason) {
  const assignment = assignmentForStaff(store, assignmentId, staff);
  if (action === "accept") {
    applyOutcome(store, assignment, "ACCEPTED", staff);
    return assignment;
  }
  if (action !== "decline") throw invalid("Action must be accept or decline.");
  if (!DECLINE_REASONS[reason]) throw invalid("Choose a reason for declining.");
  applyOutcome(store, assignment, "REJECTED", staff, reason);
  return assignment;
}

export function checkTimeouts(store, nowMs = Date.now()) {
  let handled = 0;
  for (const a of store.filter("assignments", (x) => x.status === "PENDING" && Date.parse(x.deadline_at) < nowMs)) {
    try {
      applyOutcome(store, a, "TIMED_OUT", null);
      handled += 1;
    } catch {
      /* already decided in the meantime */
    }
  }
  return handled;
}

export function cancelRequest(store, request, reporter) {
  if (!ACTIVE_STATUSES.includes(request.status)) throw conflict("This request can no longer be cancelled.");
  const now = nowIso();
  request.status = "CANCELLED";
  request.updated_at = now;
  for (const a of store.filter("assignments", (x) => x.request_id === request.id && x.status === "PENDING")) {
    Object.assign(a, { status: "CANCELLED", decided_at: now });
  }
  recordEvent(store, request, "CANCELLED", {}, reporter.id);
}
