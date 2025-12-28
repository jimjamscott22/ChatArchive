from __future__ import annotations

import sys
from pathlib import Path

# Add parent directory to path to import from app
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from app.database import engine
from app.models import Base


def init_db() -> None:
    print("Initializing database...")
    Base.metadata.create_all(bind=engine)
    print(f"Database initialized successfully at: {engine.url}")


if __name__ == "__main__":
    init_db()
