
"""Uvicorn entry point; run with ``uvicorn backend.main:app --reload``."""

from app.main import app

__all__ = ["app"]
