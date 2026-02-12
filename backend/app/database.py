from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Load environment variables
load_dotenv()

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# Database mode determination
DATABASE_MODE = "postgresql" if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY else "sqlite"

# Database URL construction
if DATABASE_MODE == "postgresql":
    # Extract connection details from Supabase URL
    # Format: https://<project-ref>.supabase.co
    # We need to construct: postgresql://postgres:[password]@db.<project-ref>.supabase.co:5432/postgres
    try:
        project_ref = SUPABASE_URL.replace("https://", "").replace("http://", "").split(".")[0]
        # For Supabase, we use the service role key as password for direct database connection
        # Note: In production, you might want to use a dedicated database password
        db_password = os.getenv("SUPABASE_DB_PASSWORD", SUPABASE_SERVICE_ROLE_KEY)
        DATABASE_URL = f"postgresql://postgres:{db_password}@db.{project_ref}.supabase.co:5432/postgres"
    except Exception:
        # Fallback to SQLite if URL parsing fails
        DATABASE_MODE = "sqlite"
        BASE_DIR = Path(__file__).resolve().parent.parent
        DB_PATH = BASE_DIR / "chatarchive.db"
        DATABASE_URL = f"sqlite:///{DB_PATH}"
else:
    # Default SQLite configuration
    BASE_DIR = Path(__file__).resolve().parent.parent
    DB_PATH = BASE_DIR / "chatarchive.db"
    DATABASE_URL = f"sqlite:///{DB_PATH}"

# Create engine with appropriate settings
if DATABASE_MODE == "postgresql":
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,  # Verify connections before using them
        pool_size=10,
        max_overflow=20
    )
else:
    engine = create_engine(
        DATABASE_URL,
        connect_args={
            "check_same_thread": False,
            "timeout": 30  # Wait up to 30 seconds for lock to be released
        }
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
