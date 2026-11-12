from sqlalchemy import func, select

from app.features.allocation.models import Assignment
from app.features.emergencies.models import EmergencyRequest
from app.seed import DEMO_ADMIN_EMAIL, DEMO_ADMIN_PASSWORD, DEMO_PATIENT_LOCATION
from tests.helpers import login_citizen, login_staff, pending_assignment_id, submit


def _admin(client):
    response = client.post("/api/auth/login", json={"email": DEMO_ADMIN_EMAIL, "password": DEMO_ADMIN_PASSWORD})
    assert response.status_code == 200


def test_drill_preview_writes_nothing(hospitals, make_client, db):
    client = make_client()
    login_citizen(client)
    lat, lng = DEMO_PATIENT_LOCATION
    body = client.post(
        "/api/drill/preview",
        json={"injury_type": "road_accident", "symptoms": {"heavy_bleeding": "yes"}, "location": {"lat": lat, "lng": lng, "source": "gps"}},
    ).json()
    assert body["priority"] == "RED_FLAG"
    assert body["candidates"][0]["name"] == "Pari Chowk Trauma Centre"
    assert db.scalar(select(func.count(EmergencyRequest.id))) == 0
    assert db.scalar(select(func.count(Assignment.id))) == 0


def test_hospital_pins_for_map(hospitals, make_client):
    client = make_client()
    login_citizen(client)
    pins = client.get("/api/hospitals").json()
    assert len(pins) == 5 and all(p["is_simulated"] for p in pins)


def test_admin_overview_metrics(hospitals, make_client):
    citizen, staff, admin = make_client(), make_client(), make_client()
    login_citizen(citizen)
    login_staff(staff, "H3")
    _admin(admin)
    submit(citizen)
    staff.post(f"/api/staff/requests/{pending_assignment_id(staff)}/decision", json={"action": "accept"})
    overview = admin.get("/api/admin/overview").json()
    assert overview["total_requests"] == 1
    assert overview["by_status"]["HOSPITAL_ACCEPTED"] == 1
    assert overview["accept_rate"] == 1.0
    assert overview["median_response_seconds"] is not None


def test_admin_filters_and_csv(hospitals, make_client):
    citizen, admin = make_client(), make_client()
    login_citizen(citizen)
    _admin(admin)
    submit(citizen)
    submit(citizen, symptoms={"chest_pain": "yes"})
    red = admin.get("/api/admin/requests?priority=RED_FLAG").json()
    assert len(red) == 1 and red[0]["priority"] == "RED_FLAG"
    csv = admin.get("/api/admin/requests?format=csv")
    assert csv.headers["content-type"].startswith("text/csv")
    assert csv.text.splitlines()[0].startswith("id,public_code,created_at")
    for table in ("hospitals", "staff", "audit"):
        assert admin.get(f"/api/admin/{table}?format=csv").status_code == 200


def test_admin_manages_staff(hospitals, make_client):
    admin, new_staff = make_client(), make_client()
    _admin(admin)
    created = admin.post(
        "/api/admin/staff",
        json={"name": "Pooja Nair", "email": "pooja.nair@jeevansetu.demo", "password": "Strong#Pass2026", "hospital_id": hospitals["H2"].id},
    )
    assert created.status_code == 201
    login = new_staff.post("/api/auth/login", json={"email": "pooja.nair@jeevansetu.demo", "password": "Strong#Pass2026"})
    assert login.status_code == 200
    admin.patch(f"/api/admin/staff/{created.json()['id']}", json={"is_active": False})
    assert new_staff.get("/api/auth/me").status_code == 401


def test_non_admin_is_forbidden(hospitals, make_client):
    staff = make_client()
    login_staff(staff, "H3")
    assert staff.get("/api/admin/overview").status_code == 403
