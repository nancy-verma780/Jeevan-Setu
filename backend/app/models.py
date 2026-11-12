"""Imports every model so metadata is complete for Alembic and create_all."""

from app.features.allocation.models import Assignment
from app.features.audit.models import AuditLog
from app.features.auth.models import OtpChallenge, User, UserSession
from app.features.emergencies.models import Consent, EmergencyRequest, Event
from app.features.hospitals.models import Hospital
from app.features.images.models import ImageRecord

__all__ = [
    "Assignment",
    "AuditLog",
    "Consent",
    "EmergencyRequest",
    "Event",
    "Hospital",
    "ImageRecord",
    "OtpChallenge",
    "User",
    "UserSession",
]
