from datetime import timedelta

from sqlalchemy import select

from app.core import clock
from app.core.enums import AssignmentStatus, RequestStatus
from app.core.security import hash_password
from app.core.enums import Role
from app.features.allocation.models import Assignment
from app.features.allocation.service import check_timeouts
from app.features.audit.models import AuditLog
from app.features.auth.models import User
from app.features.emergencies.models import EmergencyRequest
from tests.helpers import login_citizen, login_staff, pending_assignment_id, submit


def _status(db, request_id):
    db.expire_all()
    return db.get(EmergencyRequest, request_id).status


def _current_hospital_name(client, request_id):
    hospital = client.get(f"/api/emergencies/{request_id}").json()["current_hospital"]
    return hospital["name"] if hospital else None


def test_accept_reserves_bed_and_reveals_contact(hospitals, make_client, db):
    citizen, staff = make_client(), make_client()
    login_citizen(citizen)
    login_staff(staff, "H3")
    request_id = submit(citizen).json()["id"]
    response = staff.post(f"/api/staff/requests/{pending_assignment_id(staff)}/decision", json={"action": "accept"})
    assert response.status_code == 200
    detail = citizen.get(f"/api/emergencies/{request_id}").json()
    assert detail["status"] == "HOSPITAL_ACCEPTED"
    assert detail["current_hospital"]["phone"] == "+91 120 456 7210"
    db.expire_all()
    assert hospitals["H3"].free_beds == 5


def test_decline_needs_a_reason(hospitals, make_client):
    citizen, staff = make_client(), make_client()
    login_citizen(citizen)
    login_staff(staff, "H3")
    submit(citizen)
    response = staff.post(f"/api/staff/requests/{pending_assignment_id(staff)}/decision", json={"action": "decline"})
    assert response.status_code == 422


def test_reject_moves_to_next_hospital(hospitals, make_client, db):
    citizen, staff = make_client(), make_client()
    login_citizen(citizen)
    login_staff(staff, "H3")
    request_id = submit(citizen).json()["id"]
    staff.post(
        f"/api/staff/requests/{pending_assignment_id(staff)}/decision",
        json={"action": "decline", "reason": "no_bed"},
    )
    assert _current_hospital_name(citizen, request_id) == "Alpha Care Hospital"
    events = [e["type"] for e in citizen.get(f"/api/emergencies/{request_id}").json()["events"]]
    assert events[-2:] == ["HOSPITAL_DECLINED", "SENT_TO_HOSPITAL"]
    assert staff.get("/api/staff/requests").json() == []
    assert len(staff.get("/api/staff/requests?status=declined").json()) == 1


def test_timeout_moves_to_next_hospital(hospitals, make_client, db):
    citizen = make_client()
    login_citizen(citizen)
    request_id = submit(citizen).json()["id"]
    assert check_timeouts(db, clock.utcnow() + timedelta(seconds=121)) == 1
    assert _current_hospital_name(citizen, request_id) == "Alpha Care Hospital"
    first = db.scalar(select(Assignment).where(Assignment.request_id == request_id).order_by(Assignment.id))
    db.refresh(first)
    assert first.status is AssignmentStatus.TIMED_OUT


def test_no_candidates_left(hospitals, make_client, db):
    citizen = make_client()
    login_citizen(citizen)
    request_id = submit(citizen).json()["id"]
    later = clock.utcnow()
    for _ in range(3):  # H3, H2, H4 time out in turn; H1 lacks trauma care, H5 is too far
        later += timedelta(seconds=121)
        check_timeouts(db, later)
    assert _status(db, request_id) is RequestStatus.NO_SUITABLE_HOSPITAL
    body = citizen.get(f"/api/emergencies/{request_id}").json()
    assert body["current_hospital"] is None
    assert body["events"][-1]["type"] == "NO_SUITABLE_HOSPITAL"


def test_simultaneous_accepts_one_gets_409(hospitals, make_client, db):
    db.add(
        User(
            role=Role.STAFF,
            name="Second nurse",
            email="staff2.h3@jeevansetu.demo",
            password_hash=hash_password("Demo@2026!"),
            hospital_id=hospitals["H3"].id,
        )
    )
    db.commit()
    citizen, nurse_a, nurse_b = make_client(), make_client(), make_client()
    login_citizen(citizen)
    login_staff(nurse_a, "H3")
    nurse_b.post("/api/auth/login", json={"email": "staff2.h3@jeevansetu.demo", "password": "Demo@2026!"})
    submit(citizen)
    assignment_id = pending_assignment_id(nurse_a)
    first = nurse_a.post(f"/api/staff/requests/{assignment_id}/decision", json={"action": "accept"})
    second = nurse_b.post(f"/api/staff/requests/{assignment_id}/decision", json={"action": "accept"})
    assert sorted([first.status_code, second.status_code]) == [200, 409]


def test_accept_after_timeout_gets_409(hospitals, make_client, db):
    citizen, staff = make_client(), make_client()
    login_citizen(citizen)
    login_staff(staff, "H3")
    submit(citizen)
    assignment_id = pending_assignment_id(staff)
    check_timeouts(db, clock.utcnow() + timedelta(seconds=121))
    response = staff.post(f"/api/staff/requests/{assignment_id}/decision", json={"action": "accept"})
    assert response.status_code == 409


def test_cross_hospital_access_is_404_and_audited(hospitals, make_client, db):
    citizen, h3, h2 = make_client(), make_client(), make_client()
    login_citizen(citizen)
    login_staff(h3, "H3")
    me_h2 = login_staff(h2, "H2")
    submit(citizen)
    assignment_id = pending_assignment_id(h3)
    assert h2.get(f"/api/staff/requests/{assignment_id}").status_code == 404
    assert h2.post(f"/api/staff/requests/{assignment_id}/decision", json={"action": "accept"}).status_code == 404
    assert h2.get("/api/staff/requests/999999").status_code == 404
    denied = db.scalars(
        select(AuditLog).where(AuditLog.action == "ACCESS_DENIED", AuditLog.actor_user_id == me_h2["id"])
    ).all()
    assert len(denied) == 3


def test_case_view_is_audited_and_has_packet(hospitals, make_client, db):
    citizen, staff = make_client(), make_client()
    login_citizen(citizen)
    login_staff(staff, "H3")
    submit(citizen)
    detail = staff.get(f"/api/staff/requests/{pending_assignment_id(staff)}").json()
    assert detail["packet"]["blood_group"] == "B+"
    assert detail["packet"]["allergies"] == "Penicillin"
    assert db.scalar(select(AuditLog).where(AuditLog.action == "VIEW_CASE")) is not None


def test_queue_puts_red_flags_first(hospitals, make_client):
    citizen, staff = make_client(), make_client()
    login_citizen(citizen)
    login_staff(staff, "H3")
    submit(citizen)
    submit(citizen, symptoms={"heavy_bleeding": "yes"})
    priorities = [row["priority"] for row in staff.get("/api/staff/requests").json()]
    assert priorities == ["RED_FLAG", "ELEVATED"]


def test_cancel_before_acceptance(hospitals, make_client, db):
    citizen, staff = make_client(), make_client()
    login_citizen(citizen)
    login_staff(staff, "H3")
    request_id = submit(citizen).json()["id"]
    assert citizen.post(f"/api/emergencies/{request_id}/cancel").json()["status"] == "CANCELLED"
    assert staff.get("/api/staff/requests").json() == []


def test_cancel_after_acceptance_is_409(hospitals, make_client):
    citizen, staff = make_client(), make_client()
    login_citizen(citizen)
    login_staff(staff, "H3")
    request_id = submit(citizen).json()["id"]
    staff.post(f"/api/staff/requests/{pending_assignment_id(staff)}/decision", json={"action": "accept"})
    assert citizen.post(f"/api/emergencies/{request_id}/cancel").status_code == 409


def test_diversion_removes_hospital_from_ranking(hospitals, make_client):
    citizen, staff = make_client(), make_client()
    login_citizen(citizen)
    login_staff(staff, "H3")
    assert staff.patch("/api/staff/hospital", json={"diversion": True}).json()["diversion"] is True
    request_id = submit(citizen).json()["id"]
    assert _current_hospital_name(citizen, request_id) == "Alpha Care Hospital"


def test_bed_update_sets_timestamp(hospitals, make_client):
    staff = make_client()
    login_staff(staff, "H4")
    body = staff.patch("/api/staff/hospital", json={"free_beds": 3}).json()
    assert body["free_beds"] == 3 and body["beds_updated_at"] is not None
