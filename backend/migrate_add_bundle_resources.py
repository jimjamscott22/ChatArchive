#!/usr/bin/env python
"""Add provider project provenance and export-bundle resources.

Run from ``backend/`` with:

    uv run python migrate_add_bundle_resources.py

The migration is PostgreSQL-only and safe to run repeatedly.

Rollback SQL (destructive; review retention requirements first):

    DROP INDEX IF EXISTS ix_resources_search_vector;
    DROP TABLE IF EXISTS resources;
    ALTER TABLE import_history
      DROP COLUMN IF EXISTS warning_count,
      DROP COLUMN IF EXISTS unavailable_resource_count,
      DROP COLUMN IF EXISTS resource_count,
      DROP COLUMN IF EXISTS manifest_json;
    DROP INDEX IF EXISTS uq_projects_source_source_id;
    ALTER TABLE projects
      DROP COLUMN IF EXISTS raw_json,
      DROP COLUMN IF EXISTS instructions,
      DROP COLUMN IF EXISTS source_id,
      DROP COLUMN IF EXISTS source;
"""

from __future__ import annotations

from sqlalchemy import text

from app.database import engine


def migrate_add_bundle_resources() -> None:
    if engine.dialect.name != "postgresql":
        raise RuntimeError("Bundle resource migration requires PostgreSQL")

    statements = [
        """
        ALTER TABLE projects
          ADD COLUMN IF NOT EXISTS source VARCHAR(50),
          ADD COLUMN IF NOT EXISTS source_id VARCHAR(255),
          ADD COLUMN IF NOT EXISTS instructions TEXT,
          ADD COLUMN IF NOT EXISTS raw_json TEXT
        """,
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_projects_source_source_id
        ON projects (source, source_id)
        """,
        """
        ALTER TABLE import_history
          ADD COLUMN IF NOT EXISTS manifest_json TEXT,
          ADD COLUMN IF NOT EXISTS resource_count INTEGER NOT NULL DEFAULT 0,
          ADD COLUMN IF NOT EXISTS unavailable_resource_count INTEGER NOT NULL DEFAULT 0,
          ADD COLUMN IF NOT EXISTS warning_count INTEGER NOT NULL DEFAULT 0
        """,
        """
        CREATE TABLE IF NOT EXISTS resources (
          id SERIAL PRIMARY KEY,
          import_history_id INTEGER NOT NULL
            REFERENCES import_history(id) ON DELETE CASCADE,
          project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
          conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
          message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
          source VARCHAR(50) NOT NULL,
          source_id VARCHAR(255),
          logical_id VARCHAR(255),
          version_index INTEGER,
          kind VARCHAR(50) NOT NULL,
          title VARCHAR(255),
          filename VARCHAR(255),
          mime_type VARCHAR(255),
          availability VARCHAR(50) NOT NULL,
          byte_size INTEGER,
          sha256 VARCHAR(64),
          storage_path VARCHAR(1000),
          text_content TEXT,
          metadata_json TEXT NOT NULL DEFAULT '{}',
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_resources_id ON resources (id)",
        """
        CREATE INDEX IF NOT EXISTS ix_resources_import_history_id
        ON resources (import_history_id)
        """,
        "CREATE INDEX IF NOT EXISTS ix_resources_project_id ON resources (project_id)",
        """
        CREATE INDEX IF NOT EXISTS ix_resources_conversation_id
        ON resources (conversation_id)
        """,
        "CREATE INDEX IF NOT EXISTS ix_resources_message_id ON resources (message_id)",
        "CREATE INDEX IF NOT EXISTS ix_resources_source ON resources (source)",
        "CREATE INDEX IF NOT EXISTS ix_resources_source_id ON resources (source_id)",
        "CREATE INDEX IF NOT EXISTS ix_resources_kind ON resources (kind)",
        """
        CREATE INDEX IF NOT EXISTS ix_resources_availability
        ON resources (availability)
        """,
        "CREATE INDEX IF NOT EXISTS ix_resources_sha256 ON resources (sha256)",
        "CREATE INDEX IF NOT EXISTS ix_resources_created_at ON resources (created_at)",
        """
        CREATE INDEX IF NOT EXISTS ix_resources_source_identity
        ON resources (source, source_id)
        """,
        """
        CREATE INDEX IF NOT EXISTS ix_resources_conversation_logical_version
        ON resources (conversation_id, logical_id, version_index)
        """,
        """
        CREATE INDEX IF NOT EXISTS ix_resources_search_vector
        ON resources USING GIN (
          to_tsvector(
            'english',
            coalesce(title, '') || ' ' ||
            coalesce(filename, '') || ' ' ||
            coalesce(text_content, '')
          )
        )
        """,
    ]

    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))

    print("[OK] Bundle resource migration completed successfully")


if __name__ == "__main__":
    migrate_add_bundle_resources()
