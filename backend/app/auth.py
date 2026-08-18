from __future__ import annotations

import os
import secrets

from dotenv import load_dotenv

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
    "/storage",
    "/sync",
)


def is_protected_path(path: str) -> bool:
    return path.startswith(PROTECTED_PREFIXES)


def is_authorized(auth_header: str | None) -> bool:
    if not auth_header or not auth_header.startswith("Bearer "):
        return False
    return secrets.compare_digest(auth_header.removeprefix("Bearer "), API_TOKEN)
