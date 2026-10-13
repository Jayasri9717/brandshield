"""End-to-end tests for the FastAPI routes using an isolated SQLite database."""


def create_brand(client):
    response = client.post(
        "/api/brands",
        json={
            "name": "Example Bank",
            "official_handles": ["examplebank", "example_bank"],
            "official_domains": ["examplebank.com"],
        },
    )
    assert response.status_code == 201
    return response.json()


def test_health_and_swagger_docs(client):
    assert client.get("/health").json() == {"status": "ok"}
    assert client.get("/api/health").json() == {"status": "ok"}
    assert client.get("/api/healthz").json() == {"status": "ok"}
    assert client.get("/docs").status_code == 200
    openapi = client.get("/openapi.json").json()
    api_home = client.get("/api")
    assert api_home.status_code == 200
    assert api_home.url.path == "/api/docs"
    assert client.get("/api/docs").status_code == 200
    assert client.get("/api/openapi.json").status_code == 200
    assert "/api/detections/social" in openapi["paths"]
    assert "/api/detections/apps" in openapi["paths"]
    assert "/api/detections/domains" in openapi["paths"]


def test_brand_profile_create_list_and_duplicate_error(client):
    brand = create_brand(client)
    assert brand["name"] == "Example Bank"
    assert client.get("/api/brands").json()[0]["id"] == brand["id"]
    updated = client.put(
        f"/api/brands/{brand['id']}",
        json={
            "name": "Example Bank Group",
            "official_handles": ["@examplebank"],
            "official_domains": ["examplebank.com", "invest.examplebank.com"],
        },
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Example Bank Group"
    assert updated.json()["official_handles"] == ["examplebank"]
    duplicate = client.post("/api/brands", json={"name": "Example Bank Group"})
    assert duplicate.status_code == 409
    assert duplicate.json()["detail"] == "A brand profile with this name already exists."


def test_social_check_saves_explainable_matches_to_history(client):
    brand = create_brand(client)
    response = client.post(
        "/api/detections/social",
        json={
            "brand_profile_id": brand["id"],
            "profiles": [
                {"handle": "examplebank"},
                {"handle": "examplebank_support", "platform": "social"},
                {"handle": "unrelated_cats"},
            ],
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["checked_profiles"] == 3
    assert len(body["detections"]) == 2
    assert all(item["findings"] for item in body["detections"])

    history = client.get("/api/history?kind=social").json()
    assert history["total"] == 2
    assert history["items"][0]["kind"] == "social"


def test_apk_route_is_explicit_about_metadata_only_analysis(client):
    response = client.post(
        "/api/detections/apps",
        json={
            "app_name": "Unknown Wallet",
            "package_name": "com.example.wallet",
            "permissions": ["android.permission.SEND_SMS", "android.permission.READ_SMS"],
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["risk_level"] == "high"
    assert body["analysis_scope"] == "submitted_metadata_only"
    assert any("not scanned" in finding for finding in body["findings"])


def test_lookalike_domain_and_dashboard_counts(client):
    brand = create_brand(client)
    response = client.post(
        "/api/detections/domains",
        json={"brand_profile_id": brand["id"], "domain": "examp1ebank.com"},
    )
    assert response.status_code == 200
    assert response.json()["risk_score"] > 0
    assert response.json()["analysis_scope"] == "submitted_domain_string_only"

    stats = client.get("/api/dashboard/stats").json()
    assert stats == {
        "total_brands": 1,
        "total_detections": 1,
        "high_risk_detections": 1,
        "detections_by_type": {"domain": 1},
    }


def test_validation_and_missing_brand_errors_are_readable(client):
    assert client.post("/api/brands", json={"name": "   "}).status_code == 422
    missing = client.post(
        "/api/detections/social",
        json={"brand_profile_id": 999, "profiles": []},
    )
    assert missing.status_code == 404
    assert missing.json()["detail"] == "Brand profile not found."
