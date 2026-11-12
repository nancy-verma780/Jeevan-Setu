from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import get_db
from app.features.auth import service
from app.features.auth.deps import get_current_session, get_current_user
from app.features.auth.models import User, UserSession
from app.features.auth.schemas import MeOut, OtpRequestIn, OtpRequestOut, OtpVerifyIn, PasswordLoginIn

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _me(user: User) -> MeOut:
    return MeOut(
        id=user.id,
        role=user.role,
        name=user.name,
        phone=user.phone,
        email=user.email,
        hospital_id=user.hospital_id,
        hospital_name=user.hospital.name if user.hospital else None,
    )


@router.post("/otp/request", response_model=OtpRequestOut)
def request_otp(body: OtpRequestIn, db: Session = Depends(get_db)) -> OtpRequestOut:
    code, ttl = service.request_otp(db, body.phone)
    # SMS delivery is out of scope for the prototype; dev builds return the code.
    return OtpRequestOut(expires_in_seconds=ttl, dev_code=code if get_settings().expose_dev_otp else None)


@router.post("/otp/verify", response_model=MeOut)
def verify_otp(body: OtpVerifyIn, response: Response, db: Session = Depends(get_db)) -> MeOut:
    user = service.verify_otp(db, body.phone, body.code)
    service.open_session(db, user, response)
    return _me(user)


@router.post("/login", response_model=MeOut)
def password_login(body: PasswordLoginIn, response: Response, db: Session = Depends(get_db)) -> MeOut:
    user = service.authenticate_password(db, body.email, body.password)
    service.open_session(db, user, response)
    return _me(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    response: Response,
    session: UserSession = Depends(get_current_session),
    db: Session = Depends(get_db),
) -> Response:
    service.close_session(db, session, response)
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.get("/me", response_model=MeOut)
def me(user: User = Depends(get_current_user)) -> MeOut:
    return _me(user)
