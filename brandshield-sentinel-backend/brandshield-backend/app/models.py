"""SQLAlchemy models used by the API."""

from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, JSON, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class BrandProfile(Base):
    """A brand's verified names and identifiers used as comparison inputs."""

    __tablename__ = "brand_profiles"
    __table_args__ = (UniqueConstraint("name", name="uq_brand_profiles_name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    official_handles: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    official_domains: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False
    )


class DetectionRecord(Base):
    """A saved, explainable result from one of the metadata detection checks."""

    __tablename__ = "detection_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    kind: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    target: Mapped[str] = mapped_column(String(512), nullable=False)
    risk_score: Mapped[float] = mapped_column(Float, nullable=False)
    risk_level: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    findings: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    analysis_scope: Mapped[str] = mapped_column(String(80), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)
