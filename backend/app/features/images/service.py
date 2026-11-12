from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.enums import RequestStatus
from app.core.errors import Conflict, Invalid, NotFound
from app.features.allocation.models import Assignment
from app.features.auth.models import User
from app.features.emergencies.models import EmergencyRequest
from app.features.images import store
from app.features.images.analyzer import get_analyzer
from app.features.images.models import ImageRecord
from app.features.images.quality import RETAKE_MESSAGES, check_quality, decode_image
from app.features.images.schemas import AnalysisOut, ImageOut

MAX_IMAGES_PER_REQUEST = 3


def to_out(record: ImageRecord) -> ImageOut:
    return ImageOut(
        id=record.id,
        created_at=record.created_at,
        width=record.width,
        height=record.height,
        size_bytes=record.size_bytes,
        analysis=AnalysisOut(
            analyzer=record.analyzer_name,
            version=record.analyzer_version,
            prediction=record.prediction,
            confidence=record.confidence,
            abstained=record.abstained,
            has_heatmap=record.heatmap_key is not None,
        ),
    )


def upload(db: Session, request: EmergencyRequest, user: User, data: bytes) -> ImageRecord:
    settings = get_settings()
    if request.status is RequestStatus.CANCELLED:
        raise Conflict("This request was cancelled.")
    count = len(db.scalars(select(ImageRecord.id).where(ImageRecord.request_id == request.id)).all())
    if count >= MAX_IMAGES_PER_REQUEST:
        raise Conflict("You can add up to 3 photos to a request.")

    image = decode_image(data, settings.image_max_bytes, settings.image_max_pixels)
    report = check_quality(image, settings)
    if report.flags:
        flag = report.flags[0]
        raise Invalid(RETAKE_MESSAGES[flag], code=f"retake_{flag}")

    key, size = store.save_jpeg(image)
    analyzer = get_analyzer()
    result = analyzer.analyze(image)
    heatmap_key = None
    if result.heatmap is not None:
        heatmap_key, _ = store.save_jpeg(result.heatmap, store.heatmap_key_for(key))

    record = ImageRecord(
        request_id=request.id,
        uploaded_by_id=user.id,
        storage_key=key,
        mime_type="image/jpeg",
        width=image.width,
        height=image.height,
        size_bytes=size,
        quality_flags=list(report.flags),
        analyzer_name=analyzer.name,
        analyzer_version=analyzer.version,
        prediction=result.prediction,
        confidence=result.confidence,
        abstained=result.abstained,
        heatmap_key=heatmap_key,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def images_for_request(db: Session, request_id: int) -> list[ImageRecord]:
    return list(db.scalars(select(ImageRecord).where(ImageRecord.request_id == request_id).order_by(ImageRecord.id)))


def image_for_staff(db: Session, image_id: int, staff: User) -> ImageRecord:
    record = db.get(ImageRecord, image_id)
    if record is None or staff.hospital_id is None:
        raise NotFound("Image not found.")
    asked = db.scalar(
        select(Assignment.id).where(
            Assignment.request_id == record.request_id, Assignment.hospital_id == staff.hospital_id
        )
    )
    if asked is None:
        raise NotFound("Image not found.")
    return record
