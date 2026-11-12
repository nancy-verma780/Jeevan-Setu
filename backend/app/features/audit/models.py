from datetime import datetime

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core import clock
from app.core.db import Base
from app.core.types import UTCDateTime


class AuditLog(Base):
    """Identifiers only: never patient details, phone numbers or credentials."""

    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    actor_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True)
    action: Mapped[str] = mapped_column(String(40), index=True)
    entity_type: Mapped[str] = mapped_column(String(40))
    entity_id: Mapped[str] = mapped_column(String(40))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=clock.utcnow, index=True)
