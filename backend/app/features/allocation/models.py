from datetime import datetime

from sqlalchemy import Float, ForeignKey, Index, Integer, String, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core import clock
from app.core.db import Base
from app.core.enums import AssignmentStatus
from app.core.types import UTCDateTime, str_enum

_ONE_LIVE = text("status IN ('PENDING', 'ACCEPTED')")


class Assignment(Base):
    __tablename__ = "assignments"
    __table_args__ = (
        # A hospital is asked at most once per request.
        UniqueConstraint("request_id", "hospital_id"),
        # At most one pending or accepted assignment per request.
        Index(
            "uq_assignments_one_live_per_request",
            "request_id",
            unique=True,
            sqlite_where=_ONE_LIVE,
            postgresql_where=_ONE_LIVE,
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("emergency_requests.id", ondelete="CASCADE"), index=True)
    hospital_id: Mapped[int] = mapped_column(ForeignKey("hospitals.id"), index=True)
    status: Mapped[AssignmentStatus] = mapped_column(str_enum(AssignmentStatus), index=True)

    distance_km: Mapped[float] = mapped_column(Float)
    distance_term: Mapped[float] = mapped_column(Float)
    resource_term: Mapped[float] = mapped_column(Float)
    reliability_term: Mapped[float] = mapped_column(Float)
    reliability: Mapped[float] = mapped_column(Float)
    score: Mapped[float] = mapped_column(Float)
    availability_flag: Mapped[str | None] = mapped_column(String(10))
    candidates_considered: Mapped[int] = mapped_column(Integer, default=1)

    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=clock.utcnow)
    deadline_at: Mapped[datetime] = mapped_column(UTCDateTime, index=True)
    decided_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    decided_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    reason: Mapped[str | None] = mapped_column(String(40))

    hospital = relationship("Hospital", lazy="joined")
    request = relationship("EmergencyRequest", lazy="joined")
