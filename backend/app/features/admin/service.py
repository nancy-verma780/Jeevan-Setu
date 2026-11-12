import csv
import io
from collections.abc import Sequence
from datetime import date, datetime, time, timezone
from statistics import median

from fastapi import Response
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.enums import AssignmentStatus, RequestStatus
from app.features.admin.schemas import AdminRequestRow, OverviewOut
from app.features.allocation.models import Assignment
from app.features.emergencies.models import EmergencyRequest


def day_start(d: date) -> datetime:
    return datetime.combine(d, time.min, tzinfo=timezone.utc)


def day_end(d: date) -> datetime:
    return datetime.combine(d, time.max, tzinfo=timezone.utc)


def overview(db: Session) -> OverviewOut:
    counts = dict(db.execute(select(EmergencyRequest.status, func.count()).group_by(EmergencyRequest.status)).all())
    by_status = {s.value: int(counts.get(s, 0)) for s in RequestStatus}
    replies = db.execute(
        select(Assignment.status, Assignment.created_at, Assignment.decided_at).where(
            Assignment.status.in_((AssignmentStatus.ACCEPTED, AssignmentStatus.REJECTED, AssignmentStatus.TIMED_OUT))
        )
    ).all()
    answered = [(d - c).total_seconds() for s, c, d in replies if s != AssignmentStatus.TIMED_OUT and d]
    accepted = sum(1 for s, _, _ in replies if s == AssignmentStatus.ACCEPTED)
    return OverviewOut(
        total_requests=sum(by_status.values()),
        by_status=by_status,
        median_response_seconds=round(median(answered), 1) if answered else None,
        accept_rate=round(accepted / len(replies), 4) if replies else None,
        no_hospital_cases=by_status[RequestStatus.NO_SUITABLE_HOSPITAL.value],
    )


def request_rows(db: Session, requests: Sequence[EmergencyRequest]) -> list[AdminRequestRow]:
    rows = []
    for r in requests:
        assignments = db.scalars(select(Assignment).where(Assignment.request_id == r.id).order_by(Assignment.id)).all()
        live = next(
            (a for a in reversed(assignments) if a.status in (AssignmentStatus.PENDING, AssignmentStatus.ACCEPTED)),
            None,
        )
        rows.append(
            AdminRequestRow(
                id=r.id,
                public_code=r.public_code or "",
                created_at=r.created_at,
                injury_type=r.injury_type,
                priority=r.priority,
                status=r.status,
                hospitals_asked=len(assignments),
                current_hospital=live.hospital.name if live else None,
                lat=r.lat,
                lng=r.lng,
            )
        )
    return rows


def csv_response(rows: Sequence[BaseModel], model: type[BaseModel], filename: str) -> Response:
    buffer = io.StringIO()
    fields = list(model.model_fields)
    writer = csv.DictWriter(buffer, fieldnames=fields)
    writer.writeheader()
    for row in rows:
        data = row.model_dump(mode="json")
        writer.writerow({k: (",".join(v) if isinstance(v, list) else v) for k, v in data.items()})
    return Response(
        content=buffer.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"', "Cache-Control": "no-store"},
    )
