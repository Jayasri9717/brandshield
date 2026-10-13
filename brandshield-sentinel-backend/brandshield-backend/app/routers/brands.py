"""Brand profile endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import BrandProfile
from app.schemas import BrandProfileCreate, BrandProfileRead, BrandProfileUpdate

router = APIRouter(prefix="/api/brands", tags=["Brand profiles"])


@router.post(
    "",
    response_model=BrandProfileRead,
    status_code=status.HTTP_201_CREATED,
    summary="Register a brand profile",
    description="Save handles and domains that your team has independently verified.",
)
def create_brand(payload: BrandProfileCreate, db: Session = Depends(get_db)) -> BrandProfile:
    brand = BrandProfile(**payload.model_dump())
    db.add(brand)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="A brand profile with this name already exists.") from exc
    db.refresh(brand)
    return brand


@router.get("", response_model=list[BrandProfileRead], summary="List brand profiles")
def list_brands(db: Session = Depends(get_db)) -> list[BrandProfile]:
    return list(db.scalars(select(BrandProfile).order_by(BrandProfile.name)).all())


@router.get("/{brand_id}", response_model=BrandProfileRead, summary="Get one brand profile")
def get_brand(brand_id: int, db: Session = Depends(get_db)) -> BrandProfile:
    brand = db.get(BrandProfile, brand_id)
    if brand is None:
        raise HTTPException(status_code=404, detail="Brand profile not found.")
    return brand


@router.put(
    "/{brand_id}",
    response_model=BrandProfileRead,
    summary="Replace a brand profile",
    description="Supply the full profile, including the official handle and domain lists.",
)
def update_brand(
    brand_id: int,
    payload: BrandProfileUpdate,
    db: Session = Depends(get_db),
) -> BrandProfile:
    brand = db.get(BrandProfile, brand_id)
    if brand is None:
        raise HTTPException(status_code=404, detail="Brand profile not found.")
    for field, value in payload.model_dump().items():
        setattr(brand, field, value)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="A brand profile with this name already exists.") from exc
    db.refresh(brand)
    return brand
