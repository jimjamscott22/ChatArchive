from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy.orm import Query, aliased

from app.models import Conversation, Tag


def _date_to_upper_bound(date_to: datetime) -> tuple[datetime, bool]:
    """Treat a date-only (midnight) bound as inclusive of that calendar day.

    HTML date inputs and FastAPI date-only query params parse as midnight, so
    `created_at <= 2024-01-15T00:00:00` would drop almost every conversation
    from the selected end day. Expanding to the next midnight (exclusive)
    includes the whole day. Explicit datetimes with a time component are kept.
    """
    if (
        date_to.hour == 0
        and date_to.minute == 0
        and date_to.second == 0
        and date_to.microsecond == 0
    ):
        return date_to + timedelta(days=1), True
    return date_to, False


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
        bound, exclusive = _date_to_upper_bound(date_to)
        if exclusive:
            query = query.filter(Conversation.created_at < bound)
        else:
            query = query.filter(Conversation.created_at <= bound)

    return query
