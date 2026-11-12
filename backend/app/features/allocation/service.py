"""Algorithm 1 of the paper: REASSIGN, DECIDE and the periodic timeout check.

Every decision is a conditional UPDATE that only succeeds while the row is in
the expected state, so two clicks (or a click racing the timeout checker)
cannot both win. The loser gets a Conflict (HTTP 409).
"""

from datetime import datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core import clock
from app.core.config import get_settings
from app.core.enums import (
    ACTIVE_REQUEST_STATUSES,
    AssignmentStatus,
    EventType,
    RequestStatus,
)
from app.core.errors import Conflict, Invalid, NotFound
from app.features.allocation.models import Assignment
from app.features.allocation.ranking import RankingParams, rank
from app.features.allocation.reliability import reliability_for
from app.features.auth.models import User
from app.features.emergencies.events import record_event
from app.features.emergencies.models import EmergencyRequest
from app.features.hospitals.models import Hospital

DECLINE_REASONS = {
    "no_bed": "No free emergency bed",
    "specialist_unavailable": "Specialist not available",
    "equipment_unavailable": "Equipment not available",
    "other": "Other",
}


def reassign(db: Session, request: EmergencyRequest) -> Assignment | None:
    """Asks the best remaining hospital, or ends the search. Caller commits."""
    settings = get_settings()
    now = clock.utcnow()
    asked = set(db.scalars(select(Assignment.hospital_id).where(Assignment.request_id == request.id)))
    hospitals = db.scalars(select(Hospital)).all()
    reliability = reliability_for(db, [h.id for h in hospitals if h.id not in asked], settings.reply_timeout_seconds)
    candidates = rank(
        request.lat,
        request.lng,
        request.injury_type,
        hospitals,
        asked,
        RankingParams.from_settings(settings),
        now,
        reliability,
    )

    if not candidates:
        request.status = RequestStatus.NO_SUITABLE_HOSPITAL
        record_event(db, request, EventType.NO_SUITABLE_HOSPITAL, {"hospitals_asked": len(asked)})
        db.flush()
        return None

    best = candidates[0]
    hospital = next(h for h in hospitals if h.id == best.hospital_id)
    assignment = Assignment(
        request_id=request.id,
        hospital_id=best.hospital_id,
        status=AssignmentStatus.PENDING,
        distance_km=best.distance_km,
        distance_term=best.distance_term,
        resource_term=best.resource_term,
        reliability=best.reliability,
        reliability_term=best.reliability_term,
        score=best.score,
        availability_flag=best.availability_flag,
        candidates_considered=len(candidates),
        created_at=now,
        deadline_at=now + timedelta(seconds=settings.reply_timeout_seconds),
    )
    db.add(assignment)
    request.status = RequestStatus.AWAITING_HOSPITAL_RESPONSE
    record_event(
        db,
        request,
        EventType.SENT_TO_HOSPITAL,
        {
            "hospital_id": hospital.id,
            "hospital_name": hospital.name,
            "distance_km": best.distance_km,
            "free_beds": hospital.free_beds,
            "score": best.score,
            "availability_flag": best.availability_flag,
        },
    )
    try:
        db.flush()
    except IntegrityError as exc:
        raise Conflict("This request already has a hospital working on it.") from exc
    return assignment


def start_allocation(db: Session, request: EmergencyRequest) -> Assignment | None:
    request.status = RequestStatus.FINDING_HOSPITAL
    db.flush()
    return reassign(db, request)


def _close_assignment(
    db: Session,
    assignment_id: int,
    outcome: AssignmentStatus,
    actor: User | None,
    reason: str | None,
    now: datetime,
) -> None:
    result = db.execute(
        update(Assignment)
        .where(Assignment.id == assignment_id, Assignment.status == AssignmentStatus.PENDING)
        .values(status=outcome, decided_at=now, decided_by_id=actor.id if actor else None, reason=reason)
        .execution_options(synchronize_session=False)
    )
    if result.rowcount == 0:
        raise Conflict("This request has already been decided.")


def _move_request(db: Session, request_id: int, expected: tuple[RequestStatus, ...], new: RequestStatus) -> None:
    result = db.execute(
        update(EmergencyRequest)
        .where(EmergencyRequest.id == request_id, EmergencyRequest.status.in_(expected))
        .values(status=new, updated_at=clock.utcnow())
        .execution_options(synchronize_session=False)
    )
    if result.rowcount == 0:
        raise Conflict("The request changed while you were deciding. Refresh and try again.")


def apply_outcome(
    db: Session,
    assignment: Assignment,
    outcome: AssignmentStatus,
    actor: User | None,
    reason: str | None = None,
) -> None:
    """Lines 7-10 of Algorithm 1. Caller commits, or rolls back on Conflict."""
    now = clock.utcnow()
    _close_assignment(db, assignment.id, outcome, actor, reason, now)
    request = assignment.request
    actor_id = actor.id if actor else None

    if outcome is AssignmentStatus.ACCEPTED:
        _move_request(
            db, request.id, (RequestStatus.AWAITING_HOSPITAL_RESPONSE,), RequestStatus.HOSPITAL_ACCEPTED
        )
        bed = db.execute(
            update(Hospital)
            .where(Hospital.id == assignment.hospital_id, Hospital.free_beds > 0)
            .values(free_beds=Hospital.free_beds - 1, beds_updated_at=now)
            .execution_options(synchronize_session=False)
        )
        record_event(
            db,
            request,
            EventType.HOSPITAL_ACCEPTED,
            {
                "hospital_id": assignment.hospital_id,
                "hospital_name": assignment.hospital.name,
                "bed_reserved": bed.rowcount == 1,
            },
            actor_id,
        )
        db.flush()
        db.refresh(request)
        return

    _move_request(db, request.id, (RequestStatus.AWAITING_HOSPITAL_RESPONSE,), RequestStatus.FINDING_HOSPITAL)
    event_type = EventType.HOSPITAL_DECLINED if outcome is AssignmentStatus.REJECTED else EventType.HOSPITAL_TIMED_OUT
    data = {"hospital_id": assignment.hospital_id, "hospital_name": assignment.hospital.name}
    if reason:
        data["reason"] = reason
        data["reason_text"] = DECLINE_REASONS[reason]
    record_event(db, request, event_type, data, actor_id)
    db.flush()
    db.refresh(request)
    reassign(db, request)


def get_assignment_for_staff(db: Session, assignment_id: int, staff: User) -> Assignment:
    assignment = db.get(Assignment, assignment_id)
    # Same answer for "missing" and "someone else's", so existence is not revealed.
    if assignment is None or staff.hospital_id is None or assignment.hospital_id != staff.hospital_id:
        raise NotFound("Request not found.")
    return assignment


def decide(db: Session, assignment_id: int, staff: User, action: str, reason: str | None) -> Assignment:
    assignment = get_assignment_for_staff(db, assignment_id, staff)
    if action == "accept":
        outcome, reason = AssignmentStatus.ACCEPTED, None
    elif action == "decline":
        if reason not in DECLINE_REASONS:
            raise Invalid("Choose a reason for declining.")
        outcome = AssignmentStatus.REJECTED
    else:
        raise Invalid("Action must be accept or decline.")
    try:
        apply_outcome(db, assignment, outcome, staff, reason)
        db.commit()
    except Conflict:
        db.rollback()
        raise
    db.refresh(assignment)
    return assignment


def check_timeouts(db: Session, now: datetime | None = None) -> int:
    """Marks overdue PENDING assignments TIMED_OUT and moves each request on."""
    now = now or clock.utcnow()
    overdue = db.scalars(
        select(Assignment.id).where(
            Assignment.status == AssignmentStatus.PENDING, Assignment.deadline_at < now
        )
    ).all()
    handled = 0
    for assignment_id in overdue:
        assignment = db.get(Assignment, assignment_id)
        if assignment is None:
            continue
        try:
            apply_outcome(db, assignment, AssignmentStatus.TIMED_OUT, None)
            db.commit()
            handled += 1
        except Conflict:
            db.rollback()
    return handled


def cancel_request(db: Session, request: EmergencyRequest, reporter: User) -> None:
    try:
        _move_request(db, request.id, ACTIVE_REQUEST_STATUSES, RequestStatus.CANCELLED)
    except Conflict as exc:
        db.rollback()
        raise Conflict("This request can no longer be cancelled.") from exc
    db.execute(
        update(Assignment)
        .where(Assignment.request_id == request.id, Assignment.status == AssignmentStatus.PENDING)
        .values(status=AssignmentStatus.CANCELLED, decided_at=clock.utcnow())
        .execution_options(synchronize_session=False)
    )
    record_event(db, request, EventType.CANCELLED, {}, reporter.id)
    db.commit()
    db.refresh(request)
