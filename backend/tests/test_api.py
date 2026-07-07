def test_health(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_login_bad_password(client):
    resp = client.post(
        "/api/v1/auth/login/json",
        json={"email": "admin@powdercoat.ai", "password": "wrong"},
    )
    assert resp.status_code == 401


def test_me(client, auth_headers):
    resp = client.get("/api/v1/auth/me", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["role"] == "administrator"


def test_materials_requires_auth(client):
    assert client.get("/api/v1/materials").status_code == 401


def test_materials_seeded(client, auth_headers):
    resp = client.get("/api/v1/materials", headers=auth_headers)
    assert resp.status_code == 200
    assert len(resp.json()) > 20


def test_formulation_metrics_and_validation(client, auth_headers):
    formulations = client.get("/api/v1/formulations", headers=auth_headers).json()
    assert len(formulations) >= 4
    fid = formulations[0]["id"]

    metrics = client.get(f"/api/v1/formulations/{fid}/metrics", headers=auth_headers).json()
    assert metrics["total_weight_kg"] > 0

    validation = client.get(f"/api/v1/formulations/{fid}/validate", headers=auth_headers).json()
    assert "score" in validation and "issues" in validation


def test_batch_scaling(client, auth_headers):
    fid = client.get("/api/v1/formulations", headers=auth_headers).json()[0]["id"]
    resp = client.get(f"/api/v1/formulations/{fid}/scale", params={"target_kg": 1000}, headers=auth_headers)
    assert resp.status_code == 200
    assert abs(sum(i["weight_kg"] for i in resp.json()["items"]) - 1000) < 1


def test_color_match(client, auth_headers):
    resp = client.post(
        "/api/v1/color/match",
        json={"target_hex": "#CC0605", "actual_hex": "#7A0C14"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["delta_e_2000"] > 2
    assert body["issues"]
    assert body["ral_estimate_target"]["code"].startswith("RAL")


def test_predictions(client, auth_headers):
    fid = client.get("/api/v1/formulations", headers=auth_headers).json()[0]["id"]
    finish = client.get(f"/api/v1/ai/predict/finish/{fid}", headers=auth_headers)
    assert finish.status_code == 200
    assert 0 <= finish.json()["gloss_60deg"] <= 100

    mech = client.get(f"/api/v1/ai/predict/mechanical/{fid}", headers=auth_headers)
    assert mech.status_code == 200
    assert "hardness" in mech.json()

    mfg = client.get(f"/api/v1/ai/predict/manufacturing/{fid}", headers=auth_headers)
    assert mfg.status_code == 200
    assert "production_risks" in mfg.json()


def test_assistant(client, auth_headers):
    fid = client.get("/api/v1/formulations", headers=auth_headers).json()[0]["id"]
    resp = client.post(
        "/api/v1/ai/assistant",
        json={"question": "Reduce cost by 10%", "formulation_id": fid},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["intent"] == "cost_reduction"


def test_dashboard(client, auth_headers):
    resp = client.get("/api/v1/dashboard/summary", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["kpis"]["total_formulations"] >= 4


def test_price_ranking(client, auth_headers):
    resp = client.get(
        "/api/v1/prices/rank",
        params={"material": "Titanium", "criterion": "overall"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    ranks = resp.json()
    assert ranks[0]["rank"] == 1


def test_reports_csv(client, auth_headers):
    resp = client.get("/api/v1/reports/materials.csv", headers=auth_headers)
    assert resp.status_code == 200
    assert "Code,Name,Category" in resp.text


def test_viewer_cannot_create_material(client):
    login = client.post(
        "/api/v1/auth/login/json",
        json={"email": "viewer@powdercoat.ai", "password": "viewer123"},
    ).json()
    headers = {"Authorization": f"Bearer {login['access_token']}"}
    resp = client.post(
        "/api/v1/materials",
        json={"name": "X", "code": "X-1", "category": "resin"},
        headers=headers,
    )
    assert resp.status_code == 403
