from datetime import datetime

from pydantic import BaseModel, Field

from app.core.enums import InjuryType, Priority, RequestStatus, Service


class OverviewOut(BaseModel):
    total_requests: int
    by_status: dict[str, int]
    median_response_seconds: float | None
    accept_rate: float | None
    no_hospital_cases: int


class AdminRequestRow(BaseModel):
    id: int
    public_code: str
    created_at: datetime
    injury_type: InjuryType
    priority: Priority
    status: RequestStatus
    hospitals_asked: int
    current_hospital: str | None
    lat: float
    lng: float


class StaffRow(BaseModel):
    id: int
    name: str
    email: str
    hospital_id: int | None
    hospital_name: str | None
    is_active: bool
    created_at: datetime


class StaffCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: str = Field(max_length=254, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(min_length=10, max_length=200)
    hospital_id: int


class StaffUpdate(BaseModel):
    is_active: bool | None = None
    hospital_id: int | None = None


class HospitalCreate(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    address: str = Field(default="", max_length=255)
    phone: str = Field(default="", max_length=20)
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    services: list[Service] = Field(min_length=1)
    free_beds: int | None = Field(default=None, ge=0, le=500)


class HospitalAdminUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=160)
    address: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=20)
    services: list[Service] | None = None
    open_for_emergency: bool | None = None
    diversion: bool | None = None


class AuditRow(BaseModel):
    id: int
    created_at: datetime
    actor_user_id: int | None
    action: str
    entity_type: str
    entity_id: str
