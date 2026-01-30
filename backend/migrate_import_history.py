#!/usr/bin/env python
"""Add import_history_id column to conversations table."""

import sqlite3
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "chatarchive.db"


def migrate():
    """Add the missing import_history_id column."""
    print(f"Migrating database at {DB_PATH}")

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # Check if column already exists
        cursor.execute("PRAGMA table_info(conversations)")
        columns = [row[1] for row in cursor.fetchall()]

        if 'import_history_id' in columns:
            print("[INFO] Column import_history_id already exists, skipping migration")
            return

        print("[INFO] Adding import_history_id column to conversations table...")

        # Add the new column (nullable, with index)
        cursor.execute("""
            ALTER TABLE conversations
            ADD COLUMN import_history_id INTEGER
            REFERENCES import_history(id) ON DELETE SET NULL
        """)

        # Create index for the new column
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS ix_conversations_import_history_id
            ON conversations(import_history_id)
        """)

        conn.commit()
        print("[OK] Migration completed successfully!")
        print("     - Added import_history_id column")
        print("     - Created index on import_history_id")

    except Exception as e:
        conn.rollback()
        print(f"[ERROR] Migration failed: {e}")
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    migrate()
