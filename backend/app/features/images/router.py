from typing import Literal

from fastapi import APIRouter, Depends, File, Response, UploadFile, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import get_db
from app.core.errors import Invalid, NotFound
from app.features.allocation.service import get_assignment_for_staff
from app.features.audit.service import record_audit
from app.features.auth.deps import get_current_user, require_citizen, require_staff
from app.features.auth.models import User
from app.features.emergencies.service import get_own_request
from app.features.images import service, store
from app.features.images.schemas import ImageOut

router = APIRouter(prefix="/api", tags=["images"])


@router.post("/emergencies/{request_id}/images", response_model=ImageOut, status_code=status.HTTP_201_CREATED)
async def upload_image(
    request_id: int,
    photo: UploadFile = File(...),
    user: User = Depends(require_citizen),
    db: Session = Depends(get_db),
) -> ImageOut:
    request = get_own_request(db, user, request_id)
    data = await photo.read(get_settings().image_max_bytes + 1)
    if not data:
        raise Invalid("The photo is empty. Take it again.", code="corrupt")
    return service.to_out(service.upload(db, request, user, data))


@router.get("/staff/requests/{assignment_id}/images", response_model=list[ImageOut])
def list_case_images(assignment_id: int, staff: User = Depends(require_staff), db: Session = Depends(get_db)) -> list[ImageOut]:
    try:
        assignment = get_assignment_for_staff(db, assignment_id, staff)
    except NotFound:
        record_audit(db, staff.id, "ACCESS_DENIED", "assignment", assignment_id)
        db.commit()
        raise
    return [service.to_out(r) for r in service.images_for_request(db, assignment.request_id)]


@router.get("/model")
def model_info(user: User = Depends(get_current_user)) -> dict:
    from app.features.images.analyzer import get_analyzer

    analyzer = get_analyzer()
    loaded = analyzer.name != "none"
    return {
        "loaded": loaded,
        "message": None if loaded else "No trained model installed",
        "name": analyzer.name if loaded else None,
        "classes": list(getattr(analyzer, "classes", [])) or None,
        "tau": getattr(analyzer, "tau", None),
        "metrics": None,
        "trained_at": None,
    }


@router.get("/staff/images/{image_id}", response_class=Response)
def view_image(
    image_id: int,
    variant: Literal["photo", "heatmap"] = "photo",
    staff: User = Depends(require_staff),
    db: Session = Depends(get_db),
) -> Response:
    try:
        record = service.image_for_staff(db, image_id, staff)
    except NotFound:
        record_audit(db, staff.id, "ACCESS_DENIED", "image", image_id)
        db.commit()
        raise
    key = record.storage_key if variant == "photo" else record.heatmap_key
    if key is None:
        raise NotFound("No heat-map for this photo.")
    data = store.read_bytes(key)
    record_audit(db, staff.id, "IMAGE_VIEW", "image", record.id)
    db.commit()
    return Response(
        content=data,
        media_type="image/jpeg",
        headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"},
    )
