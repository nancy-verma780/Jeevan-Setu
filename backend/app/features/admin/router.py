from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import clock
from app.core.db import get_db
from app.core.enums import Priority, RequestStatus, Role
from app.core.errors import Conflict, Invalid, NotFound
from app.core.security import hash_password
from app.features.admin import service
from app.features.admin.schemas import (
    AdminRequestRow,
    AuditRow,
    HospitalAdminUpdate,
    HospitalCreate,
    OverviewOut,
    StaffCreate,
    StaffRow,
    StaffUpdate,
)
from app.features.audit.models import AuditLog
from app.features.audit.service import record_audit
from app.features.auth.deps import require_admin
from app.features.auth.models import User
from app.features.emergencies.models import EmergencyRequest
from app.features.hospitals.models import Hospital
from app.features.hospitals.schemas import HospitalOut, hospital_out

router = APIRouter(prefix="/api/admin", tags=["admin"])
Format = Literal["json", "csv"]


@router.get("/overview", response_model=OverviewOut)
def overview(_: User = Depends(require_admin), db: Session = Depends(get_db)) -> OverviewOut:
    return service.overview(db)


@router.get("/requests", response_model=list[AdminRequestRow])
def requests(
    status_: RequestStatus | None = Query(default=None, alias="status"),
    priority: Priority | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    q: str | None = Query(default=None, max_length=20),
    format: Format = "json",
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    stmt = select(EmergencyRequest).order_by(EmergencyRequest.id.desc()).limit(500)
    if status_:
        stmt = stmt.where(EmergencyRequest.status == status_)
    if priority:
        stmt = stmt.where(EmergencyRequest.priority == priority)
    if date_from:
        stmt = stmt.where(EmergencyRequest.created_at >= service.day_start(date_from))
    if date_to:
        stmt = stmt.where(EmergencyRequest.created_at <= service.day_end(date_to))
    if q:
        stmt = stmt.where(EmergencyRequest.public_code.contains(q.strip().upper()))
    rows = service.request_rows(db, db.scalars(stmt).all())
    if format == "csv":
        record_audit(db, admin.id, "EXPORT_CSV", "requests", len(rows))
        db.commit()
        return service.csv_response(rows, AdminRequestRow, "jeevansetu-requests.csv")
    return rows


@router.get("/hospitals", response_model=list[HospitalOut])
def hospitals(format: Format = "json", admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    rows = [hospital_out(h) for h in db.scalars(select(Hospital).order_by(Hospital.name))]
    if format == "csv":
        record_audit(db, admin.id, "EXPORT_CSV", "hospitals", len(rows))
        db.commit()
        return service.csv_response(rows, HospitalOut, "jeevansetu-hospitals.csv")
    return rows


@router.post("/hospitals", response_model=HospitalOut, status_code=status.HTTP_201_CREATED)
def create_hospital(body: HospitalCreate, admin: User = Depends(require_admin), db: Session = Depends(get_db)) -> HospitalOut:
    hospital = Hospital(
        name=body.name.strip(),
        address=body.address.strip(),
        phone=body.phone.strip(),
        lat=body.lat,
        lng=body.lng,
        services=sorted({s.value for s in body.services}),
        free_beds=body.free_beds,
        beds_updated_at=clock.utcnow() if body.free_beds is not None else None,
        is_simulated=True,
    )
    db.add(hospital)
    db.flush()
    record_audit(db, admin.id, "CREATE_HOSPITAL", "hospital", hospital.id)
    db.commit()
    return hospital_out(hospital)


@router.patch("/hospitals/{hospital_id}", response_model=HospitalOut)
def update_hospital(
    hospital_id: int, body: HospitalAdminUpdate, admin: User = Depends(require_admin), db: Session = Depends(get_db)
) -> HospitalOut:
    hospital = db.get(Hospital, hospital_id)
    if hospital is None:
        raise NotFound("Hospital not found.")
    for field, value in body.model_dump(exclude_unset=True).items():
        if field == "services":
            value = sorted({s for s in value})
        setattr(hospital, field, value)
    record_audit(db, admin.id, "UPDATE_HOSPITAL", "hospital", hospital.id)
    db.commit()
    return hospital_out(hospital)


def _staff_row(u: User) -> StaffRow:
    return StaffRow(
        id=u.id,
        name=u.name,
        email=u.email or "",
        hospital_id=u.hospital_id,
        hospital_name=u.hospital.name if u.hospital else None,
        is_active=u.is_active,
        created_at=u.created_at,
    )


@router.get("/staff", response_model=list[StaffRow])
def staff(
    hospital_id: int | None = None,
    active: bool | None = None,
    format: Format = "json",
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    stmt = select(User).where(User.role == Role.STAFF).order_by(User.name)
    if hospital_id is not None:
        stmt = stmt.where(User.hospital_id == hospital_id)
    if active is not None:
        stmt = stmt.where(User.is_active.is_(active))
    rows = [_staff_row(u) for u in db.scalars(stmt).unique()]
    if format == "csv":
        record_audit(db, admin.id, "EXPORT_CSV", "staff", len(rows))
        db.commit()
        return service.csv_response(rows, StaffRow, "jeevansetu-staff.csv")
    return rows


@router.post("/staff", response_model=StaffRow, status_code=status.HTTP_201_CREATED)
def create_staff(body: StaffCreate, admin: User = Depends(require_admin), db: Session = Depends(get_db)) -> StaffRow:
    if db.get(Hospital, body.hospital_id) is None:
        raise Invalid("Choose an existing hospital.")
    email = body.email.lower()
    if db.scalar(select(User.id).where(User.email == email)) is not None:
        raise Conflict("An account with this email already exists.")
    user = User(role=Role.STAFF, name=body.name.strip(), email=email, password_hash=hash_password(body.password), hospital_id=body.hospital_id)
    db.add(user)
    db.flush()
    record_audit(db, admin.id, "CREATE_STAFF", "user", user.id)
    db.commit()
    db.refresh(user)
    return _staff_row(user)


@router.patch("/staff/{user_id}", response_model=StaffRow)
def update_staff(user_id: int, body: StaffUpdate, admin: User = Depends(require_admin), db: Session = Depends(get_db)) -> StaffRow:
    user = db.get(User, user_id)
    if user is None or user.role is not Role.STAFF:
        raise NotFound("Staff account not found.")
    changes = body.model_dump(exclude_unset=True)
    if "hospital_id" in changes and db.get(Hospital, changes["hospital_id"]) is None:
        raise Invalid("Choose an existing hospital.")
    for field, value in changes.items():
        setattr(user, field, value)
    record_audit(db, admin.id, "UPDATE_STAFF", "user", user.id)
    db.commit()
    db.refresh(user)
    return _staff_row(user)


@router.get("/audit", response_model=list[AuditRow])
def audit(
    action: str | None = Query(default=None, max_length=40),
    actor_user_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    format: Format = "json",
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    stmt = select(AuditLog).order_by(AuditLog.id.desc()).limit(1000)
    if action:
        stmt = stmt.where(AuditLog.action == action.upper())
    if actor_user_id is not None:
        stmt = stmt.where(AuditLog.actor_user_id == actor_user_id)
    if date_from:
        stmt = stmt.where(AuditLog.created_at >= service.day_start(date_from))
    if date_to:
        stmt = stmt.where(AuditLog.created_at <= service.day_end(date_to))
    rows = [
        AuditRow(id=a.id, created_at=a.created_at, actor_user_id=a.actor_user_id, action=a.action, entity_type=a.entity_type, entity_id=a.entity_id)
        for a in db.scalars(stmt)
    ]
    if format == "csv":
        record_audit(db, admin.id, "EXPORT_CSV", "audit", len(rows))
        db.commit()
        return service.csv_response(rows, AuditRow, "jeevansetu-audit.csv")
    return rows
