"""Authentication boundary tests without database or local dotenv access."""
from __future__ import annotations

import asyncio
import importlib.util
from pathlib import Path

import httpx
import pytest
from fastapi import FastAPI


@pytest.fixture
def auth(monkeypatch):
    monkeypatch.setenv("APP_API_TOKEN", "test-api-token")
    monkeypatch.setattr("dotenv.load_dotenv", lambda: None)
    spec = importlib.util.spec_from_file_location(
        "auth_under_test", Path(__file__).parents[1] / "app" / "auth.py"
    )
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.mark.parametrize("path", [
    "/resources",
    "/resources/",
    "/resources/123",
    "/resources/123/",
    "/resources/123/content",
    "/resources/123/content/",
    "/conversations/123/resources",
    "/projects/123/resources",
])
def test_resource_paths_require_authentication(auth, path):
    assert auth.is_protected_path(path)


@pytest.mark.parametrize("path", ["/health", "/", "/assets/index.js"])
def test_public_paths_remain_public(auth, path):
    assert not auth.is_protected_path(path)


@pytest.mark.parametrize("header", [None, "", "Bearer ", "Bearer wrong-token", "Basic test-api-token"])
def test_missing_or_invalid_credentials_are_rejected(auth, header):
    assert not auth.is_authorized(header)


def test_valid_bearer_token_is_accepted(auth):
    assert auth.is_authorized("Bearer test-api-token")


def test_unauthorized_response_includes_cors_header(auth):
    app = FastAPI()
    auth.configure_api_middleware(
        app,
        allowed_origins=["http://localhost:5173"],
    )

    @app.get("/stats")
    def protected_route():
        return {"status": "ok"}

    async def request():
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport,
            base_url="http://testserver",
        ) as client:
            return await client.get(
                "/stats",
                headers={"Origin": "http://localhost:5173"},
            )

    response = asyncio.run(request())

    assert response.status_code == 401
    assert response.json() == {"detail": "Unauthorized"}
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
