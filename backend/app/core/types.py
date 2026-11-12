from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import DateTime
from sqlalchemy import Enum as SAEnum
from sqlalchemy.types import TypeDecorator


class UTCDateTime(TypeDecorator):
    """Stores UTC and always hands back timezone-aware values.

    SQLite has no timezone support, so values are written there as naive UTC.
    """

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect):
        if value is None:
            return None
        if value.tzinfo is None:
            raise ValueError("Naive datetimes are not allowed; use clock.utcnow().")
        value = value.astimezone(timezone.utc)
        return value.replace(tzinfo=None) if dialect.name == "sqlite" else value

    def process_result_value(self, value: datetime | None, dialect):
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)


def str_enum(enum_cls: type[Enum]) -> SAEnum:
    return SAEnum(
        enum_cls,
        native_enum=False,
        length=40,
        values_callable=lambda members: [m.value for m in members],
        validate_strings=True,
    )
