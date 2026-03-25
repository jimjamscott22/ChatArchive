from __future__ import annotations

from sqlalchemy.orm import Query

from app.models import Conversation, Tag


def apply_conversation_filters(
    query: Query,
    *,
    source: str | None = None,
    tag: str | None = None,
    project_id: int | None = None,
) -> Query:
    """Apply shared conversation filters to list and search queries."""

    if source:
        query = query.filter(Conversation.source == source)

    if tag:
        query = query.join(Conversation.tags).filter(Tag.name == tag)

    if project_id is not None:
        if project_id == -1:
            query = query.filter(Conversation.project_id.is_(None))
        else:
            query = query.filter(Conversation.project_id == project_id)

    return query
