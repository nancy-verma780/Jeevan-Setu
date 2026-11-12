import uuid

from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.seed import DEMO_CITIZEN_PHONE, DEMO_PATIENT_LOCATION, DEMO_STAFF_PASSWORD, staff_email


def login_citizen(client: TestClient, phone: str = DEMO_CITIZEN_PHONE) -> dict:
    code = client.post("/api/auth/otp/request", json={"phone": phone}).json()["dev_code"]
    response = client.post("/api/auth/otp/verify", json={"phone": phone, "code": code})
    assert response.status_code == 200, response.text
    return response.json()


def login_staff(client: TestClient, hospital_key: str) -> dict:
    response = client.post("/api/auth/login", json={"email": staff_email(hospital_key), "password": DEMO_STAFF_PASSWORD})
    assert response.status_code == 200, response.text
    return response.json()


def report_payload(**overrides) -> dict:
    lat, lng = DEMO_PATIENT_LOCATION
    payload = {
        "injury_type": "road_accident",
        "symptoms": {
            "unresponsive": "no",
            "breathing_difficulty": "no",
            "heavy_bleeding": "no",
            "chest_pain": "no",
            "seizure_now": "no",
            "minor_bleeding": "yes",
        },
        "location": {"lat": lat, "lng": lng, "source": "gps"},
        "consent": {"accepted": True, "policy_version": get_settings().consent_policy_version},
        "patient_age": 67,
        "patient_sex": "female",
        "description": "Scooter slipped near Alpha-1 market. Cut on right leg.",
        "blood_group": "B+",
        "allergies": "Penicillin",
    }
    payload.update(overrides)
    return payload


def submit(client: TestClient, key: str | None = None, **overrides):
    return client.post(
        "/api/emergencies",
        json=report_payload(**overrides),
        headers={"Idempotency-Key": key or uuid.uuid4().hex},
    )


def pending_assignment_id(staff_client: TestClient) -> int:
    rows = staff_client.get("/api/staff/requests").json()
    assert rows, "expected a pending request"
    return rows[0]["assignment_id"]
