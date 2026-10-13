# BrandShield Sentinel backend

This is the FastAPI backend for the Digital Risk Protection Platform. It uses
SQLite through SQLAlchemy. Detection scores are produced by transparent,
rule-based checks; they are not predictions from a trained machine-learning
model and are not proof that a submitted item is malicious.

## Open it in this Replit project

Start the existing **API Server** workflow. In the project preview:

- Swagger UI: `/api/docs`
- Health check: `/api/health`
- OpenAPI JSON: `/api/openapi.json`

The `/api` prefix is part of this Replit API service's preview route.

## Run locally

Use Python 3.11 or newer. From this folder:

```bash
python -m venv .venv
```

Activate the environment, then install and run:

```bash
pip install -r requirements.txt
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

Open `http://127.0.0.1:8000/docs` for Swagger UI or
`http://127.0.0.1:8000/health` for the health check. The local SQLite database
is created automatically in the current working directory.

## Run automated tests

From this folder, with the dependencies installed:

```bash
pytest -q
```

## Main API routes

- `POST /api/brands` and `GET /api/brands` — create and list brand profiles
- `GET /api/brands/{brand_id}` and `PUT /api/brands/{brand_id}` — read or update a brand
- `POST /api/detections/social` — analyze submitted social content
- `POST /api/detections/apps` — review app/APK metadata and permissions
- `POST /api/detections/domains` — compare a domain with a brand profile
- `GET /api/dashboard/stats` — dashboard totals and risk counts
- `GET /api/history` — recent detection history
