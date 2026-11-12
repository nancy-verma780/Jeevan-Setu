from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.core.enums import AssignmentStatus, InjuryType, Priority
from app.features.emergencies.schemas import ReasonOut


class StaffQueueRow(BaseModel):
    assignment_id: int
    request_code: str
    priority: Priority
    injury_type: InjuryType
    patient_age: int | None
    patient_sex: str
    distance_km: float
    status: AssignmentStatus
    received_at: datetime
    deadline_at: datetime
    seconds_left: int


class PreArrivalPacket(BaseModel):
    request_code: str
    priority: Priority
    patient_age: int | None
    patient_sex: str
    injury_type: InjuryType
    blood_group: str | None
    allergies: str | None
    description: str
    contact_name: str | None
    contact_phone: str | None
    lat: float
    lng: float
    location_source: str


class StaffCaseDetail(StaffQueueRow):
    priority_reasons: list[ReasonOut]
    rule_set_version: str
    symptoms: dict[str, str]
    packet: PreArrivalPacket
    decline_reason: str | None


class DecisionIn(BaseModel):
    action: Literal["accept", "decline"]
    reason: Literal["no_bed", "specialist_unavailable", "equipment_unavailable", "other"] | None = None
