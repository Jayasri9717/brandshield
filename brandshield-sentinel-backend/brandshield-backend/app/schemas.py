"""Pydantic v2 request and response models for the REST API."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _clean_string_list(values: list[str]) -> list[str]:
    cleaned: list[str] = []
    seen: set[str] = set()
    for value in values:
        item = value.strip()
        if item.startswith("@"):
            item = item[1:]
        if item and item.casefold() not in seen:
            cleaned.append(item)
            seen.add(item.casefold())
    return cleaned


class BrandProfileCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    official_handles: list[str] = Field(default_factory=list, max_length=50)
    official_domains: list[str] = Field(default_factory=list, max_length=50)

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Brand name cannot be blank.")
        return value

    @field_validator("official_handles", "official_domains")
    @classmethod
    def clean_identifiers(cls, values: list[str]) -> list[str]:
        return _clean_string_list(values)


class BrandProfileUpdate(BrandProfileCreate):
    pass


class BrandProfileRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    official_handles: list[str]
    official_domains: list[str]
    created_at: datetime
    updated_at: datetime


class SocialProfileInput(BaseModel):
    handle: str = Field(min_length=1, max_length=256)
    platform: str = Field(default="unknown", min_length=1, max_length=80)
    display_name: str | None = Field(default=None, max_length=200)
    bio: str | None = Field(default=None, max_length=2_000)

    @field_validator("handle", "platform")
    @classmethod
    def reject_blank_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This value cannot be blank.")
        return value


class SocialDetectionRequest(BaseModel):
    brand_profile_id: int = Field(gt=0)
    profiles: list[SocialProfileInput] = Field(max_length=500)


class AppRiskRequest(BaseModel):
    app_name: str = Field(min_length=1, max_length=200)
    package_name: str | None = Field(default=None, max_length=256)
    sha256: str | None = Field(default=None, pattern=r"^[A-Fa-f0-9]{64}$")
    permissions: list[str] = Field(default_factory=list, max_length=200)

    @field_validator("app_name")
    @classmethod
    def clean_app_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("App name cannot be blank.")
        return value


class DomainDetectionRequest(BaseModel):
    brand_profile_id: int = Field(gt=0)
    domain: str = Field(min_length=1, max_length=253)

    @field_validator("domain")
    @classmethod
    def clean_domain(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Domain cannot be blank.")
        return value


class DetectionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    kind: Literal["social", "apk", "domain"]
    target: str
    risk_score: float
    risk_level: Literal["low", "medium", "high"]
    findings: list[str]
    analysis_scope: str
    created_at: datetime


class SocialDetectionResponse(BaseModel):
    detections: list[DetectionRead]
    checked_profiles: int
    analysis_scope: str


class DashboardStats(BaseModel):
    total_brands: int
    total_detections: int
    high_risk_detections: int
    detections_by_type: dict[str, int]


class DetectionHistory(BaseModel):
    items: list[DetectionRead]
    total: int
    limit: int
    offset: int
