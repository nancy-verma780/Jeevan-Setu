from datetime import datetime

from pydantic import BaseModel, Field

from app.core.enums import Service


class HospitalOut(BaseModel):
    id: int
    name: str
    address: str
    phone: str
    lat: float
    lng: float
    services: list[Service]
    free_beds: int | None
    beds_updated_at: datetime | None
    open_for_emergency: bool
    diversion: bool
    is_simulated: bool


class HospitalResourcesUpdate(BaseModel):
    free_beds: int | None = Field(default=None, ge=0, le=500)
    services: list[Service] | None = None
    diversion: bool | None = None
    open_for_emergency: bool | None = None


def hospital_out(h) -> HospitalOut:
    return HospitalOut(
        id=h.id,
        name=h.name,
        address=h.address,
        phone=h.phone,
        lat=h.lat,
        lng=h.lng,
        services=h.services,
        free_beds=h.free_beds,
        beds_updated_at=h.beds_updated_at,
        open_for_emergency=h.open_for_emergency,
        diversion=h.diversion,
        is_simulated=h.is_simulated,
    )
