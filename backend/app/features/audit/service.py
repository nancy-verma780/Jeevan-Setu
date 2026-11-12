from sqlalchemy.orm import Session

from app.features.audit.models import AuditLog


def record_audit(db: Session, actor_user_id: int | None, action: str, entity_type: str, entity_id: object) -> None:
    db.add(AuditLog(actor_user_id=actor_user_id, action=action, entity_type=entity_type, entity_id=str(entity_id)))
