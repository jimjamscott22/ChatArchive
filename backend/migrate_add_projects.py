#!/usr/bin/env python
"""
Migration script to add project folder support.

This script:
1. Creates the 'projects' table
2. Adds 'project_id' column to the 'conversations' table
"""

from __future__ import annotations

import sqlite3
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "chatarchive.db"


def migrate() -> None:
    """Run the migration to add project support."""
    
    if not DB_PATH.exists():
        print("Database not found. Please run init_db.py first.")
        return
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Check if projects table already exists
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='projects'"
        )
        if cursor.fetchone():
            print("[SKIP] Projects table already exists")
        else:
            # Create projects table
            print("Creating projects table...")
            cursor.execute("""
                CREATE TABLE projects (
                    id INTEGER PRIMARY KEY,
                    name VARCHAR(100) NOT NULL UNIQUE,
                    description VARCHAR(500),
                    color VARCHAR(7),
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Create indexes
            cursor.execute("CREATE INDEX ix_projects_id ON projects (id)")
            cursor.execute("CREATE INDEX ix_projects_name ON projects (name)")
            print("[OK] Projects table created")
        
        # Check if project_id column exists in conversations
        cursor.execute("PRAGMA table_info(conversations)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if "project_id" in columns:
            print("[SKIP] project_id column already exists in conversations table")
        else:
            # Add project_id column to conversations
            print("Adding project_id column to conversations...")
            cursor.execute("""
                ALTER TABLE conversations
                ADD COLUMN project_id INTEGER
                REFERENCES projects(id) ON DELETE SET NULL
            """)
            
            # Create index on project_id
            cursor.execute("CREATE INDEX ix_conversations_project_id ON conversations (project_id)")
            print("[OK] project_id column added to conversations")
        
        conn.commit()
        print("\n[SUCCESS] Migration completed successfully!")
        print("You can now use project folders to organize your conversations.")
        
    except Exception as e:
        conn.rollback()
        print(f"\n[ERROR] Migration failed: {e}")
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    migrate()
