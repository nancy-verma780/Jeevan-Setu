from collections.abc import Callable

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import clock
from app.core.config import get_settings
from app.core.db import get_db
from app.core.enums import Role
from app.core.security import hash_token
from app.features.auth.models import User, UserSession


def get_current_session(request: Request, db: Session = Depends(get_db)) -> UserSession:
    token = request.cookies.get(get_settings().session_cookie_name)
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sign in to continue.")
    session = db.scalar(
        select(UserSession).where(
            UserSession.token_hash == hash_token(token),
            UserSession.revoked_at.is_(None),
            UserSession.expires_at > clock.utcnow(),
        )
    )
    if session is None or not session.user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Your session has ended. Sign in again.")
    return session


def get_current_user(session: UserSession = Depends(get_current_session)) -> User:
    return session.user


def require_roles(*roles: Role) -> Callable[..., User]:
    def _dependency(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have access to this page.")
        return user

    return _dependency


require_citizen = require_roles(Role.CITIZEN)
require_staff = require_roles(Role.STAFF)
require_admin = require_roles(Role.ADMIN)
