"""Practice drill: runs the real priority rules and ranking but writes nothing,
so a drill can never reach a hospital."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import clock
from app.core.config import get_settings
from app.core.db import get_db
from app.core.enums import InjuryType, Priority
from app.features.allocation.ranking import RankingParams, rank
from app.features.allocation.reliability import reliability_for
from app.features.auth.deps import require_citizen
from app.features.auth.models import User
from app.features.emergencies.schemas import LocationIn, ReasonOut, SymptomsIn
from app.features.hospitals.models import Hospital
from app.features.priority.engine import evaluate

router = APIRouter(prefix="/api/drill", tags=["practice drill"])


class DrillPreviewIn(BaseModel):
    injury_type: InjuryType
    symptoms: SymptomsIn = Field(default_factory=SymptomsIn)
    location: LocationIn
    patient_age: int | None = Field(default=None, ge=0, le=120)


class DrillCandidate(BaseModel):
    hospital_id: int
    name: str
    distance_km: float
    distance_term: float
    resource_term: float
    reliability_term: float
    score: float
    availability_flag: str | None


class DrillPreviewOut(BaseModel):
    priority: Priority
    priority_reasons: list[ReasonOut]
    rule_set_version: str
    candidates: list[DrillCandidate]


@router.post("/preview", response_model=DrillPreviewOut)
def preview(body: DrillPreviewIn, _: User = Depends(require_citizen), db: Session = Depends(get_db)) -> DrillPreviewOut:
    settings = get_settings()
    result = evaluate(body.injury_type, body.symptoms.model_dump(mode="json"), body.patient_age)
    hospitals = db.scalars(select(Hospital)).all()
    names = {h.id: h.name for h in hospitals}
    ranked = rank(
        body.location.lat,
        body.location.lng,
        body.injury_type,
        hospitals,
        set(),
        RankingParams.from_settings(settings),
        clock.utcnow(),
        reliability_for(db, [h.id for h in hospitals], settings.reply_timeout_seconds),
    )
    return DrillPreviewOut(
        priority=result.category,
        priority_reasons=[ReasonOut(**r.as_dict()) for r in result.reasons],
        rule_set_version=result.rule_set_version,
        candidates=[
            DrillCandidate(
                hospital_id=c.hospital_id,
                name=names[c.hospital_id],
                distance_km=c.distance_km,
                distance_term=c.distance_term,
                resource_term=c.resource_term,
                reliability_term=c.reliability_term,
                score=c.score,
                availability_flag=c.availability_flag,
            )
            for c in ranked[:3]
        ],
    )
