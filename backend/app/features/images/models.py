from datetime import datetime

from sqlalchemy import JSON, Boolean, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core import clock
from app.core.db import Base
from app.core.types import UTCDateTime


class ImageRecord(Base):
    """Metadata only. The re-encoded file lives in the private image store."""

    __tablename__ = "images"

    id: Mapped[int] = mapped_column(primary_key=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("emergency_requests.id", ondelete="CASCADE"), index=True)
    uploaded_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    storage_key: Mapped[str] = mapped_column(String(80), unique=True)
    mime_type: Mapped[str] = mapped_column(String(20))
    width: Mapped[int] = mapped_column(Integer)
    height: Mapped[int] = mapped_column(Integer)
    size_bytes: Mapped[int] = mapped_column(Integer)
    quality_flags: Mapped[list[str]] = mapped_column(JSON, default=list)
    analyzer_name: Mapped[str | None] = mapped_column(String(60))
    analyzer_version: Mapped[str | None] = mapped_column(String(20))
    prediction: Mapped[str | None] = mapped_column(String(40))
    confidence: Mapped[float | None] = mapped_column(Float)
    abstained: Mapped[bool | None] = mapped_column(Boolean)
    heatmap_key: Mapped[str | None] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=clock.utcnow)
