from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Query, aliased

from app.models import Conversation, Tag


def apply_conversation_filters(
    query: Query,
    *,
    source: str | None = None,
    tag: str | None = None,
    tags: list[str] | None = None,
    project_id: int | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> Query:
    """Apply shared conversation filters to list and search queries."""

    if source:
        query = query.filter(Conversation.source == source)

    # Multi-tag AND filter: each tag gets its own aliased join so all must match
    active_tags = tags if tags else ([tag] if tag else None)
    if active_tags:
        for t in active_tags:
            tag_alias = aliased(Tag)
            query = query.join(tag_alias, Conversation.tags).filter(tag_alias.name == t)

    if project_id is not None:
        if project_id == -1:
            query = query.filter(Conversation.project_id.is_(None))
        else:
            query = query.filter(Conversation.project_id == project_id)

    if date_from is not None:
        query = query.filter(Conversation.created_at >= date_from)

    if date_to is not None:
        query = query.filter(Conversation.created_at <= date_to)

    return query
