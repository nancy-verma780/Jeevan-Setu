from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect


def test_upgrade_head_creates_every_table(tmp_path):
    url = f"sqlite:///{tmp_path / 'migrated.db'}"
    config = Config("alembic.ini")
    config.set_main_option("sqlalchemy.url", url)
    command.upgrade(config, "head")
    inspector = inspect(create_engine(url))
    assert {
        "users", "sessions", "otp_challenges", "hospitals", "emergency_requests",
        "consents", "events", "assignments", "audit_logs", "images",
    } <= set(inspector.get_table_names())
    index_names = {ix["name"] for ix in inspector.get_indexes("assignments")}
    assert "uq_assignments_one_live_per_request" in index_names
    command.downgrade(config, "base")
