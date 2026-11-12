from sqlalchemy.orm import Session

from app.core.enums import EventType
from app.features.emergencies.models import EmergencyRequest, Event


def record_event(
    db: Session,
    request: EmergencyRequest,
    event_type: EventType,
    data: dict | None = None,
    actor_user_id: int | None = None,
) -> Event:
    event = Event(request_id=request.id, type=event_type, data=data or {}, actor_user_id=actor_user_id)
    db.add(event)
    return event
