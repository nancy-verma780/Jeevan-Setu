from fastapi import APIRouter, Depends, Header, Response, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.features.allocation.service import cancel_request
from app.features.auth.deps import require_citizen
from app.features.auth.models import User
from app.features.emergencies import service
from app.features.emergencies.schemas import EmergencyCreate, EmergencyDetail, EmergencySummary

router = APIRouter(prefix="/api/emergencies", tags=["emergencies"])

IDEMPOTENCY_KEY = Header(
    alias="Idempotency-Key",
    min_length=8,
    max_length=100,
    pattern=r"^[A-Za-z0-9_-]+$",
    description="A new random key per report. Resending the same key returns the first request.",
)


@router.post("", response_model=EmergencyDetail, status_code=status.HTTP_201_CREATED)
def create_emergency(
    body: EmergencyCreate,
    response: Response,
    idempotency_key: str = IDEMPOTENCY_KEY,
    user: User = Depends(require_citizen),
    db: Session = Depends(get_db),
) -> EmergencyDetail:
    request, created = service.create_request(db, user, body, idempotency_key)
    if not created:
        response.status_code = status.HTTP_200_OK
    return service.to_detail(db, request)


@router.get("", response_model=list[EmergencySummary])
def list_emergencies(user: User = Depends(require_citizen), db: Session = Depends(get_db)) -> list[EmergencySummary]:
    return service.list_own_requests(db, user)


@router.get("/{request_id}", response_model=EmergencyDetail)
def get_emergency(request_id: int, user: User = Depends(require_citizen), db: Session = Depends(get_db)) -> EmergencyDetail:
    return service.to_detail(db, service.get_own_request(db, user, request_id))


@router.post("/{request_id}/cancel", response_model=EmergencyDetail)
def cancel_emergency(request_id: int, user: User = Depends(require_citizen), db: Session = Depends(get_db)) -> EmergencyDetail:
    request = service.get_own_request(db, user, request_id)
    cancel_request(db, request, user)
    return service.to_detail(db, request)
