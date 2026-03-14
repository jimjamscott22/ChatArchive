from __future__ import annotations

import logging
import os

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Load environment variables
load_dotenv()

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")


def _build_postgresql_url() -> str | None:
    """Construct a PostgreSQL connection URL from environment variables.

    Priority:
    1. DATABASE_URL  – paste the full connection string directly (e.g. from
       Supabase Dashboard → Settings → Database → Connection string → URI).
       Use the *Session Pooler* or *Transaction Pooler* URL for IPv4 support.
    2. Derived from SUPABASE_URL + SUPABASE_DB_PASSWORD (legacy direct host).
    """
    # 1. Direct DATABASE_URL override
    direct_url = os.getenv("DATABASE_URL")
    if direct_url:
        return direct_url

    # 2. Derive from Supabase project URL
    if not (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY):
        return None

    try:
        project_ref = SUPABASE_URL.replace("https://", "").replace("http://", "").split(".")[0]
        db_password = os.getenv("SUPABASE_DB_PASSWORD") or SUPABASE_SERVICE_ROLE_KEY
        if not os.getenv("SUPABASE_DB_PASSWORD"):
            logging.warning(
                "SUPABASE_DB_PASSWORD not set, using service role key as fallback. "
                "For production, set a dedicated database password."
            )
        return f"postgresql://postgres:{db_password}@db.{project_ref}.supabase.co:5432/postgres"
    except Exception:
        return None


def _make_engine(url: str, mode: str):
    if mode != "postgresql":
        raise ValueError("Only postgresql mode is supported")

    return create_engine(
        url,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20,
    )


def _init_engine():
    """Initialize a PostgreSQL engine for Supabase and validate connectivity."""
    pg_url = _build_postgresql_url()
    if not pg_url:
        raise RuntimeError(
            "Supabase database is not configured. Set DATABASE_URL, or set "
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
        )

    try:
        eng = _make_engine(pg_url, "postgresql")
        with eng.connect() as conn:
            conn.execute(text("SELECT 1"))
        logging.info("Connected to PostgreSQL database.")
        return eng, "postgresql"
    except Exception as exc:
        raise RuntimeError(
            "PostgreSQL connection failed. Set DATABASE_URL in backend/.env to the "
            "Supabase Session/Transaction Pooler URI and verify credentials."
        ) from exc


engine, DATABASE_MODE = _init_engine()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
