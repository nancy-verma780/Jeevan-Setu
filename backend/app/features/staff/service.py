from sqlalchemy import case, select
from sqlalchemy.orm import Session

from app.core import clock
from app.core.enums import AssignmentStatus, Priority
from app.features.allocation.models import Assignment
from app.features.auth.models import User
from app.features.emergencies.models import EmergencyRequest
from app.features.emergencies.schemas import ReasonOut
from app.features.staff.schemas import PreArrivalPacket, StaffCaseDetail, StaffQueueRow

QUEUE_STATUSES = {
    "pending": (AssignmentStatus.PENDING,),
    "accepted": (AssignmentStatus.ACCEPTED,),
    "declined": (AssignmentStatus.REJECTED, AssignmentStatus.TIMED_OUT),
}

_PRIORITY_ORDER = case(
    {
        Priority.RED_FLAG.value: 0,
        Priority.NEEDS_REVIEW.value: 1,
        Priority.ELEVATED.value: 2,
        Priority.STANDARD.value: 3,
    },
    value=EmergencyRequest.priority,
)


def _row(a: Assignment) -> StaffQueueRow:
    r = a.request
    left = 0
    if a.status is AssignmentStatus.PENDING:
        left = max(0, int((a.deadline_at - clock.utcnow()).total_seconds()))
    return StaffQueueRow(
        assignment_id=a.id,
        request_code=r.public_code or "",
        priority=r.priority,
        injury_type=r.injury_type,
        patient_age=r.patient_age,
        patient_sex=r.patient_sex,
        distance_km=a.distance_km,
        status=a.status,
        received_at=a.created_at,
        deadline_at=a.deadline_at,
        seconds_left=left,
    )


def queue(db: Session, staff: User, which: str) -> list[StaffQueueRow]:
    assignments = db.scalars(
        select(Assignment)
        .join(EmergencyRequest, Assignment.request_id == EmergencyRequest.id)
        .where(Assignment.hospital_id == staff.hospital_id, Assignment.status.in_(QUEUE_STATUSES[which]))
        .order_by(_PRIORITY_ORDER, Assignment.deadline_at)
        .limit(200)
    ).unique().all()
    return [_row(a) for a in assignments]


def case_detail(a: Assignment) -> StaffCaseDetail:
    r = a.request
    return StaffCaseDetail(
        **_row(a).model_dump(),
        priority_reasons=[ReasonOut(**x) for x in r.priority_reasons],
        rule_set_version=r.rule_set_version,
        symptoms=r.symptoms,
        packet=PreArrivalPacket(
            request_code=r.public_code or "",
            priority=r.priority,
            patient_age=r.patient_age,
            patient_sex=r.patient_sex,
            injury_type=r.injury_type,
            blood_group=r.blood_group,
            allergies=r.allergies,
            description=r.description,
            contact_name=r.contact_name,
            contact_phone=r.contact_phone,
            lat=r.lat,
            lng=r.lng,
            location_source=r.location_source.value,
        ),
        decline_reason=a.reason,
    )
