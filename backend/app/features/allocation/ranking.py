"""Two-stage allocation: eligibility filter, then the additive score of Eq. (8).

s(h) = wd (1 - d/Dmax) + wr min(b, bcap)/bcap + wrel * reliability
"""

from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Protocol

from app.core.config import Settings
from app.core.enums import InjuryType
from app.features.allocation.capabilities import required_services
from app.features.allocation.geo import haversine_km

NEUTRAL_RELIABILITY = 0.5


class HospitalLike(Protocol):
    id: int
    lat: float
    lng: float
    services: list[str]
    free_beds: int | None
    beds_updated_at: datetime | None
    open_for_emergency: bool
    diversion: bool


@dataclass(frozen=True)
class RankingParams:
    w_distance: float = 0.7
    w_resource: float = 0.3
    w_reliability: float = 0.05
    bed_cap: int = 5
    max_distance_km: float = 25.0
    stale_after: timedelta = timedelta(hours=6)

    @classmethod
    def from_settings(cls, s: Settings) -> "RankingParams":
        return cls(
            w_distance=s.rank_weight_distance,
            w_resource=s.rank_weight_resource,
            w_reliability=s.rank_weight_reliability,
            bed_cap=s.rank_bed_cap,
            max_distance_km=s.rank_max_distance_km,
            stale_after=timedelta(minutes=s.availability_stale_minutes),
        )


@dataclass(frozen=True)
class Candidate:
    hospital_id: int
    distance_km: float
    distance_term: float
    resource_term: float
    reliability: float
    reliability_term: float
    score: float
    availability_flag: str | None  # None, "missing" or "stale"


def is_eligible(
    hospital: HospitalLike,
    distance_km: float,
    injury_type: InjuryType | str,
    excluded_ids: set[int],
    params: RankingParams,
) -> bool:
    if hospital.id in excluded_ids or not hospital.open_for_emergency or hospital.diversion:
        return False
    if distance_km > params.max_distance_km:
        return False
    return required_services(injury_type) <= set(hospital.services or [])


def availability_flag(hospital: HospitalLike, now: datetime, params: RankingParams) -> str | None:
    if hospital.free_beds is None or hospital.beds_updated_at is None:
        return "missing"
    if now - hospital.beds_updated_at > params.stale_after:
        return "stale"
    return None


def score_hospital(
    hospital: HospitalLike,
    distance_km: float,
    reliability: float,
    now: datetime,
    params: RankingParams,
) -> Candidate:
    flag = availability_flag(hospital, now, params)
    distance_part = 1 - distance_km / params.max_distance_km
    # Missing or stale availability keeps the hospital eligible but earns nothing here.
    resource_part = 0.0 if flag else min(max(hospital.free_beds or 0, 0), params.bed_cap) / params.bed_cap
    distance_term = params.w_distance * distance_part
    resource_term = params.w_resource * resource_part
    reliability_term = params.w_reliability * reliability
    return Candidate(
        hospital_id=hospital.id,
        distance_km=round(distance_km, 3),
        distance_term=round(distance_term, 4),
        resource_term=round(resource_term, 4),
        reliability=round(reliability, 4),
        reliability_term=round(reliability_term, 4),
        score=round(distance_term + resource_term + reliability_term, 4),
        availability_flag=flag,
    )


def rank(
    lat: float,
    lng: float,
    injury_type: InjuryType | str,
    hospitals: Iterable[HospitalLike],
    excluded_ids: set[int],
    params: RankingParams,
    now: datetime,
    reliability: Mapping[int, float] | None = None,
) -> list[Candidate]:
    reliability = reliability or {}
    candidates = []
    for hospital in hospitals:
        distance = haversine_km(lat, lng, hospital.lat, hospital.lng)
        if not is_eligible(hospital, distance, injury_type, excluded_ids, params):
            continue
        candidates.append(
            score_hospital(hospital, distance, reliability.get(hospital.id, NEUTRAL_RELIABILITY), now, params)
        )
    candidates.sort(key=lambda c: (-c.score, c.distance_km, c.hospital_id))
    return candidates
