"""Dashboard summary and paginated detection history."""

from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import BrandProfile, DetectionRecord
from app.schemas import DashboardStats, DetectionHistory, DetectionRead

router = APIRouter(prefix="/api", tags=["Dashboard and history"])


@router.get(
    "/dashboard/stats",
    response_model=DashboardStats,
    summary="Get dashboard totals",
)
def dashboard_stats(db: Session = Depends(get_db)) -> DashboardStats:
    total_brands = db.scalar(select(func.count()).select_from(BrandProfile)) or 0
    total_detections = db.scalar(select(func.count()).select_from(DetectionRecord)) or 0
    high_risk = (
        db.scalar(
            select(func.count())
            .select_from(DetectionRecord)
            .where(DetectionRecord.risk_level == "high")
        )
        or 0
    )
    by_type = {
        str(kind): int(count)
        for kind, count in db.execute(
            select(DetectionRecord.kind, func.count())
            .group_by(DetectionRecord.kind)
        ).all()
    }
    return DashboardStats(
        total_brands=int(total_brands),
        total_detections=int(total_detections),
        high_risk_detections=int(high_risk),
        detections_by_type=by_type,
    )


@router.get(
    "/history",
    response_model=DetectionHistory,
    summary="List saved detections",
    description="Results are ordered newest first; use kind, limit, and offset to narrow the list.",
)
def detection_history(
    kind: Literal["social", "apk", "domain"] | None = None,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> DetectionHistory:
    statement = select(DetectionRecord)
    count_statement = select(func.count()).select_from(DetectionRecord)
    if kind is not None:
        statement = statement.where(DetectionRecord.kind == kind)
        count_statement = count_statement.where(DetectionRecord.kind == kind)

    items = db.scalars(
        statement.order_by(DetectionRecord.created_at.desc(), DetectionRecord.id.desc())
        .offset(offset)
        .limit(limit)
    ).all()
    total = db.scalar(count_statement) or 0
    return DetectionHistory(
        items=[DetectionRead.model_validate(item) for item in items],
        total=int(total),
        limit=limit,
        offset=offset,
    )
