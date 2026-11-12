from sqlalchemy import func, select

from app.features.emergencies.models import Consent, EmergencyRequest
from tests.helpers import login_citizen, submit


def test_valid_submission_stores_priority_and_first_assignment(hospitals, make_client):
    client = make_client()
    login_citizen(client)
    response = submit(client)
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["priority"] == "ELEVATED"
    assert body["status"] == "AWAITING_HOSPITAL_RESPONSE"
    assert body["current_hospital"]["name"] == "Pari Chowk Trauma Centre"
    assert body["current_hospital"]["address"] is None  # hidden until accepted
    assert [e["type"] for e in body["events"]] == ["SUBMITTED", "PRIORITY_SET", "SENT_TO_HOSPITAL"]
    assert body["public_code"].startswith("JS-")


def test_consent_is_stored_with_version_and_time(hospitals, make_client, db):
    client = make_client()
    login_citizen(client)
    request_id = submit(client).json()["id"]
    consent = db.scalar(select(Consent).where(Consent.request_id == request_id))
    assert consent.policy_version == "2026-10-01"
    assert consent.accepted_at is not None


def test_no_consent_rejects_and_stores_nothing(hospitals, make_client, db):
    client = make_client()
    login_citizen(client)
    response = submit(client, consent={"accepted": False, "policy_version": "2026-10-01"})
    assert response.status_code == 422
    assert db.scalar(select(func.count(EmergencyRequest.id))) == 0


def test_old_consent_version_is_rejected(hospitals, make_client, db):
    client = make_client()
    login_citizen(client)
    response = submit(client, consent={"accepted": True, "policy_version": "2025-01-01"})
    assert response.status_code == 422
    assert db.scalar(select(func.count(EmergencyRequest.id))) == 0


def test_double_submit_with_same_key_returns_original(hospitals, make_client, db):
    client = make_client()
    login_citizen(client)
    first = submit(client, key="tap-0001-abcd")
    second = submit(client, key="tap-0001-abcd")
    assert first.status_code == 201 and second.status_code == 200
    assert first.json()["id"] == second.json()["id"]
    assert db.scalar(select(func.count(EmergencyRequest.id))) == 1


def test_missing_idempotency_key_is_rejected(hospitals, make_client):
    client = make_client()
    login_citizen(client)
    from tests.helpers import report_payload

    assert client.post("/api/emergencies", json=report_payload()).status_code == 422


def test_missing_symptoms_are_unknown_and_need_review(hospitals, make_client):
    client = make_client()
    login_citizen(client)
    body = submit(client, symptoms={}).json()
    assert body["priority"] == "NEEDS_REVIEW"
    assert any("Unknown" in r["text"] for r in body["priority_reasons"])


def test_red_flag_request_is_still_routed(hospitals, make_client):
    client = make_client()
    login_citizen(client)
    body = submit(client, symptoms={"heavy_bleeding": "yes"}).json()
    assert body["priority"] == "RED_FLAG"
    assert body["current_hospital"] is not None


def test_other_citizen_gets_404(hospitals, make_client):
    owner, other = make_client(), make_client()
    login_citizen(owner)
    login_citizen(other, "9876500011")
    request_id = submit(owner).json()["id"]
    assert other.get(f"/api/emergencies/{request_id}").status_code == 404
    assert other.post(f"/api/emergencies/{request_id}/cancel").status_code == 404


def test_list_shows_only_own_requests(hospitals, make_client):
    owner, other = make_client(), make_client()
    login_citizen(owner)
    login_citizen(other, "9876500011")
    submit(owner)
    assert len(owner.get("/api/emergencies").json()) == 1
    assert other.get("/api/emergencies").json() == []
