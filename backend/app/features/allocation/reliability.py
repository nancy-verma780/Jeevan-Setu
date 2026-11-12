"""Hospital Reliability Score: historic acceptance plus reply speed, 0..1."""

from statistics import median

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.enums import AssignmentStatus
from app.features.allocation.models import Assignment
from app.features.allocation.ranking import NEUTRAL_RELIABILITY

HISTORY_WINDOW = 50
_DECIDED = (AssignmentStatus.ACCEPTED, AssignmentStatus.REJECTED, AssignmentStatus.TIMED_OUT)


def reliability_from_history(outcomes: list[tuple[AssignmentStatus, float | None]], timeout_seconds: int) -> float:
    """outcomes: (status, seconds to reply or None when timed out)."""
    if not outcomes:
        return NEUTRAL_RELIABILITY
    accepted = sum(1 for status, _ in outcomes if status is AssignmentStatus.ACCEPTED)
    # Laplace smoothing keeps a hospital with two replies from scoring 0 or 1.
    accept_rate = (accepted + 1) / (len(outcomes) + 2)
    reply_times = [s for status, s in outcomes if status is not AssignmentStatus.TIMED_OUT and s is not None]
    if reply_times:
        speed = max(0.0, 1 - median(reply_times) / timeout_seconds)
    else:
        speed = 0.0
    return round(0.7 * accept_rate + 0.3 * speed, 4)


def reliability_for(db: Session, hospital_ids: list[int], timeout_seconds: int) -> dict[int, float]:
    result: dict[int, float] = {}
    for hospital_id in hospital_ids:
        rows = db.execute(
            select(Assignment.status, Assignment.created_at, Assignment.decided_at)
            .where(Assignment.hospital_id == hospital_id, Assignment.status.in_(_DECIDED))
            .order_by(Assignment.id.desc())
            .limit(HISTORY_WINDOW)
        ).all()
        outcomes = [
            (
                AssignmentStatus(status),
                (decided - created).total_seconds() if decided and status != AssignmentStatus.TIMED_OUT else None,
            )
            for status, created, decided in rows
        ]
        result[hospital_id] = reliability_from_history(outcomes, timeout_seconds)
    return result
