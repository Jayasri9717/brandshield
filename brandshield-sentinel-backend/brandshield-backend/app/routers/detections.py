"""Social, app metadata, and lookalike-domain detection endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.agents.social_agent import SocialAgent
from app.database import get_db
from app.models import BrandProfile, DetectionRecord
from app.schemas import (
    AppRiskRequest,
    DetectionRead,
    DomainDetectionRequest,
    SocialDetectionRequest,
    SocialDetectionResponse,
)
from app.services import app_metadata_risk, domain_risk, risk_level

router = APIRouter(prefix="/api/detections", tags=["Detections"])


def _save_detection(
    db: Session,
    *,
    kind: str,
    target: str,
    score: float,
    findings: list[str],
    analysis_scope: str,
) -> DetectionRecord:
    record = DetectionRecord(
        kind=kind,
        target=target,
        risk_score=score,
        risk_level=risk_level(score),
        findings=findings,
        analysis_scope=analysis_scope,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.post(
    "/social",
    response_model=SocialDetectionResponse,
    summary="Check submitted social handles",
    description="Compare handles with a brand profile. This endpoint does not query social networks.",
)
def detect_social_profiles(
    payload: SocialDetectionRequest,
    db: Session = Depends(get_db),
) -> SocialDetectionResponse:
    brand = db.get(BrandProfile, payload.brand_profile_id)
    if brand is None:
        raise HTTPException(status_code=404, detail="Brand profile not found.")
    if not brand.official_handles:
        raise HTTPException(status_code=400, detail="Add official handles to this brand profile first.")

    matches = SocialAgent().detect(
        {"name": brand.name, "official_handles": brand.official_handles},
        [profile.model_dump() for profile in payload.profiles],
    )
    saved: list[DetectionRecord] = []
    for match in matches:
        score = 0.0 if match["is_official"] else round(match["similarity"] * 100, 2)
        saved.append(
            _save_detection(
                db,
                kind="social",
                target=f"{match['platform']}:{match['handle']}",
                score=score,
                findings=[match["evidence"]],
                analysis_scope="submitted_profile_metadata_only",
            )
        )
    return SocialDetectionResponse(
        detections=[DetectionRead.model_validate(item) for item in saved],
        checked_profiles=len(payload.profiles),
        analysis_scope="Submitted handles only; no social network was queried.",
    )


@router.post(
    "/apps",
    response_model=DetectionRead,
    summary="Triage app metadata",
    description="Score submitted app permission names only; no APK binary or malware database is inspected.",
)
def analyze_app_metadata(payload: AppRiskRequest, db: Session = Depends(get_db)) -> DetectionRecord:
    score, findings = app_metadata_risk(payload.permissions)
    if payload.sha256:
        findings.append("A SHA-256 value was recorded but not checked against a malware database.")
    target = payload.package_name or payload.app_name
    return _save_detection(
        db,
        kind="apk",
        target=target,
        score=score,
        findings=findings,
        analysis_scope="submitted_metadata_only",
    )


@router.post(
    "/domains",
    response_model=DetectionRead,
    summary="Check a domain for lookalike signals",
    description="Compare the submitted domain string with verified domains saved on the brand profile.",
)
def detect_lookalike_domain(
    payload: DomainDetectionRequest,
    db: Session = Depends(get_db),
) -> DetectionRecord:
    brand = db.get(BrandProfile, payload.brand_profile_id)
    if brand is None:
        raise HTTPException(status_code=404, detail="Brand profile not found.")
    try:
        score, findings, host = domain_risk(payload.domain, brand.official_domains)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return _save_detection(
        db,
        kind="domain",
        target=host,
        score=score,
        findings=findings,
        analysis_scope="submitted_domain_string_only",
    )
