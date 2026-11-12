from datetime import datetime

from sqlalchemy import JSON, Boolean, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core import clock
from app.core.db import Base
from app.core.types import UTCDateTime


class Hospital(Base):
    __tablename__ = "hospitals"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(160))
    address: Mapped[str] = mapped_column(String(255), default="")
    phone: Mapped[str] = mapped_column(String(20), default="")
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    services: Mapped[list[str]] = mapped_column(JSON, default=list)
    free_beds: Mapped[int | None] = mapped_column(Integer)
    beds_updated_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    open_for_emergency: Mapped[bool] = mapped_column(Boolean, default=True)
    diversion: Mapped[bool] = mapped_column(Boolean, default=False)
    is_simulated: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=clock.utcnow)
