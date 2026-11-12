from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.enums import (
    Answer,
    AssignmentStatus,
    EventType,
    InjuryType,
    LocationSource,
    Priority,
    RequestStatus,
)
from app.core.phone import normalise_indian_mobile


class SymptomsIn(BaseModel):
    """Every answer defaults to unknown. A missing answer is never read as no."""

    model_config = ConfigDict(extra="forbid")

    unresponsive: Answer = Answer.UNKNOWN
    breathing_difficulty: Answer = Answer.UNKNOWN
    heavy_bleeding: Answer = Answer.UNKNOWN
    chest_pain: Answer = Answer.UNKNOWN
    seizure_now: Answer = Answer.UNKNOWN
    minor_bleeding: Answer = Answer.UNKNOWN
    severe_pain: Answer = Answer.UNKNOWN
    suspected_fracture: Answer = Answer.UNKNOWN


class LocationIn(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    source: LocationSource


class ConsentIn(BaseModel):
    accepted: bool
    policy_version: str = Field(min_length=1, max_length=20)


class EmergencyCreate(BaseModel):
    injury_type: InjuryType
    symptoms: SymptomsIn = Field(default_factory=SymptomsIn)
    location: LocationIn
    consent: ConsentIn
    patient_age: int | None = Field(default=None, ge=0, le=120)
    patient_sex: Literal["female", "male", "other", "unknown"] = "unknown"
    description: str = Field(default="", max_length=1000)
    contact_name: str | None = Field(default=None, max_length=100)
    contact_phone: str | None = None
    blood_group: Literal["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] | None = None
    allergies: str | None = Field(default=None, max_length=200)

    @field_validator("contact_phone")
    @classmethod
    def _contact_phone(cls, value: str | None) -> str | None:
        return normalise_indian_mobile(value) if value else None


class ReasonOut(BaseModel):
    rule: str
    text: str
    field: str | None = None


class EventOut(BaseModel):
    id: int
    type: EventType
    data: dict
    created_at: datetime


class RankingTermsOut(BaseModel):
    distance_km: float
    distance_term: float
    resource_term: float
    reliability: float
    reliability_term: float
    score: float
    availability_flag: str | None


class CurrentHospitalOut(BaseModel):
    assignment_id: int
    status: AssignmentStatus
    hospital_id: int
    name: str
    services: list[str]
    free_beds: int | None
    is_simulated: bool
    deadline_at: datetime
    seconds_left: int
    terms: RankingTermsOut
    # Contact details are shown only after the hospital accepts.
    address: str | None = None
    phone: str | None = None


class EmergencySummary(BaseModel):
    id: int
    public_code: str
    injury_type: InjuryType
    priority: Priority
    status: RequestStatus
    created_at: datetime
    hospital_name: str | None


class EmergencyDetail(BaseModel):
    id: int
    public_code: str
    injury_type: InjuryType
    priority: Priority
    priority_reasons: list[ReasonOut]
    rule_set_version: str
    status: RequestStatus
    created_at: datetime
    lat: float
    lng: float
    location_source: LocationSource
    current_hospital: CurrentHospitalOut | None
    events: list[EventOut]
