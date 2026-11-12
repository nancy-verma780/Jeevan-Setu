from datetime import timedelta

import pytest

from app.core import clock
from app.features.allocation.geo import destination_point, haversine_km
from app.features.allocation.ranking import RankingParams, rank
from app.features.allocation.reliability import reliability_from_history
from app.core.enums import AssignmentStatus
from app.seed import DEMO_PATIENT_LOCATION

PAPER = RankingParams(w_reliability=0.0)


def test_haversine_one_degree_of_longitude_at_equator():
    assert haversine_km(0, 0, 0, 1) == pytest.approx(111.195, abs=0.001)


def test_haversine_noida_to_connaught_place():
    # Sector 18 Noida to Connaught Place is about 13 km in a straight line.
    assert haversine_km(28.5708, 77.3261, 28.6315, 77.2167) == pytest.approx(13.0, abs=1.0)


def test_destination_point_round_trip():
    lat, lng = destination_point(*DEMO_PATIENT_LOCATION, 120, 8.01)
    assert haversine_km(*DEMO_PATIENT_LOCATION, lat, lng) == pytest.approx(8.01, abs=1e-6)


def test_table_viii_worked_example(hospitals):
    by_id = {h.id: key for key, h in hospitals.items()}
    ranked = rank(*DEMO_PATIENT_LOCATION, "road_accident", hospitals.values(), set(), PAPER, clock.utcnow())
    assert [by_id[c.hospital_id] for c in ranked] == ["H3", "H2", "H4"]
    h3, h2, h4 = ranked
    assert h3.score == pytest.approx(0.776, abs=1e-3)
    assert h2.score == pytest.approx(0.621, abs=1e-3)
    assert h4.score == pytest.approx(0.366, abs=1e-3)
    assert h2.distance_term == pytest.approx(0.7 * 0.801, abs=1e-3)
    assert h4.resource_term == 0 and h4.availability_flag == "missing"


def test_capability_filter_excludes_nearest_without_trauma(hospitals):
    ranked = rank(*DEMO_PATIENT_LOCATION, "road_accident", hospitals.values(), set(), PAPER, clock.utcnow())
    assert hospitals["H1"].id not in {c.hospital_id for c in ranked}


def test_radius_filter(hospitals):
    ranked = rank(*DEMO_PATIENT_LOCATION, "burn", hospitals.values(), set(), PAPER, clock.utcnow())
    assert [c.hospital_id for c in ranked] == [hospitals["H4"].id]


def test_excluded_diverted_and_closed_hospitals_are_skipped(hospitals, db):
    hospitals["H2"].diversion = True
    hospitals["H4"].open_for_emergency = False
    ranked = rank(
        *DEMO_PATIENT_LOCATION, "road_accident", hospitals.values(), {hospitals["H3"].id}, PAPER, clock.utcnow()
    )
    assert ranked == []


def test_stale_availability_scores_zero_and_is_flagged(hospitals):
    hospitals["H3"].beds_updated_at = clock.utcnow() - timedelta(hours=7)
    ranked = rank(*DEMO_PATIENT_LOCATION, "road_accident", hospitals.values(), set(), PAPER, clock.utcnow())
    h3 = next(c for c in ranked if c.hospital_id == hospitals["H3"].id)
    assert h3.resource_term == 0 and h3.availability_flag == "stale"


def test_reliability_term_is_added_and_stored(hospitals):
    params = RankingParams(w_reliability=0.05)
    reliability = {hospitals["H3"].id: 0.9}
    ranked = rank(*DEMO_PATIENT_LOCATION, "road_accident", hospitals.values(), set(), params, clock.utcnow(), reliability)
    h3 = ranked[0]
    assert h3.reliability == 0.9
    assert h3.reliability_term == pytest.approx(0.045)
    assert h3.score == pytest.approx(0.776 + 0.045, abs=1e-3)


def test_reliability_from_history():
    assert reliability_from_history([], 120) == 0.5
    fast_yes = [(AssignmentStatus.ACCEPTED, 30.0)] * 8
    slow_no = [(AssignmentStatus.TIMED_OUT, None)] * 8
    assert reliability_from_history(fast_yes, 120) > 0.8
    assert reliability_from_history(slow_no, 120) < 0.1
