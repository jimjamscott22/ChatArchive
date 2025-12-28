#!/usr/bin/env python
"""Initialize the ChatArchive database."""

from app.database import engine
from app.models import Base


def init_db() -> None:
    """Create all database tables."""
    print("Initializing database...")
    Base.metadata.create_all(bind=engine)
    print(f"✓ Database initialized successfully")
    print(f"  Location: {engine.url}")


if __name__ == "__main__":
    init_db()
