from __future__ import annotations

import os
from typing import Any

from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables from .env file
load_dotenv()

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_BUCKET_NAME = os.getenv("SUPABASE_BUCKET_NAME", "chatarchive-exports")

# Initialize Supabase client if credentials are provided
_supabase_client: Client | None = None

def get_supabase_client() -> Client | None:
    """Get or create Supabase client instance."""
    global _supabase_client
    
    if _supabase_client is None and SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
        _supabase_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    return _supabase_client


def is_supabase_configured() -> bool:
    """Check if Supabase is properly configured."""
    return bool(SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)


def get_supabase_project_id() -> str | None:
    """Extract project ID from Supabase URL."""
    if not SUPABASE_URL:
        return None
    
    # URL format: https://<project-id>.supabase.co
    try:
        # Remove protocol
        url_without_protocol = SUPABASE_URL.replace("https://", "").replace("http://", "")
        # Extract project ID (first part before .supabase.co)
        project_id = url_without_protocol.split(".")[0]
        return project_id
    except Exception:
        return None


def get_dashboard_url() -> str | None:
    """Get the Supabase dashboard URL for the current project."""
    project_id = get_supabase_project_id()
    if not project_id:
        return None
    
    return f"https://supabase.com/dashboard/project/{project_id}"


def get_connection_info() -> dict[str, Any]:
    """Get Supabase connection information (without exposing keys)."""
    return {
        "configured": is_supabase_configured(),
        "url": SUPABASE_URL if SUPABASE_URL else None,
        "project_id": get_supabase_project_id(),
        "bucket_name": SUPABASE_BUCKET_NAME,
        "dashboard_url": get_dashboard_url(),
    }
