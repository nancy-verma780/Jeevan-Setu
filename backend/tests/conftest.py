import os

os.environ["JS_RUN_TIMEOUT_CHECKER"] = "false"
os.environ["JS_EXPOSE_DEV_OTP"] = "true"
os.environ["JS_COOKIE_SECURE"] = "false"

import pytest
from fastapi.testclient import TestClient

import app.models  # noqa: E402,F401
from app.core import db as dbmod
from app.core.config import get_settings
from app.core.db import Base
from app.seed import seed_all


@pytest.fixture
def db_url(tmp_path, monkeypatch):
    url = f"sqlite:///{tmp_path / 'test.db'}"
    monkeypatch.setenv("JS_DATABASE_URL", url)
    get_settings.cache_clear()
    engine = dbmod.configure(url)
    Base.metadata.create_all(engine)
    yield url
    engine.dispose()
    get_settings.cache_clear()


@pytest.fixture
def db(db_url):
    with dbmod.session_factory()() as session:
        yield session


@pytest.fixture
def hospitals(db):
    return seed_all(db)


@pytest.fixture
def api(db_url):
    from app.main import create_app

    return create_app()


@pytest.fixture
def make_client(api):
    clients: list[TestClient] = []

    def _make() -> TestClient:
        client = TestClient(api)
        clients.append(client)
        return client

    yield _make
    for client in clients:
        client.close()
