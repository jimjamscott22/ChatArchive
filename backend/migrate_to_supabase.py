#!/usr/bin/env python3
"""
Migration script to migrate data from local SQLite to Supabase PostgreSQL.

This script reads all conversations, messages, tags, projects, and import history
from the local SQLite database and inserts them into the Supabase PostgreSQL database.

Usage:
    python migrate_to_supabase.py

Prerequisites:
    - Supabase environment variables must be configured in backend/.env
    - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set
    - Supabase PostgreSQL database must have the schema already created
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
from sqlalchemy import create_engine, func
from sqlalchemy.orm import sessionmaker

from app.models import Base, Conversation, Message, Tag, ConversationTag, Project, ImportHistory, ImportSettings

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")


def create_sqlite_engine():
    """Create SQLite engine for source database."""
    BASE_DIR = Path(__file__).parent
    DB_PATH = BASE_DIR / "chatarchive.db"
    
    if not DB_PATH.exists():
        print(f"❌ Error: SQLite database not found at {DB_PATH}")
        sys.exit(1)
    
    DATABASE_URL = f"sqlite:///{DB_PATH}"
    return create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False}
    )


def create_postgresql_engine():
    """Create PostgreSQL engine for Supabase destination database."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        print("❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env")
        sys.exit(1)
    
    try:
        # Extract project reference from Supabase URL
        project_ref = SUPABASE_URL.replace("https://", "").replace("http://", "").split(".")[0]
        
        # Get database password (defaults to service role key if not specified)
        db_password = os.getenv("SUPABASE_DB_PASSWORD", SUPABASE_SERVICE_ROLE_KEY)
        
        # Construct PostgreSQL connection URL
        DATABASE_URL = f"postgresql://postgres:{db_password}@db.{project_ref}.supabase.co:5432/postgres"
        
        return create_engine(
            DATABASE_URL,
            pool_pre_ping=True,
            pool_size=10,
            max_overflow=20
        )
    except Exception as e:
        print(f"❌ Error creating PostgreSQL connection: {e}")
        sys.exit(1)


def migrate_data():
    """Migrate all data from SQLite to PostgreSQL."""
    print("🚀 Starting migration from SQLite to Supabase PostgreSQL...\n")
    
    # Create engines
    sqlite_engine = create_sqlite_engine()
    postgres_engine = create_postgresql_engine()
    
    # Create sessions
    SQLiteSession = sessionmaker(bind=sqlite_engine)
    PostgresSession = sessionmaker(bind=postgres_engine)
    
    sqlite_db = SQLiteSession()
    postgres_db = PostgresSession()
    
    try:
        # Create all tables in PostgreSQL if they don't exist
        print("📋 Creating tables in PostgreSQL...")
        Base.metadata.create_all(postgres_engine)
        print("✅ Tables created\n")
        
        # Migrate Tags first (no dependencies)
        print("🏷️  Migrating Tags...")
        tags = sqlite_db.query(Tag).all()
        tag_count = 0
        for tag in tags:
            # Check if tag already exists
            existing = postgres_db.query(Tag).filter(Tag.name == tag.name).first()
            if not existing:
                new_tag = Tag(
                    id=tag.id,
                    name=tag.name,
                    description=tag.description,
                    color=tag.color,
                    created_at=tag.created_at,
                )
                postgres_db.add(new_tag)
                tag_count += 1
        
        postgres_db.commit()
        print(f"✅ Migrated {tag_count} tags\n")
        
        # Migrate Projects (no dependencies)
        print("📁 Migrating Projects...")
        projects = sqlite_db.query(Project).all()
        project_count = 0
        for project in projects:
            # Check if project already exists
            existing = postgres_db.query(Project).filter(Project.name == project.name).first()
            if not existing:
                new_project = Project(
                    id=project.id,
                    name=project.name,
                    description=project.description,
                    color=project.color,
                    created_at=project.created_at,
                )
                postgres_db.add(new_project)
                project_count += 1
        
        postgres_db.commit()
        print(f"✅ Migrated {project_count} projects\n")
        
        # Migrate Import History (no dependencies)
        print("📜 Migrating Import History...")
        import_history = sqlite_db.query(ImportHistory).all()
        history_count = 0
        for history in import_history:
            existing = postgres_db.query(ImportHistory).filter(ImportHistory.id == history.id).first()
            if not existing:
                new_history = ImportHistory(
                    id=history.id,
                    filename=history.filename,
                    source_location=history.source_location,
                    source_type=history.source_type,
                    file_format=history.file_format,
                    status=history.status,
                    created_at=history.created_at,
                    imported_count=history.imported_count,
                    error_message=history.error_message,
                )
                postgres_db.add(new_history)
                history_count += 1
        
        postgres_db.commit()
        print(f"✅ Migrated {history_count} import history records\n")
        
        # Migrate Import Settings
        print("⚙️  Migrating Import Settings...")
        settings = sqlite_db.query(ImportSettings).first()
        if settings:
            existing = postgres_db.query(ImportSettings).first()
            if not existing:
                new_settings = ImportSettings(
                    id=settings.id,
                    allowed_formats=settings.allowed_formats,
                    default_format=settings.default_format,
                    auto_merge_duplicates=settings.auto_merge_duplicates,
                    keep_separate=settings.keep_separate,
                    skip_empty_conversations=settings.skip_empty_conversations,
                    updated_at=settings.updated_at,
                )
                postgres_db.add(new_settings)
                postgres_db.commit()
                print("✅ Migrated import settings\n")
            else:
                print("ℹ️  Import settings already exist in PostgreSQL\n")
        else:
            print("ℹ️  No import settings to migrate\n")
        
        # Migrate Conversations (depends on Projects and ImportHistory)
        print("💬 Migrating Conversations...")
        conversations = sqlite_db.query(Conversation).all()
        conversation_count = 0
        for conv in conversations:
            # Check if conversation already exists
            existing = postgres_db.query(Conversation).filter(
                Conversation.source == conv.source,
                Conversation.source_id == conv.source_id
            ).first()
            
            if not existing:
                new_conv = Conversation(
                    id=conv.id,
                    source=conv.source,
                    source_id=conv.source_id,
                    title=conv.title,
                    created_at=conv.created_at,
                    updated_at=conv.updated_at,
                    message_count=conv.message_count,
                    raw_json=conv.raw_json,
                    import_history_id=conv.import_history_id,
                    project_id=conv.project_id,
                )
                postgres_db.add(new_conv)
                conversation_count += 1
        
        postgres_db.commit()
        print(f"✅ Migrated {conversation_count} conversations\n")
        
        # Migrate Messages (depends on Conversations)
        print("💭 Migrating Messages...")
        messages = sqlite_db.query(Message).all()
        message_count = 0
        for msg in messages:
            # Check if conversation exists in PostgreSQL
            conv_exists = postgres_db.query(Conversation).filter(
                Conversation.id == msg.conversation_id
            ).first()
            
            if conv_exists:
                # Check if message already exists
                existing = postgres_db.query(Message).filter(Message.id == msg.id).first()
                if not existing:
                    new_msg = Message(
                        id=msg.id,
                        conversation_id=msg.conversation_id,
                        source_id=msg.source_id,
                        role=msg.role,
                        content=msg.content,
                        content_type=msg.content_type,
                        created_at=msg.created_at,
                        order_index=msg.order_index,
                        model=msg.model,
                    )
                    postgres_db.add(new_msg)
                    message_count += 1
        
        postgres_db.commit()
        print(f"✅ Migrated {message_count} messages\n")
        
        # Migrate ConversationTags (depends on Conversations and Tags)
        print("🔗 Migrating Conversation-Tag relationships...")
        conversation_tags = sqlite_db.query(ConversationTag).all()
        ct_count = 0
        for ct in conversation_tags:
            # Check if both conversation and tag exist in PostgreSQL
            conv_exists = postgres_db.query(Conversation).filter(
                Conversation.id == ct.conversation_id
            ).first()
            tag_exists = postgres_db.query(Tag).filter(Tag.id == ct.tag_id).first()
            
            if conv_exists and tag_exists:
                # Check if relationship already exists
                existing = postgres_db.query(ConversationTag).filter(
                    ConversationTag.conversation_id == ct.conversation_id,
                    ConversationTag.tag_id == ct.tag_id,
                ).first()
                
                if not existing:
                    new_ct = ConversationTag(
                        conversation_id=ct.conversation_id,
                        tag_id=ct.tag_id,
                        created_at=ct.created_at,
                        auto_tagged=ct.auto_tagged,
                    )
                    postgres_db.add(new_ct)
                    ct_count += 1
        
        postgres_db.commit()
        print(f"✅ Migrated {ct_count} conversation-tag relationships\n")
        
        # Print summary
        print("=" * 50)
        print("✨ Migration completed successfully!")
        print("=" * 50)
        print(f"Tags: {tag_count}")
        print(f"Projects: {project_count}")
        print(f"Import History: {history_count}")
        print(f"Conversations: {conversation_count}")
        print(f"Messages: {message_count}")
        print(f"Tag Relationships: {ct_count}")
        print("=" * 50)
        
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        postgres_db.rollback()
        raise
    finally:
        sqlite_db.close()
        postgres_db.close()


if __name__ == "__main__":
    migrate_data()
