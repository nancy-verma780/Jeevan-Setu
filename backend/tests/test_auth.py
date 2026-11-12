from sqlalchemy import select

from app.core.security import hash_token
from app.features.auth.models import UserSession
from tests.helpers import login_citizen, login_staff


def test_otp_login_creates_session_cookie(hospitals, make_client):
    client = make_client()
    me = login_citizen(client)
    assert me["role"] == "citizen"
    assert client.get("/api/auth/me").json()["phone"] == "+919811024521"


def test_wrong_otp_is_rejected(hospitals, make_client):
    client = make_client()
    client.post("/api/auth/otp/request", json={"phone": "98110 24521"})
    response = client.post("/api/auth/otp/verify", json={"phone": "9811024521", "code": "000000"})
    assert response.status_code == 422
    assert client.get("/api/auth/me").status_code == 401


def test_invalid_phone_is_rejected(make_client, hospitals):
    assert make_client().post("/api/auth/otp/request", json={"phone": "12345"}).status_code == 422


def test_otp_request_is_rate_limited(make_client, hospitals):
    client = make_client()
    for _ in range(3):
        assert client.post("/api/auth/otp/request", json={"phone": "9876543210"}).status_code == 200
    assert client.post("/api/auth/otp/request", json={"phone": "9876543210"}).status_code == 429


def test_only_token_hash_is_stored(hospitals, make_client, db):
    client = make_client()
    login_staff(client, "H3")
    token = client.cookies.get("js_session")
    stored = db.scalars(select(UserSession.token_hash)).all()
    assert token not in stored
    assert hash_token(token) in stored


def test_logout_revokes_immediately(hospitals, make_client):
    client = make_client()
    login_staff(client, "H3")
    token = client.cookies.get("js_session")
    assert client.post("/api/auth/logout").status_code == 204
    client.cookies.set("js_session", token)
    assert client.get("/api/auth/me").status_code == 401


def test_wrong_password(hospitals, make_client):
    response = make_client().post("/api/auth/login", json={"email": "staff.h3@jeevansetu.demo", "password": "nope"})
    assert response.status_code == 422


def test_citizen_cannot_use_staff_endpoints(hospitals, make_client):
    client = make_client()
    login_citizen(client)
    assert client.get("/api/staff/requests").status_code == 403


def test_staff_cannot_submit_reports(hospitals, make_client):
    client = make_client()
    login_staff(client, "H3")
    response = client.post("/api/emergencies", json={}, headers={"Idempotency-Key": "abcdefgh"})
    assert response.status_code in (403, 422)
    assert client.get("/api/emergencies").status_code == 403
