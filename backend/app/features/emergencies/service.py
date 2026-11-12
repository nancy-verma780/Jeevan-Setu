from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core import clock
from app.core.config import get_settings
from app.core.enums import AssignmentStatus, EventType, RequestStatus
from app.core.errors import Invalid, NotFound
from app.features.allocation.models import Assignment
from app.features.allocation.service import start_allocation
from app.features.auth.models import User
from app.features.emergencies.events import record_event
from app.features.emergencies.models import Consent, EmergencyRequest
from app.features.emergencies.schemas import (
    CurrentHospitalOut,
    EmergencyCreate,
    EmergencyDetail,
    EmergencySummary,
    EventOut,
    RankingTermsOut,
    ReasonOut,
)
from app.features.priority.engine import evaluate


def _find_by_key(db: Session, reporter_id: int, key: str) -> EmergencyRequest | None:
    return db.scalar(
        select(EmergencyRequest).where(
            EmergencyRequest.reporter_id == reporter_id, EmergencyRequest.idempotency_key == key
        )
    )


def create_request(
    db: Session, reporter: User, payload: EmergencyCreate, idempotency_key: str
) -> tuple[EmergencyRequest, bool]:
    """Returns (request, created). A repeated key returns the original request."""
    settings = get_settings()
    if not payload.consent.accepted:
        raise Invalid("Consent is required before a request can be sent.")
    if payload.consent.policy_version != settings.consent_policy_version:
        raise Invalid("The consent text has changed. Read and accept the current version.")

    existing = _find_by_key(db, reporter.id, idempotency_key)
    if existing is not None:
        return existing, False

    symptoms = payload.symptoms.model_dump(mode="json")
    result = evaluate(payload.injury_type, symptoms, payload.patient_age)
    now = clock.utcnow()
    request = EmergencyRequest(
        reporter_id=reporter.id,
        idempotency_key=idempotency_key,
        injury_type=payload.injury_type,
        description=payload.description.strip(),
        symptoms=symptoms,
        patient_age=payload.patient_age,
        patient_sex=payload.patient_sex,
        blood_group=payload.blood_group,
        allergies=(payload.allergies or "").strip() or None,
        contact_name=(payload.contact_name or "").strip() or None,
        contact_phone=payload.contact_phone,
        lat=payload.location.lat,
        lng=payload.location.lng,
        location_source=payload.location.source,
        priority=result.category,
        priority_reasons=[r.as_dict() for r in result.reasons],
        rule_set_version=result.rule_set_version,
        status=RequestStatus.SUBMITTED,
        created_at=now,
    )
    db.add(request)
    try:
        db.flush()
    except IntegrityError:
        # Two submits with the same key raced; the other one won.
        db.rollback()
        existing = _find_by_key(db, reporter.id, idempotency_key)
        if existing is None:
            raise
        return existing, False

    request.public_code = f"JS-{now:%y%m}-{request.id:04d}"
    db.add(Consent(request_id=request.id, user_id=reporter.id, policy_version=payload.consent.policy_version, accepted_at=now))
    record_event(db, request, EventType.SUBMITTED, {"location_source": payload.location.source.value}, reporter.id)
    record_event(
        db,
        request,
        EventType.PRIORITY_SET,
        {
            "priority": result.category.value,
            "reasons": [r.as_dict() for r in result.reasons],
            "rule_set_version": result.rule_set_version,
        },
    )
    db.flush()
    start_allocation(db, request)
    db.commit()
    db.refresh(request)
    return request, True


def get_own_request(db: Session, reporter: User, request_id: int) -> EmergencyRequest:
    request = db.get(EmergencyRequest, request_id)
    if request is None or request.reporter_id != reporter.id:
        raise NotFound("Request not found.")
    return request


def latest_assignment(db: Session, request_id: int) -> Assignment | None:
    return db.scalar(
        select(Assignment).where(Assignment.request_id == request_id).order_by(Assignment.id.desc())
    )


def list_own_requests(db: Session, reporter: User) -> list[EmergencySummary]:
    requests = db.scalars(
        select(EmergencyRequest)
        .where(EmergencyRequest.reporter_id == reporter.id)
        .order_by(EmergencyRequest.id.desc())
        .limit(50)
    ).all()
    summaries = []
    for request in requests:
        assignment = latest_assignment(db, request.id)
        summaries.append(
            EmergencySummary(
                id=request.id,
                public_code=request.public_code or "",
                injury_type=request.injury_type,
                priority=request.priority,
                status=request.status,
                created_at=request.created_at,
                hospital_name=assignment.hospital.name if assignment else None,
            )
        )
    return summaries


def _current_hospital(assignment: Assignment | None) -> CurrentHospitalOut | None:
    if assignment is None or assignment.status not in (AssignmentStatus.PENDING, AssignmentStatus.ACCEPTED):
        return None
    hospital = assignment.hospital
    accepted = assignment.status is AssignmentStatus.ACCEPTED
    seconds_left = max(0, int((assignment.deadline_at - clock.utcnow()).total_seconds()))
    return CurrentHospitalOut(
        assignment_id=assignment.id,
        status=assignment.status,
        hospital_id=hospital.id,
        name=hospital.name,
        services=hospital.services,
        free_beds=hospital.free_beds,
        is_simulated=hospital.is_simulated,
        deadline_at=assignment.deadline_at,
        seconds_left=0 if accepted else seconds_left,
        terms=RankingTermsOut(
            distance_km=assignment.distance_km,
            distance_term=assignment.distance_term,
            resource_term=assignment.resource_term,
            reliability=assignment.reliability,
            reliability_term=assignment.reliability_term,
            score=assignment.score,
            availability_flag=assignment.availability_flag,
        ),
        address=hospital.address if accepted else None,
        phone=hospital.phone if accepted else None,
    )


def to_detail(db: Session, request: EmergencyRequest) -> EmergencyDetail:
    return EmergencyDetail(
        id=request.id,
        public_code=request.public_code or "",
        injury_type=request.injury_type,
        priority=request.priority,
        priority_reasons=[ReasonOut(**r) for r in request.priority_reasons],
        rule_set_version=request.rule_set_version,
        status=request.status,
        created_at=request.created_at,
        lat=request.lat,
        lng=request.lng,
        location_source=request.location_source,
        current_hospital=_current_hospital(latest_assignment(db, request.id)),
        events=[EventOut(id=e.id, type=e.type, data=e.data, created_at=e.created_at) for e in request.events],
    )
