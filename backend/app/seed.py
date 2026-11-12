"""Loads five simulated hospitals around Greater Noida and one demo user per role.

The hospitals sit at the distances used in Table VIII of the paper, measured
from DEMO_PATIENT_LOCATION, so the worked ranking example can be reproduced.

    python -m app.seed            # adds data if the database is empty
    python -m app.seed --reset    # deletes demo users and hospitals first
"""

import argparse
from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core import clock
from app.core.db import session_factory
from app.core.enums import Role, Service
from app.core.security import hash_password
from app.features.allocation.geo import destination_point
from app.features.auth.models import User
from app.features.hospitals.models import Hospital

# Near Alpha-1 commercial belt, Greater Noida.
DEMO_PATIENT_LOCATION = (28.4744, 77.5040)

DEMO_CITIZEN_PHONE = "+919811024521"
DEMO_STAFF_PASSWORD = "Demo@2026!"
DEMO_ADMIN_EMAIL = "admin@jeevansetu.demo"
DEMO_ADMIN_PASSWORD = "Admin@2026!"

G, T, B, O, C = (
    Service.GENERAL_EMERGENCY,
    Service.TRAUMA_CARE,
    Service.BURN_CARE,
    Service.ORTHOPAEDICS,
    Service.CARDIAC_CARE,
)


@dataclass(frozen=True)
class SeedHospital:
    key: str
    name: str
    address: str
    phone: str
    bearing_deg: float
    distance_km: float
    services: tuple[Service, ...]
    free_beds: int | None
    staff_name: str


SEED_HOSPITALS: tuple[SeedHospital, ...] = (
    SeedHospital("H1", "Sector Beta-2 City Hospital", "Beta-2, Greater Noida 201308", "+91 120 410 2201",
                 20, 2.00, (G, O, C), 4, "Neha Gupta"),
    SeedHospital("H2", "Alpha Care Hospital", "Alpha-2, Greater Noida 201310", "+91 120 432 8810",
                 300, 4.98, (G, T), 1, "Imran Qureshi"),
    SeedHospital("H3", "Pari Chowk Trauma Centre", "Pari Chowk, Greater Noida 201310", "+91 120 456 7210",
                 120, 8.01, (G, T, O), 6, "Ritu Sharma"),
    SeedHospital("H4", "Knowledge Park Medical Centre", "Knowledge Park II, Greater Noida 201306", "+91 120 498 3307",
                 200, 11.93, (G, T, B), None, "Arjun Mehta"),
    SeedHospital("H5", "Dadri Road Hospital", "GT Road, Dadri 203207", "+91 120 266 1145",
                 250, 30.02, (G, T, B, C), 8, "Sunita Yadav"),
)


def staff_email(key: str) -> str:
    return f"staff.{key.lower()}@jeevansetu.demo"


def seed_hospitals(db: Session) -> dict[str, Hospital]:
    now = clock.utcnow()
    created: dict[str, Hospital] = {}
    for spec in SEED_HOSPITALS:
        lat, lng = destination_point(*DEMO_PATIENT_LOCATION, spec.bearing_deg, spec.distance_km)
        hospital = Hospital(
            name=spec.name,
            address=spec.address,
            phone=spec.phone,
            lat=round(lat, 6),
            lng=round(lng, 6),
            services=sorted(s.value for s in spec.services),
            free_beds=spec.free_beds,
            beds_updated_at=now - timedelta(minutes=10) if spec.free_beds is not None else None,
            open_for_emergency=True,
            diversion=False,
            is_simulated=True,
        )
        db.add(hospital)
        created[spec.key] = hospital
    db.flush()
    return created


def seed_users(db: Session, hospitals: dict[str, Hospital]) -> None:
    db.add(User(role=Role.CITIZEN, name="Aman Verma", phone=DEMO_CITIZEN_PHONE))
    db.add(User(role=Role.ADMIN, name="Kavita Rao", email=DEMO_ADMIN_EMAIL, password_hash=hash_password(DEMO_ADMIN_PASSWORD)))
    staff_hash = hash_password(DEMO_STAFF_PASSWORD)
    for spec in SEED_HOSPITALS:
        db.add(
            User(
                role=Role.STAFF,
                name=spec.staff_name,
                email=staff_email(spec.key),
                password_hash=staff_hash,
                hospital_id=hospitals[spec.key].id,
            )
        )
    db.flush()


def seed_all(db: Session) -> dict[str, Hospital]:
    hospitals = seed_hospitals(db)
    seed_users(db, hospitals)
    db.commit()
    return hospitals


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--reset", action="store_true", help="remove demo users and hospitals first")
    args = parser.parse_args()
    with session_factory()() as db:
        if args.reset:
            db.execute(delete(User).where(User.email.like("%@jeevansetu.demo")))
            db.execute(delete(User).where(User.phone == DEMO_CITIZEN_PHONE))
            db.execute(delete(Hospital).where(Hospital.is_simulated.is_(True)))
            db.commit()
        if db.scalar(select(Hospital.id).limit(1)) is not None:
            print("Hospitals already exist. Run with --reset to reload the demo data.")
            return
        seed_all(db)
        print("Seeded 5 simulated hospitals and demo users.")
        print(f"  Citizen: {DEMO_CITIZEN_PHONE} (OTP shown in dev)")
        print(f"  Staff:   {staff_email('H3')} / {DEMO_STAFF_PASSWORD} (and staff.h1 ... staff.h5)")
        print(f"  Admin:   {DEMO_ADMIN_EMAIL} / {DEMO_ADMIN_PASSWORD}")


if __name__ == "__main__":
    main()
