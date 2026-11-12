from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core import clock
from app.core.db import Base
from app.core.enums import Role
from app.core.types import UTCDateTime, str_enum


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    role: Mapped[Role] = mapped_column(str_enum(Role), index=True)
    name: Mapped[str] = mapped_column(String(120), default="")
    phone: Mapped[str | None] = mapped_column(String(16), unique=True)
    email: Mapped[str | None] = mapped_column(String(254), unique=True)
    password_hash: Mapped[str | None] = mapped_column(String(255))
    hospital_id: Mapped[int | None] = mapped_column(ForeignKey("hospitals.id", ondelete="SET NULL"), index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=clock.utcnow)

    hospital = relationship("Hospital", lazy="joined")


class UserSession(Base):
    __tablename__ = "sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=clock.utcnow)
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime)
    revoked_at: Mapped[datetime | None] = mapped_column(UTCDateTime)

    user: Mapped[User] = relationship(lazy="joined")


class OtpChallenge(Base):
    __tablename__ = "otp_challenges"

    id: Mapped[int] = mapped_column(primary_key=True)
    phone: Mapped[str] = mapped_column(String(16), index=True)
    code_hash: Mapped[str] = mapped_column(String(64))
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=clock.utcnow)
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime)
    consumed_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
