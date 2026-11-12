from typing import Literal

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core import clock
from app.core.db import get_db
from app.core.errors import NotFound
from app.features.allocation import service as allocation
from app.features.audit.service import record_audit
from app.features.auth.deps import require_staff
from app.features.auth.models import User
from app.features.hospitals.models import Hospital
from app.features.hospitals.schemas import HospitalOut, HospitalResourcesUpdate, hospital_out
from app.features.staff import service
from app.features.staff.schemas import DecisionIn, StaffCaseDetail, StaffQueueRow

router = APIRouter(prefix="/api/staff", tags=["hospital staff"])


def _own_assignment(db: Session, assignment_id: int, staff: User):
    try:
        return allocation.get_assignment_for_staff(db, assignment_id, staff)
    except NotFound:
        record_audit(db, staff.id, "ACCESS_DENIED", "assignment", assignment_id)
        db.commit()
        raise


@router.get("/requests", response_model=list[StaffQueueRow])
def list_requests(
    status: Literal["pending", "accepted", "declined"] = "pending",
    staff: User = Depends(require_staff),
    db: Session = Depends(get_db),
) -> list[StaffQueueRow]:
    return service.queue(db, staff, status)


@router.get("/requests/{assignment_id}", response_model=StaffCaseDetail)
def get_request(assignment_id: int, staff: User = Depends(require_staff), db: Session = Depends(get_db)) -> StaffCaseDetail:
    assignment = _own_assignment(db, assignment_id, staff)
    record_audit(db, staff.id, "VIEW_CASE", "assignment", assignment.id)
    db.commit()
    return service.case_detail(assignment)


@router.post("/requests/{assignment_id}/decision", response_model=StaffCaseDetail)
def decide(
    assignment_id: int,
    body: DecisionIn,
    staff: User = Depends(require_staff),
    db: Session = Depends(get_db),
) -> StaffCaseDetail:
    _own_assignment(db, assignment_id, staff)
    assignment = allocation.decide(db, assignment_id, staff, body.action, body.reason)
    record_audit(db, staff.id, f"DECISION_{body.action.upper()}", "assignment", assignment.id)
    db.commit()
    return service.case_detail(assignment)


@router.get("/hospital", response_model=HospitalOut)
def get_hospital(staff: User = Depends(require_staff), db: Session = Depends(get_db)) -> HospitalOut:
    hospital = db.get(Hospital, staff.hospital_id)
    if hospital is None:
        raise NotFound("Your account is not linked to a hospital.")
    return hospital_out(hospital)


@router.patch("/hospital", response_model=HospitalOut)
def update_hospital(
    body: HospitalResourcesUpdate,
    staff: User = Depends(require_staff),
    db: Session = Depends(get_db),
) -> HospitalOut:
    hospital = db.get(Hospital, staff.hospital_id)
    if hospital is None:
        raise NotFound("Your account is not linked to a hospital.")
    changes = body.model_dump(exclude_unset=True)
    if "free_beds" in changes:
        hospital.free_beds = changes["free_beds"]
        hospital.beds_updated_at = clock.utcnow()
    if "services" in changes:
        hospital.services = sorted({s.value for s in body.services or []})
    if "diversion" in changes:
        hospital.diversion = bool(changes["diversion"])
    if "open_for_emergency" in changes:
        hospital.open_for_emergency = bool(changes["open_for_emergency"])
    record_audit(db, staff.id, "UPDATE_RESOURCES", "hospital", hospital.id)
    db.commit()
    db.refresh(hospital)
    return hospital_out(hospital)
