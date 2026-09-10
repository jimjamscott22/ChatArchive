from __future__ import annotations

from collections.abc import Sequence
import os
import secrets

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

load_dotenv()

_raw_token = os.environ.get("APP_API_TOKEN")
if not _raw_token:
    raise RuntimeError(
        "APP_API_TOKEN must be set. Generate one with: "
        'python -c "import secrets; print(secrets.token_hex(32))" '
        "and add it to backend/.env"
    )
API_TOKEN: str = _raw_token

PROTECTED_PREFIXES = (
    "/conversations",
    "/stats",
    "/analytics",
    "/import",
    "/settings",
    "/tags",
    "/projects",
    "/resources",
    "/storage",
    "/sync",
)


def is_protected_path(path: str) -> bool:
    return path.startswith(PROTECTED_PREFIXES)


def is_authorized(auth_header: str | None) -> bool:
    if not auth_header or not auth_header.startswith("Bearer "):
        return False
    return secrets.compare_digest(auth_header.removeprefix("Bearer "), API_TOKEN)


def configure_api_middleware(
    app: FastAPI,
    *,
    allowed_origins: Sequence[str],
) -> None:
    @app.middleware("http")
    async def enforce_api_token(request: Request, call_next):
        if request.method != "OPTIONS" and is_protected_path(request.url.path):
            if not is_authorized(request.headers.get("authorization")):
                return JSONResponse({"detail": "Unauthorized"}, status_code=401)
        return await call_next(request)

    # Starlette runs the last-added middleware first, so CORS must be added
    # after authentication to decorate early 401 responses as well.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(allowed_origins),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
