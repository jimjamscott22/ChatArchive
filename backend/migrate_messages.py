#!/usr/bin/env python
"""
Migration script to parse existing raw_json data and populate the messages table.
Run this after updating the database schema.
"""

import json
import sys
from pathlib import Path

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy import text
from app.database import engine, SessionLocal
from app.models import Base, Conversation, Message
from app.importers.chatgpt import extract_messages_from_mapping


def add_missing_columns():
    """Add new columns to existing tables if they don't exist."""
    print("Checking for missing columns...")
    
    with engine.connect() as conn:
        # Check conversations table columns
        result = conn.execute(text("PRAGMA table_info(conversations)"))
        existing_cols = {row[1] for row in result.fetchall()}
        
        # Add missing columns to conversations
        new_cols = {
            "source_id": "VARCHAR(255)",
            "updated_at": "DATETIME",
            "message_count": "INTEGER DEFAULT 0",
        }
        
        for col, col_type in new_cols.items():
            if col not in existing_cols:
                print(f"  Adding column: conversations.{col}")
                conn.execute(text(f"ALTER TABLE conversations ADD COLUMN {col} {col_type}"))
        
        conn.commit()
        
    # Create messages table if it doesn't exist
    Base.metadata.create_all(bind=engine)
    print("Schema updated.")


def migrate_messages():
    """Parse raw_json from existing conversations and create message records."""
    
    # First, add missing columns
    add_missing_columns()
    
    db = SessionLocal()
    
    try:
        # Check if messages already exist
        existing_count = db.query(Message).count()
        if existing_count > 0:
            print(f"⚠️  Messages table already has {existing_count} records.")
            response = input("Do you want to clear and re-import? (y/N): ")
            if response.lower() != 'y':
                print("Aborted.")
                return
            db.query(Message).delete()
            db.commit()
            print("Cleared existing messages.")
        
        # Get all conversations
        conversations = db.query(Conversation).all()
        total = len(conversations)
        print(f"Processing {total} conversations...")
        
        total_messages = 0
        errors = 0
        
        for i, convo in enumerate(conversations, 1):
            try:
                # Parse raw_json
                data = json.loads(convo.raw_json)
                
                # Handle different sources
                if convo.source == "chatgpt":
                    mapping = data.get("mapping", {})
                    messages = extract_messages_from_mapping(mapping)
                else:
                    # Skip unsupported sources for now
                    messages = []
                
                # Create message records
                for msg_data in messages:
                    message = Message(conversation_id=convo.id, **msg_data)
                    db.add(message)
                
                # Update conversation message count
                convo.message_count = len(messages)
                
                # Update source_id if missing
                if not convo.source_id:
                    convo.source_id = data.get("id") or data.get("conversation_id")
                
                # Update updated_at if missing
                if not convo.updated_at:
                    update_time = data.get("update_time")
                    if update_time:
                        try:
                            from datetime import datetime
                            convo.updated_at = datetime.fromtimestamp(update_time)
                        except (OSError, TypeError, ValueError):
                            pass
                
                total_messages += len(messages)
                
                # Progress indicator
                if i % 100 == 0 or i == total:
                    print(f"  Processed {i}/{total} conversations ({total_messages} messages)")
                    db.commit()
                    
            except Exception as e:
                errors += 1
                print(f"  ⚠️  Error processing conversation {convo.id}: {e}")
                continue
        
        db.commit()
        
        print(f"\n✓ Migration complete!")
        print(f"  Conversations: {total}")
        print(f"  Messages extracted: {total_messages}")
        if errors:
            print(f"  Errors: {errors}")
            
    finally:
        db.close()


if __name__ == "__main__":
    migrate_messages()
