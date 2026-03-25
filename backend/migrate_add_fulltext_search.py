#!/usr/bin/env python
"""
Migration script to add PostgreSQL full-text search support.

Adds a search_vector tsvector column to conversations, triggers to keep it
in sync, and a GIN index for fast search. Replaces ILIKE with proper
full-text search and relevance ranking.

Requires PostgreSQL (Supabase). Safe to run multiple times.
"""

from sqlalchemy import text
from app.database import engine


def migrate_add_fulltext_search() -> None:
    """Add full-text search column, triggers, and index."""
    print("Running migration: Add full-text search support")

    with engine.connect() as conn:
        # 1. Add search_vector column if not exists
        conn.execute(text("""
            ALTER TABLE conversations
            ADD COLUMN IF NOT EXISTS search_vector tsvector
        """))
        conn.commit()
        print("  [OK] Added search_vector column")

    with engine.connect() as conn:
        # 2. Create or replace the function that updates search_vector
        conn.execute(text("""
            CREATE OR REPLACE FUNCTION conversations_update_search_vector()
            RETURNS TRIGGER AS $$
            DECLARE
                conv_title text;
                msg_content text;
            BEGIN
                IF TG_TABLE_NAME = 'conversations' THEN
                    conv_title := COALESCE(NEW.title, '');
                    SELECT COALESCE(string_agg(content, ' '), '')
                    INTO msg_content
                    FROM messages WHERE conversation_id = NEW.id;
                ELSE
                    SELECT COALESCE(c.title, '')
                    INTO conv_title
                    FROM conversations c WHERE c.id = COALESCE(NEW.conversation_id, OLD.conversation_id);
                    SELECT COALESCE(string_agg(content, ' '), '')
                    INTO msg_content
                    FROM messages
                    WHERE conversation_id = COALESCE(NEW.conversation_id, OLD.conversation_id);
                END IF;

                IF TG_TABLE_NAME = 'conversations' THEN
                    UPDATE conversations
                    SET search_vector = (
                        setweight(to_tsvector('english', COALESCE(conv_title, '')), 'A') ||
                        setweight(to_tsvector('english', COALESCE(msg_content, '')), 'B')
                    )
                    WHERE id = NEW.id;
                ELSE
                    UPDATE conversations
                    SET search_vector = (
                        setweight(to_tsvector('english', COALESCE(conv_title, '')), 'A') ||
                        setweight(to_tsvector('english', COALESCE(msg_content, '')), 'B')
                    )
                    WHERE id = COALESCE(NEW.conversation_id, OLD.conversation_id);
                END IF;
                RETURN COALESCE(NEW, OLD);
            END;
            $$ LANGUAGE plpgsql;
        """))
        conn.commit()
        print("  [OK] Created update function")

    with engine.connect() as conn:
        # 3. Drop existing triggers if they exist (for idempotency)
        conn.execute(text("""
            DROP TRIGGER IF EXISTS conversations_search_vector_trigger ON conversations;
            DROP TRIGGER IF EXISTS messages_search_vector_trigger ON messages;
        """))
        conn.commit()

    with engine.connect() as conn:
        # 4. Create triggers
        conn.execute(text("""
            CREATE TRIGGER conversations_search_vector_trigger
            AFTER INSERT OR UPDATE OF title ON conversations
            FOR EACH ROW EXECUTE PROCEDURE conversations_update_search_vector();
        """))
        conn.execute(text("""
            CREATE TRIGGER messages_search_vector_trigger
            AFTER INSERT OR UPDATE OF content OR DELETE ON messages
            FOR EACH ROW EXECUTE PROCEDURE conversations_update_search_vector();
        """))
        conn.commit()
        print("  [OK] Created triggers")

    with engine.connect() as conn:
        # 5. Backfill existing conversations
        conn.execute(text("""
            UPDATE conversations c
            SET search_vector = (
                setweight(to_tsvector('english', COALESCE(c.title, '')), 'A') ||
                setweight(to_tsvector('english', COALESCE(
                    (SELECT string_agg(m.content, ' ') FROM messages m WHERE m.conversation_id = c.id),
                    ''
                )), 'B')
            )
            WHERE c.search_vector IS NULL OR c.search_vector = ''
        """))
        conn.commit()
        print("  [OK] Backfilled search vectors")

    with engine.connect() as conn:
        # 6. Create GIN index for fast search
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_conversations_search_vector
            ON conversations USING GIN (search_vector)
        """))
        conn.commit()
        print("  [OK] Created GIN index")

    print("[OK] Full-text search migration completed successfully")


if __name__ == "__main__":
    migrate_add_fulltext_search()
