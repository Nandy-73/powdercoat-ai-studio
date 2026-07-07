import os

os.environ["DATABASE_URL"] = "sqlite:///./test_powdercoat.db"
os.environ["SEED_DATA"] = "true"

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="session")
def client():
    if os.path.exists("test_powdercoat.db"):
        os.remove("test_powdercoat.db")
    from app.main import app

    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def auth_headers(client):
    resp = client.post(
        "/api/v1/auth/login/json",
        json={"email": "admin@powdercoat.ai", "password": "admin123"},
    )
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
