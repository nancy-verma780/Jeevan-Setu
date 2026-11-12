from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.features.auth.deps import get_current_user
from app.features.auth.models import User
from app.features.hospitals.models import Hospital

router = APIRouter(prefix="/api/hospitals", tags=["hospitals"])


class HospitalPin(BaseModel):
    id: int
    name: str
    address: str
    phone: str
    diversion: bool
    lat: float
    lng: float
    services: list[str]
    is_simulated: bool


@router.get("", response_model=list[HospitalPin])
def list_pins(_: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[HospitalPin]:
    hospitals = db.scalars(select(Hospital).where(Hospital.open_for_emergency.is_(True)).order_by(Hospital.name))
    return [
        HospitalPin(
            id=h.id, name=h.name, address=h.address, phone=h.phone, diversion=h.diversion,
            lat=h.lat, lng=h.lng, services=h.services, is_simulated=h.is_simulated,
        )
        for h in hospitals
    ]
