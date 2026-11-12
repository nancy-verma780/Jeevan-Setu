from collections.abc import Iterator

from sqlalchemy import MetaData, create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings

NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


_engine: Engine | None = None
_factory: sessionmaker[Session] | None = None


def configure(url: str) -> Engine:
    global _engine, _factory
    if _engine is not None:
        _engine.dispose()
    is_sqlite = url.startswith("sqlite")
    _engine = create_engine(url, connect_args={"check_same_thread": False, "timeout": 15} if is_sqlite else {})
    if is_sqlite:

        @event.listens_for(_engine, "connect")
        def _enable_foreign_keys(dbapi_conn, _record):
            cursor = dbapi_conn.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

    _factory = sessionmaker(bind=_engine, expire_on_commit=False)
    return _engine


def get_engine() -> Engine:
    if _engine is None:
        configure(get_settings().database_url)
    assert _engine is not None
    return _engine


def session_factory() -> sessionmaker[Session]:
    get_engine()
    assert _factory is not None
    return _factory


def get_db() -> Iterator[Session]:
    db = session_factory()()
    try:
        yield db
    finally:
        db.close()
