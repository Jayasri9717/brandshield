"""FastAPI application and public health endpoints."""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.responses import RedirectResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app import database
from app.database import create_db_and_tables
from app.routers import brands, dashboard, detections


@asynccontextmanager
async def lifespan(_: FastAPI):
    create_db_and_tables()
    yield


app = FastAPI(
    title="BrandShield Sentinel API",
    description=(
        "Evidence-led brand-risk triage. Detection scores are transparent heuristics "
        "over submitted data, not trained-model predictions or proof of malicious activity."
    ),
    version="1.1.0",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

origins = [
    origin.strip()
    for origin in os.getenv(
        "FRONTEND_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT"],
    allow_headers=["*"],
)

app.include_router(brands.router)
app.include_router(detections.router)
app.include_router(dashboard.router)


@app.get("/", tags=["Health"])
def home() -> dict[str, str]:
    return {"message": "BrandShield Sentinel API is running.", "status": "healthy"}


@app.get("/api", include_in_schema=False)
def api_home() -> RedirectResponse:
    """Send the artifact's preview root to its interactive API documentation."""
    return RedirectResponse(url="/api/docs", status_code=307)


@app.get("/api/docs", include_in_schema=False)
def api_swagger_docs():
    """Expose Swagger UI under the API artifact's routed /api prefix."""
    return get_swagger_ui_html(
        openapi_url="/api/openapi.json",
        title="BrandShield Sentinel API",
    )


@app.get("/openapi.json", include_in_schema=False)
def root_openapi_schema() -> dict:
    """Keep the standard local OpenAPI URL available for direct FastAPI runs."""
    return app.openapi()


@app.get("/health", tags=["Health"])
@app.get("/api/health", tags=["Health"], include_in_schema=False)
@app.get("/api/healthz", tags=["Health"], include_in_schema=False)
def health() -> dict[str, str]:
    """Liveness plus a lightweight database connectivity check."""
    try:
        with database.SessionLocal() as db:
            db.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="Database is unavailable.") from exc
    return {"status": "ok"}
