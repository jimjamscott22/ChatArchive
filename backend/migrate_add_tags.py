#!/usr/bin/env python
"""
Migration script to add tagging support to existing ChatArchive databases.

This script adds the tags, conversation_tags tables to the database schema.
It's safe to run multiple times - it will only create tables if they don't exist.
"""

from sqlalchemy import inspect
from app.database import engine
from app.models import Base, Tag, ConversationTag


def migrate_add_tags() -> None:
    """Add tagging tables to the database."""
    print("Running migration: Add tagging support")
    
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()
    
    # Check if tags table already exists
    if "tags" in existing_tables and "conversation_tags" in existing_tables:
        print("[OK] Tagging tables already exist - no migration needed")
        return
    
    # Create only the new tables
    print("Creating tagging tables...")
    
    # Create tags table
    if "tags" not in existing_tables:
        Tag.__table__.create(bind=engine)
        print("  [OK] Created 'tags' table")
    
    # Create conversation_tags table
    if "conversation_tags" not in existing_tables:
        ConversationTag.__table__.create(bind=engine)
        print("  [OK] Created 'conversation_tags' table")
    
    print("[OK] Migration completed successfully")


if __name__ == "__main__":
    migrate_add_tags()
