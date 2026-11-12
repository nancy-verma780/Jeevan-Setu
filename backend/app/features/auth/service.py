from datetime import timedelta

from fastapi import Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core import clock
from app.core.config import get_settings
from app.core.enums import Role
from app.core.errors import Invalid, TooManyRequests
from app.core.security import (
    hash_otp,
    hash_password,
    hash_token,
    new_otp_code,
    new_session_token,
    otp_matches,
    verify_password,
)
from app.features.audit.service import record_audit
from app.features.auth.models import OtpChallenge, User, UserSession


def request_otp(db: Session, phone: str) -> tuple[str, int]:
    settings = get_settings()
    now = clock.utcnow()
    recent = db.scalar(
        select(func.count(OtpChallenge.id)).where(
            OtpChallenge.phone == phone,
            OtpChallenge.created_at > now - timedelta(seconds=settings.otp_window_seconds),
        )
    )
    if recent >= settings.otp_max_requests_per_window:
        raise TooManyRequests("Too many codes requested. Wait 10 minutes and try again.")
    code = new_otp_code()
    db.add(
        OtpChallenge(
            phone=phone,
            code_hash=hash_otp(phone, code, settings.otp_pepper),
            created_at=now,
            expires_at=now + timedelta(seconds=settings.otp_ttl_seconds),
        )
    )
    db.commit()
    return code, settings.otp_ttl_seconds


def verify_otp(db: Session, phone: str, code: str) -> User:
    settings = get_settings()
    now = clock.utcnow()
    challenge = db.scalar(
        select(OtpChallenge)
        .where(OtpChallenge.phone == phone, OtpChallenge.consumed_at.is_(None), OtpChallenge.expires_at > now)
        .order_by(OtpChallenge.id.desc())
    )
    if challenge is None:
        raise Invalid("This code has expired. Ask for a new one.")
    if challenge.attempts >= settings.otp_max_attempts:
        raise TooManyRequests("Too many wrong codes. Ask for a new one.")
    if not otp_matches(challenge.code_hash, phone, code, settings.otp_pepper):
        challenge.attempts += 1
        db.commit()
        raise Invalid("That code is not right. Check the SMS and try again.")
    challenge.consumed_at = now

    user = db.scalar(select(User).where(User.phone == phone))
    if user is None:
        user = User(role=Role.CITIZEN, phone=phone, name="")
        db.add(user)
        db.flush()
    elif user.role is not Role.CITIZEN or not user.is_active:
        raise Invalid("This number cannot sign in here.")
    return user


def authenticate_password(db: Session, email: str, password: str) -> User:
    user = db.scalar(select(User).where(User.email == email.lower()))
    valid = verify_password(user.password_hash if user else None, password)
    if not valid or user is None or not user.is_active or user.role is Role.CITIZEN:
        raise Invalid("Email or password is wrong.")
    return user


def open_session(db: Session, user: User, response: Response) -> None:
    settings = get_settings()
    token = new_session_token()
    now = clock.utcnow()
    db.add(
        UserSession(
            user_id=user.id,
            token_hash=hash_token(token),
            created_at=now,
            expires_at=now + timedelta(hours=settings.session_ttl_hours),
        )
    )
    record_audit(db, user.id, "LOGIN", "user", user.id)
    db.commit()
    response.set_cookie(
        settings.session_cookie_name,
        token,
        max_age=settings.session_ttl_hours * 3600,
        httponly=True,
        samesite="strict",
        secure=settings.cookie_secure,
        path="/",
    )


def close_session(db: Session, session: UserSession, response: Response) -> None:
    session.revoked_at = clock.utcnow()
    record_audit(db, session.user_id, "LOGOUT", "user", session.user_id)
    db.commit()
    response.delete_cookie(get_settings().session_cookie_name, path="/")


def set_password(user: User, password: str) -> None:
    user.password_hash = hash_password(password)
