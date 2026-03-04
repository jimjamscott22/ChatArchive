#!/usr/bin/env python3
"""
keepalive_supabase.py

Sends a lightweight read request to the configured Supabase project to prevent
free-tier projects from being paused due to inactivity.

Usage:
    python backend/keepalive_supabase.py

Required environment variables:
    SUPABASE_URL      – e.g. https://yourproject.supabase.co
    SUPABASE_ANON_KEY – your project's anon/public API key

Optional environment variables:
    SUPABASE_KEEPALIVE_TABLE – table to query (default: conversations)
"""

import os
import sys
from pathlib import Path

# Load .env from the backend directory when run directly
_backend_dir = Path(__file__).parent
_dotenv_path = _backend_dir / ".env"
if _dotenv_path.exists():
    try:
        from dotenv import load_dotenv
        load_dotenv(_dotenv_path)
    except ImportError:
        pass  # python-dotenv not installed; rely on environment variables

import requests  # noqa: E402  (imported after dotenv load)


def main() -> None:
    supabase_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    supabase_anon_key = os.environ.get("SUPABASE_ANON_KEY", "")

    if not supabase_url:
        print("ERROR: SUPABASE_URL environment variable is not set.", file=sys.stderr)
        sys.exit(1)

    if not supabase_anon_key:
        print("ERROR: SUPABASE_ANON_KEY environment variable is not set.", file=sys.stderr)
        sys.exit(1)

    table = os.environ.get("SUPABASE_KEEPALIVE_TABLE", "conversations")

    url = f"{supabase_url}/rest/v1/{table}"
    headers = {
        "apikey": supabase_anon_key,
        "Authorization": f"Bearer {supabase_anon_key}",
    }
    params = {"select": "id", "limit": "1"}

    try:
        response = requests.get(url, headers=headers, params=params, timeout=15)
    except requests.exceptions.RequestException as exc:
        print(f"ERROR: Request to Supabase failed: {exc}", file=sys.stderr)
        sys.exit(1)

    if not response.ok:
        print(
            f"ERROR: Supabase returned HTTP {response.status_code}: {response.text}",
            file=sys.stderr,
        )
        sys.exit(1)

    print(
        f"OK: Supabase keepalive succeeded "
        f"(table={table!r}, status={response.status_code})."
    )


if __name__ == "__main__":
    main()
