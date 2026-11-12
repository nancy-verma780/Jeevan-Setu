from datetime import datetime

from sqlalchemy import JSON, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core import clock
from app.core.db import Base
from app.core.enums import EventType, InjuryType, LocationSource, Priority, RequestStatus
from app.core.types import UTCDateTime, str_enum


class EmergencyRequest(Base):
    __tablename__ = "emergency_requests"
    __table_args__ = (UniqueConstraint("reporter_id", "idempotency_key"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    public_code: Mapped[str | None] = mapped_column(String(20), unique=True)
    reporter_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    idempotency_key: Mapped[str] = mapped_column(String(100))

    injury_type: Mapped[InjuryType] = mapped_column(str_enum(InjuryType))
    description: Mapped[str] = mapped_column(Text, default="")
    symptoms: Mapped[dict[str, str]] = mapped_column(JSON, default=dict)
    patient_age: Mapped[int | None] = mapped_column(Integer)
    patient_sex: Mapped[str] = mapped_column(String(10), default="unknown")
    blood_group: Mapped[str | None] = mapped_column(String(8))
    allergies: Mapped[str | None] = mapped_column(String(200))
    contact_name: Mapped[str | None] = mapped_column(String(100))
    contact_phone: Mapped[str | None] = mapped_column(String(16))

    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    location_source: Mapped[LocationSource] = mapped_column(str_enum(LocationSource))

    priority: Mapped[Priority] = mapped_column(str_enum(Priority), index=True)
    priority_reasons: Mapped[list[dict]] = mapped_column(JSON, default=list)
    rule_set_version: Mapped[str] = mapped_column(String(20))

    status: Mapped[RequestStatus] = mapped_column(str_enum(RequestStatus), index=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=clock.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=clock.utcnow, onupdate=clock.utcnow)

    events: Mapped[list["Event"]] = relationship(order_by="Event.id", back_populates="request")


class Consent(Base):
    __tablename__ = "consents"

    id: Mapped[int] = mapped_column(primary_key=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("emergency_requests.id", ondelete="CASCADE"), unique=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    policy_version: Mapped[str] = mapped_column(String(20))
    accepted_at: Mapped[datetime] = mapped_column(UTCDateTime, default=clock.utcnow)


class Event(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(primary_key=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("emergency_requests.id", ondelete="CASCADE"), index=True)
    type: Mapped[EventType] = mapped_column(str_enum(EventType))
    data: Mapped[dict] = mapped_column(JSON, default=dict)
    actor_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=clock.utcnow)

    request: Mapped[EmergencyRequest] = relationship(back_populates="events")
