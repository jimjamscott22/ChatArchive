from __future__ import annotations

import json
import logging
import sys
import threading
import time
import webbrowser
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func, or_, text
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import Session, joinedload
import uvicorn

from app.database import get_db, DATABASE_MODE
from app.importers.chatgpt import parse_chatgpt_export
from app.importers.claude import parse_claude_export
from app.importers.gemini import parse_gemini_export
from app.importers.copilot import parse_copilot_export
from app.models import Base, Conversation, Message, ImportHistory, ImportSettings, Tag, ConversationTag, Project
from app.supabase_client import get_connection_info, get_dashboard_url, is_supabase_configured
from app.storage import upload_export_file, list_storage_files
from app.schemas import (
    ConversationResponse,
    ConversationDetail,
    ConversationListResponse,
    ImportHistoryResponse,
    ImportHistoryListResponse,
    ImportSettingsResponse,
    ImportSettingsUpdate,
    DuplicateConversation,
    DuplicateGroup,
    DuplicateGroupsResponse,
    BulkDeleteRequest,
    BulkDeleteResponse,
    TagCreate,
    TagUpdate,
    TagResponse,
    TagListResponse,
    AddTagRequest,
    AutoTagRequest,
    AutoTagResponse,
    ProjectCreate,
    ProjectUpdate,
    ProjectResponse,
    ProjectListResponse,
    MoveToProjectRequest,
)
from app.tagger import get_tagging_engine

logger = logging.getLogger(__name__)

app = FastAPI(title="ChatArchive API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


# ============ Conversation Endpoints ============

@app.get("/conversations", response_model=ConversationListResponse)
def list_conversations(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    source: str | None = Query(None, description="Filter by source (chatgpt, claude, etc)"),
    tag: str | None = Query(None, description="Filter by tag name"),
    project_id: int | None = Query(None, description="Filter by project ID (use -1 for uncategorized)"),
    sort_by: Literal["created_at", "updated_at", "title", "message_count"] = Query(
        "created_at", description="Field to sort by"
    ),
    sort_order: Literal["asc", "desc"] = Query("desc", description="Sort order"),
) -> ConversationListResponse:
    """List all conversations with pagination and filtering."""
    
    query = db.query(Conversation).options(joinedload(Conversation.tags), joinedload(Conversation.project))
    
    # Apply source filter
    if source:
        query = query.filter(Conversation.source == source)
    
    # Apply tag filter
    if tag:
        query = query.join(Conversation.tags).filter(Tag.name == tag)
    
    # Apply project filter
    if project_id is not None:
        if project_id == -1:
            # -1 means uncategorized (no project)
            query = query.filter(Conversation.project_id.is_(None))
        else:
            query = query.filter(Conversation.project_id == project_id)

    # Get total count
    total = query.count()
    
    # Apply sorting
    sort_column = getattr(Conversation, sort_by)
    if sort_order == "desc":
        sort_column = sort_column.desc()
    query = query.order_by(sort_column.nulls_last())
    
    # Apply pagination
    offset = (page - 1) * page_size
    conversations = query.offset(offset).limit(page_size).all()
    
    # Calculate total pages
    pages = (total + page_size - 1) // page_size
    
    return ConversationListResponse(
        items=[ConversationResponse.model_validate(c) for c in conversations],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@app.get("/conversations/sources")
def list_sources(db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    """List all unique sources with conversation counts."""
    results = (
        db.query(Conversation.source, func.count(Conversation.id))
        .group_by(Conversation.source)
        .all()
    )
    return [{"source": source, "count": count} for source, count in results]


@app.get("/conversations/search", response_model=ConversationListResponse)
def search_conversations(
    db: Session = Depends(get_db),
    q: str = Query(..., min_length=1, description="Search query"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    source: str | None = Query(None, description="Filter by source"),
    search_messages: bool = Query(True, description="Also search message content"),
) -> ConversationListResponse:
    """Search conversations by title and message content using full-text search."""
    try:
        return _search_conversations_fts(db, q, page, page_size, source)
    except OperationalError:
        return _search_conversations_ilike(db, q, page, page_size, source, search_messages)


def _search_conversations_fts(
    db: Session,
    q: str,
    page: int,
    page_size: int,
    source: str | None,
) -> ConversationListResponse:
    """Full-text search using PostgreSQL tsvector (requires migrate_add_fulltext_search)."""
    query = (
        db.query(Conversation)
        .options(joinedload(Conversation.tags))
        .filter(text("conversations.search_vector @@ plainto_tsquery('english', :q)"))
        .params(q=q)
    )
    if source:
        query = query.filter(Conversation.source == source)

    total = query.count()
    offset = (page - 1) * page_size
    conversations = (
        query.order_by(
            text("ts_rank(conversations.search_vector, plainto_tsquery('english', :q)) DESC"),
            Conversation.created_at.desc().nulls_last(),
        )
        .offset(offset)
        .limit(page_size)
        .all()
    )
    pages = (total + page_size - 1) // page_size
    return ConversationListResponse(
        items=conversations,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


def _search_conversations_ilike(
    db: Session,
    q: str,
    page: int,
    page_size: int,
    source: str | None,
    search_messages: bool,
) -> ConversationListResponse:
    """Fallback ILIKE search when full-text search is not available."""
    search_term = f"%{q}%"
    conditions = [Conversation.title.ilike(search_term)]
    if search_messages:
        message_match = (
            db.query(Message.conversation_id)
            .filter(Message.content.ilike(search_term))
            .distinct()
            .subquery()
        )
        conditions.append(Conversation.id.in_(db.query(message_match.c.conversation_id)))

    query = (
        db.query(Conversation)
        .options(joinedload(Conversation.tags))
        .filter(or_(*conditions))
    )
    if source:
        query = query.filter(Conversation.source == source)

    total = query.count()
    offset = (page - 1) * page_size
    conversations = (
        query.order_by(
            Conversation.title.ilike(search_term).desc(),
            Conversation.created_at.desc().nulls_last(),
        )
        .offset(offset)
        .limit(page_size)
        .all()
    )
    pages = (total + page_size - 1) // page_size
    return ConversationListResponse(
        items=conversations,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@app.get("/conversations/duplicates", response_model=DuplicateGroupsResponse)
def find_duplicates(
    db: Session = Depends(get_db),
    strategy: Literal["source_id", "title", "both"] = Query("source_id"),
    include_nulls: bool = Query(False),
) -> DuplicateGroupsResponse:
    """Find duplicate conversations using specified strategy."""

    if strategy == "source_id":
        groups = find_duplicates_by_source_id(db, include_nulls)
    elif strategy == "title":
        groups = find_duplicates_by_title(db)
    else:
        groups = find_duplicates_combined(db, include_nulls)

    total_duplicates = sum(group.count for group in groups)

    return DuplicateGroupsResponse(
        groups=groups,
        total_duplicates=total_duplicates,
        total_groups=len(groups),
        strategy=strategy,
    )


@app.get("/conversations/{conversation_id:int}", response_model=ConversationDetail)
def get_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
) -> ConversationDetail:
    """Get a single conversation with all its messages."""
    
    conversation = (
        db.query(Conversation)
        .options(joinedload(Conversation.messages), joinedload(Conversation.tags), joinedload(Conversation.project))
        .filter(Conversation.id == conversation_id)
        .first()
    )
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Sort messages by order_index
    conversation.messages.sort(key=lambda m: m.order_index)
    
    return conversation


@app.delete("/conversations/{conversation_id:int}")
def delete_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
) -> dict[str, str]:
    """Delete a conversation and all its messages."""
    
    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    db.delete(conversation)
    db.commit()
    
    return {"status": "deleted", "id": str(conversation_id)}


# ============ Import Helper Functions ============

def get_import_settings_record(db: Session) -> ImportSettings | None:
    """Get the current import settings."""
    return db.query(ImportSettings).first()


def conversation_exists(
    db: Session,
    source: str | None,
    source_id: str | None
) -> bool:
    """Check if a conversation with the given source and source_id already exists."""
    if not source or not source_id:
        return False

    existing = db.query(Conversation).filter(
        Conversation.source == source,
        Conversation.source_id == source_id
    ).first()

    return existing is not None


# ============ Duplicate Detection Helper Functions ============

def find_duplicates_by_source_id(
    db: Session,
    include_nulls: bool = False
) -> list[DuplicateGroup]:
    """Find duplicates by (source, source_id) combination."""

    query = (
        db.query(
            Conversation.source,
            Conversation.source_id,
            func.count(Conversation.id).label('count')
        )
        .group_by(Conversation.source, Conversation.source_id)
        .having(func.count(Conversation.id) > 1)
    )

    if not include_nulls:
        query = query.filter(Conversation.source_id != None)

    duplicate_keys = query.all()

    groups = []
    for source, source_id, count in duplicate_keys:
        conversations = (
            db.query(Conversation)
            .filter(
                Conversation.source == source,
                Conversation.source_id == source_id
            )
            .order_by(Conversation.created_at.desc().nulls_last())
            .all()
        )

        titles = [c.title for c in conversations if c.title]
        most_common_title = max(set(titles), key=titles.count) if titles else None

        groups.append(DuplicateGroup(
            key=f"{source}:{source_id or 'null'}",
            source=source,
            source_id=source_id,
            title=most_common_title,
            count=count,
            conversations=[DuplicateConversation.model_validate(c) for c in conversations],
            total_messages=sum(c.message_count for c in conversations)
        ))

    return groups


def find_duplicates_by_title(
    db: Session,
    min_title_length: int = 10
) -> list[DuplicateGroup]:
    """Find duplicates by exact title match within the same source."""

    query = (
        db.query(
            Conversation.source,
            Conversation.title,
            func.count(Conversation.id).label('count')
        )
        .filter(
            Conversation.title != None,
            func.length(Conversation.title) >= min_title_length
        )
        .group_by(Conversation.source, Conversation.title)
        .having(func.count(Conversation.id) > 1)
    )

    duplicate_keys = query.all()

    groups = []
    for source, title, count in duplicate_keys:
        conversations = (
            db.query(Conversation)
            .filter(
                Conversation.source == source,
                Conversation.title == title
            )
            .order_by(Conversation.created_at.desc().nulls_last())
            .all()
        )

        groups.append(DuplicateGroup(
            key=f"{source}:title:{title[:50]}",
            source=source,
            source_id=None,
            title=title,
            count=count,
            conversations=[DuplicateConversation.model_validate(c) for c in conversations],
            total_messages=sum(c.message_count for c in conversations)
        ))

    return groups


def find_duplicates_combined(
    db: Session,
    include_nulls: bool = False
) -> list[DuplicateGroup]:
    """Combine both strategies: source_id first, then title-based for remaining conversations."""

    source_id_groups = find_duplicates_by_source_id(db, include_nulls)

    duplicate_ids = {
        conv.id
        for group in source_id_groups
        for conv in group.conversations
    }

    query = (
        db.query(
            Conversation.source,
            Conversation.title,
            func.count(Conversation.id).label('count')
        )
        .filter(
            Conversation.title != None,
            func.length(Conversation.title) >= 10
        )
        .group_by(Conversation.source, Conversation.title)
        .having(func.count(Conversation.id) > 1)
    )

    if duplicate_ids:
        query = query.filter(~Conversation.id.in_(duplicate_ids))

    duplicate_keys = query.all()

    title_groups = []
    for source, title, count in duplicate_keys:
        conversations_query = (
            db.query(Conversation)
            .filter(
                Conversation.source == source,
                Conversation.title == title
            )
        )

        if duplicate_ids:
            conversations_query = conversations_query.filter(~Conversation.id.in_(duplicate_ids))

        conversations = conversations_query.order_by(Conversation.created_at.desc().nulls_last()).all()

        if len(conversations) > 1:
            title_groups.append(DuplicateGroup(
                key=f"{source}:title:{title[:50]}",
                source=source,
                source_id=None,
                title=title,
                count=len(conversations),
                conversations=[DuplicateConversation.model_validate(c) for c in conversations],
                total_messages=sum(c.message_count for c in conversations)
            ))

    return source_id_groups + title_groups


def bulk_delete_conversations(
    db: Session,
    conversation_ids: list[int]
) -> tuple[list[int], list[int]]:
    """Delete multiple conversations by ID. Returns (deleted_ids, failed_ids)."""

    if not conversation_ids:
        return [], []

    try:
        # Find which IDs actually exist
        existing_ids = {
            row[0]
            for row in db.query(Conversation.id)
            .filter(Conversation.id.in_(conversation_ids))
            .all()
        }
        failed_ids = [cid for cid in conversation_ids if cid not in existing_ids]

        if existing_ids:
            # Bulk-delete related rows (DB cascades would handle this, but
            # being explicit avoids ORM-level cascade loading every message)
            db.query(Message).filter(
                Message.conversation_id.in_(existing_ids)
            ).delete(synchronize_session=False)
            db.query(ConversationTag).filter(
                ConversationTag.conversation_id.in_(existing_ids)
            ).delete(synchronize_session=False)
            db.query(Conversation).filter(
                Conversation.id.in_(existing_ids)
            ).delete(synchronize_session=False)

        db.commit()
        return list(existing_ids), failed_ids
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to bulk delete conversations: {e}")
        return [], conversation_ids


@app.delete("/conversations/bulk")
def delete_conversations_bulk(
    request: BulkDeleteRequest,
    db: Session = Depends(get_db),
) -> BulkDeleteResponse:
    """Delete multiple conversations in bulk."""

    deleted_ids, failed_ids = bulk_delete_conversations(db, request.conversation_ids)

    return BulkDeleteResponse(
        deleted_count=len(deleted_ids),
        deleted_ids=deleted_ids,
        failed_ids=failed_ids,
    )


@app.get("/stats")
def get_stats(db: Session = Depends(get_db)) -> dict[str, Any]:
    """Get overall statistics."""

    total_conversations = db.query(Conversation).count()
    total_messages = db.query(Message).count()

    # Get counts by source
    source_counts = (
        db.query(Conversation.source, func.count(Conversation.id))
        .group_by(Conversation.source)
        .all()
    )

    # Get date range
    oldest = db.query(func.min(Conversation.created_at)).scalar()
    newest = db.query(func.max(Conversation.created_at)).scalar()

    return {
        "total_conversations": total_conversations,
        "total_messages": total_messages,
        "sources": {source: count for source, count in source_counts},
        "date_range": {
            "oldest": oldest.isoformat() if oldest else None,
            "newest": newest.isoformat() if newest else None,
        }
    }


@app.get("/analytics")
def get_analytics(db: Session = Depends(get_db)) -> dict[str, Any]:
    """Get detailed analytics data for the conversation insights dashboard."""

    # Totals
    total_conversations = db.query(Conversation).count()
    total_messages = db.query(Message).count()
    avg_msgs = db.query(func.avg(Conversation.message_count)).scalar() or 0

    # Source breakdown
    source_counts = (
        db.query(Conversation.source, func.count(Conversation.id))
        .group_by(Conversation.source)
        .all()
    )

    # Conversations grouped by month (PostgreSQL/Supabase)
    month_expr = func.to_char(Conversation.created_at, "YYYY-MM")

    conversations_by_month = (
        db.query(month_expr.label("month"), func.count(Conversation.id).label("count"))
        .filter(Conversation.created_at.isnot(None))
        .group_by(month_expr)
        .order_by(month_expr)
        .all()
    )

    # Activity by day of week (0=Sunday … 6=Saturday)
    day_expr = func.extract("dow", Conversation.created_at)

    activity_by_day_raw = (
        db.query(day_expr.label("day"), func.count(Conversation.id).label("count"))
        .filter(Conversation.created_at.isnot(None))
        .group_by(day_expr)
        .all()
    )

    # Message role distribution
    role_distribution = (
        db.query(Message.role, func.count(Message.id))
        .group_by(Message.role)
        .all()
    )

    # Top tags by conversation count
    top_tags = (
        db.query(Tag.name, Tag.color, func.count(ConversationTag.conversation_id).label("count"))
        .join(ConversationTag, Tag.id == ConversationTag.tag_id)
        .group_by(Tag.id, Tag.name, Tag.color)
        .order_by(func.count(ConversationTag.conversation_id).desc())
        .limit(10)
        .all()
    )

    # Projects breakdown
    project_stats = (
        db.query(Project.name, Project.color, func.count(Conversation.id).label("count"))
        .join(Conversation, Conversation.project_id == Project.id)
        .group_by(Project.id, Project.name, Project.color)
        .order_by(func.count(Conversation.id).desc())
        .all()
    )

    # Normalise day-of-week keys to integers 0–6
    activity_by_day: dict[str, int] = {}
    for day, count in activity_by_day_raw:
        if day is not None:
            activity_by_day[str(int(float(day)))] = count

    return {
        "total_conversations": total_conversations,
        "total_messages": total_messages,
        "avg_messages_per_conversation": round(float(avg_msgs), 1),
        "sources": {source: count for source, count in source_counts},
        "conversations_by_month": [
            {"month": month, "count": count}
            for month, count in conversations_by_month
            if month is not None
        ],
        "role_distribution": {role: count for role, count in role_distribution},
        "activity_by_day": activity_by_day,
        "top_tags": [
            {"name": name, "color": color or "#6B7280", "count": count}
            for name, color, count in top_tags
        ],
        "projects": [
            {"name": name, "color": color or "#8B5CF6", "count": count}
            for name, color, count in project_stats
        ],
    }


@app.post("/import/chatgpt", response_model=list[ConversationResponse])
async def import_chatgpt(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> list[ConversationResponse]:
    filename = file.filename
    if not filename or not filename.endswith(".json"):
        raise HTTPException(status_code=400, detail="Expected a .json export")

    raw = await file.read()
    
    # Upload raw export file to Supabase storage if configured
    if is_supabase_configured():
        try:
            upload_export_file(
                filename=filename,
                content=raw,
                source_type="chatgpt",
            )
        except Exception as e:
            logger.warning(f"Failed to upload file to Supabase storage: {e}")
    
    # Create import history record
    import_record = ImportHistory(
        filename=filename,
        source_location=None,  # Could be enhanced to track upload source
        source_type="chatgpt",
        file_format="json",
        status="processing",
        imported_count=0,
    )
    db.add(import_record)
    db.commit()
    db.refresh(import_record)
    
    try:
        payload: Any = json.loads(raw)
    except json.JSONDecodeError as exc:
        import_record.status = "failure"
        import_record.error_message = "Invalid JSON format"
        db.commit()
        raise HTTPException(status_code=400, detail="Invalid JSON") from exc

    try:
        parsed = parse_chatgpt_export(payload)
    except ValueError as exc:
        import_record.status = "failure"
        import_record.error_message = str(exc)
        db.commit()
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    # Get import settings
    settings = get_import_settings_record(db)
    auto_merge = settings.auto_merge_duplicates if settings else False

    records: list[Conversation] = []
    skipped_count = 0

    try:
        for item in parsed:
            # Check if conversation already exists
            source = item.get("source")
            source_id = item.get("source_id")

            if auto_merge and conversation_exists(db, source, source_id):
                skipped_count += 1
                continue

            # Extract messages before creating conversation
            messages_data = item.pop("messages", [])

            # Add import_history_id to track this import
            item["import_history_id"] = import_record.id
            
            convo = Conversation(**item)
            db.add(convo)
            db.flush()  # Get the conversation ID

            # Add messages
            for msg_data in messages_data:
                message = Message(conversation_id=convo.id, **msg_data)
                db.add(message)

            records.append(convo)

        db.commit()
        for convo in records:
            db.refresh(convo)

        # Update import record with success
        import_record.status = "success"
        import_record.imported_count = len(records)
        if skipped_count > 0:
            import_record.error_message = f"Skipped {skipped_count} duplicate(s)"
        db.commit()
        
    except (ValueError, KeyError) as exc:
        # Handle data validation errors
        db.rollback()
        import_record.status = "failure"
        import_record.error_message = "Invalid data format"
        db.commit()
        logger.error(f"Import validation error for {filename}: {exc}")
        raise HTTPException(status_code=400, detail="Invalid data format") from exc
    except IntegrityError as exc:
        # Handle database constraint violations (duplicates, foreign keys, etc.)
        db.rollback()
        import_record.status = "failure"
        error_msg = str(exc.orig) if hasattr(exc, 'orig') else str(exc)
        import_record.error_message = f"Database constraint violation: {error_msg}"
        db.commit()
        logger.error(f"Import integrity error for {filename}: {exc}")
        raise HTTPException(
            status_code=409,
            detail=f"Database constraint violation: {error_msg}"
        ) from exc
    except OperationalError as exc:
        # Handle database operational errors (locks, connection issues, etc.)
        db.rollback()
        import_record.status = "failure"
        error_msg = str(exc.orig) if hasattr(exc, 'orig') else str(exc)
        import_record.error_message = f"Database operation failed: {error_msg}"
        db.commit()
        logger.error(f"Import operational error for {filename}: {exc}")
        raise HTTPException(
            status_code=503,
            detail=f"Database temporarily unavailable: {error_msg}"
        ) from exc
    except Exception as exc:
        # Handle unexpected errors without exposing internals
        db.rollback()
        import_record.status = "failure"

        # Provide more detailed error information for debugging
        error_type = type(exc).__name__
        error_detail = str(exc)
        import_record.error_message = f"{error_type}: {error_detail}"
        db.commit()

        logger.exception(f"Unexpected error during import of {filename}")

        # Return detailed error for debugging (sanitize in production)
        raise HTTPException(
            status_code=500,
            detail=f"Import failed: {error_type} - {error_detail}"
        )

    return records


@app.post("/import/claude", response_model=list[ConversationResponse])
async def import_claude(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> list[ConversationResponse]:
    """Import conversations from Claude export."""
    filename = file.filename
    if not filename or not filename.endswith(".json"):
        raise HTTPException(status_code=400, detail="Expected a .json export")

    raw = await file.read()
    
    # Upload raw export file to Supabase storage if configured
    if is_supabase_configured():
        try:
            upload_export_file(
                filename=filename,
                content=raw,
                source_type="claude",
            )
        except Exception as e:
            logger.warning(f"Failed to upload file to Supabase storage: {e}")
    
    import_record = ImportHistory(
        filename=filename,
        source_type="claude",
        file_format="json",
        status="processing",
        imported_count=0,
    )
    db.add(import_record)
    db.commit()
    db.refresh(import_record)
    
    try:
        payload: Any = json.loads(raw)
    except json.JSONDecodeError as exc:
        import_record.status = "failure"
        import_record.error_message = "Invalid JSON format"
        db.commit()
        raise HTTPException(status_code=400, detail="Invalid JSON") from exc

    try:
        parsed = parse_claude_export(payload)
    except ValueError as exc:
        import_record.status = "failure"
        import_record.error_message = str(exc)
        db.commit()
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    # Get import settings
    settings = get_import_settings_record(db)
    auto_merge = settings.auto_merge_duplicates if settings else False

    records: list[Conversation] = []
    skipped_count = 0

    try:
        for item in parsed:
            # Check if conversation already exists
            source = item.get("source")
            source_id = item.get("source_id")

            if auto_merge and conversation_exists(db, source, source_id):
                skipped_count += 1
                continue

            messages_data = item.pop("messages", [])
            
            # Add import_history_id to track this import
            item["import_history_id"] = import_record.id
            
            convo = Conversation(**item)
            db.add(convo)
            db.flush()

            for msg_data in messages_data:
                message = Message(conversation_id=convo.id, **msg_data)
                db.add(message)

            records.append(convo)

        db.commit()
        for convo in records:
            db.refresh(convo)

        import_record.status = "success"
        import_record.imported_count = len(records)
        if skipped_count > 0:
            import_record.error_message = f"Skipped {skipped_count} duplicate(s)"
        db.commit()

    except Exception as exc:
        db.rollback()
        import_record.status = "failure"
        import_record.error_message = "Import failed"
        db.commit()
        logger.exception(f"Error importing Claude file {filename}")
        raise HTTPException(status_code=500, detail="Import failed")

    return records


@app.post("/import/gemini", response_model=list[ConversationResponse])
async def import_gemini(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> list[ConversationResponse]:
    """Import conversations from Gemini/Bard export."""
    filename = file.filename
    if not filename or not filename.endswith(".json"):
        raise HTTPException(status_code=400, detail="Expected a .json export")

    raw = await file.read()
    
    # Upload raw export file to Supabase storage if configured
    if is_supabase_configured():
        try:
            upload_export_file(
                filename=filename,
                content=raw,
                source_type="gemini",
            )
        except Exception as e:
            logger.warning(f"Failed to upload file to Supabase storage: {e}")
    
    import_record = ImportHistory(
        filename=filename,
        source_type="gemini",
        file_format="json",
        status="processing",
        imported_count=0,
    )
    db.add(import_record)
    db.commit()
    db.refresh(import_record)
    
    try:
        payload: Any = json.loads(raw)
    except json.JSONDecodeError as exc:
        import_record.status = "failure"
        import_record.error_message = "Invalid JSON format"
        db.commit()
        raise HTTPException(status_code=400, detail="Invalid JSON") from exc

    try:
        parsed = parse_gemini_export(payload)
    except ValueError as exc:
        import_record.status = "failure"
        import_record.error_message = str(exc)
        db.commit()
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    # Get import settings
    settings = get_import_settings_record(db)
    auto_merge = settings.auto_merge_duplicates if settings else False

    records: list[Conversation] = []
    skipped_count = 0

    try:
        for item in parsed:
            # Check if conversation already exists
            source = item.get("source")
            source_id = item.get("source_id")

            if auto_merge and conversation_exists(db, source, source_id):
                skipped_count += 1
                continue

            messages_data = item.pop("messages", [])
            
            # Add import_history_id to track this import
            item["import_history_id"] = import_record.id
            
            convo = Conversation(**item)
            db.add(convo)
            db.flush()

            for msg_data in messages_data:
                message = Message(conversation_id=convo.id, **msg_data)
                db.add(message)

            records.append(convo)

        db.commit()
        for convo in records:
            db.refresh(convo)

        import_record.status = "success"
        import_record.imported_count = len(records)
        if skipped_count > 0:
            import_record.error_message = f"Skipped {skipped_count} duplicate(s)"
        db.commit()

    except Exception as exc:
        db.rollback()
        import_record.status = "failure"
        import_record.error_message = "Import failed"
        db.commit()
        logger.exception(f"Error importing Gemini file {filename}")
        raise HTTPException(status_code=500, detail="Import failed")

    return records


@app.post("/import/copilot", response_model=list[ConversationResponse])
async def import_copilot(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> list[ConversationResponse]:
    """Import conversations from GitHub Copilot export."""
    filename = file.filename
    if not filename or not filename.endswith(".json"):
        raise HTTPException(status_code=400, detail="Expected a .json export")

    raw = await file.read()
    
    # Upload raw export file to Supabase storage if configured
    if is_supabase_configured():
        try:
            upload_export_file(
                filename=filename,
                content=raw,
                source_type="copilot",
            )
        except Exception as e:
            logger.warning(f"Failed to upload file to Supabase storage: {e}")
    
    import_record = ImportHistory(
        filename=filename,
        source_type="copilot",
        file_format="json",
        status="processing",
        imported_count=0,
    )
    db.add(import_record)
    db.commit()
    db.refresh(import_record)
    
    try:
        payload: Any = json.loads(raw)
    except json.JSONDecodeError as exc:
        import_record.status = "failure"
        import_record.error_message = "Invalid JSON format"
        db.commit()
        raise HTTPException(status_code=400, detail="Invalid JSON") from exc

    try:
        parsed = parse_copilot_export(payload)
    except ValueError as exc:
        import_record.status = "failure"
        import_record.error_message = str(exc)
        db.commit()
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    # Get import settings
    settings = get_import_settings_record(db)
    auto_merge = settings.auto_merge_duplicates if settings else False

    records: list[Conversation] = []
    skipped_count = 0

    try:
        for item in parsed:
            # Check if conversation already exists
            source = item.get("source")
            source_id = item.get("source_id")

            if auto_merge and conversation_exists(db, source, source_id):
                skipped_count += 1
                continue

            messages_data = item.pop("messages", [])
            
            # Add import_history_id to track this import
            item["import_history_id"] = import_record.id
            
            convo = Conversation(**item)
            db.add(convo)
            db.flush()

            for msg_data in messages_data:
                message = Message(conversation_id=convo.id, **msg_data)
                db.add(message)

            records.append(convo)

        db.commit()
        for convo in records:
            db.refresh(convo)

        import_record.status = "success"
        import_record.imported_count = len(records)
        if skipped_count > 0:
            import_record.error_message = f"Skipped {skipped_count} duplicate(s)"
        db.commit()

    except Exception as exc:
        db.rollback()
        import_record.status = "failure"
        import_record.error_message = "Import failed"
        db.commit()
        logger.exception(f"Error importing Copilot file {filename}")
        raise HTTPException(status_code=500, detail="Import failed")

    return records


# ============ Import History Endpoints ============

@app.get("/import/history", response_model=ImportHistoryListResponse)
def get_import_history(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    source_type: str | None = Query(None, description="Filter by source type"),
    status: str | None = Query(None, description="Filter by status"),
) -> ImportHistoryListResponse:
    """Get import history with pagination and filtering."""
    
    query = db.query(ImportHistory)
    
    # Apply filters
    if source_type:
        query = query.filter(ImportHistory.source_type == source_type)
    if status:
        query = query.filter(ImportHistory.status == status)
    
    # Get total count
    total = query.count()
    
    # Sort by most recent first
    query = query.order_by(ImportHistory.created_at.desc())
    
    # Apply pagination
    offset = (page - 1) * page_size
    history_items = query.offset(offset).limit(page_size).all()
    
    # Calculate total pages
    pages = (total + page_size - 1) // page_size
    
    return ImportHistoryListResponse(
        items=history_items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@app.get("/import/history/{history_id}", response_model=ImportHistoryResponse)
def get_import_history_item(
    history_id: int,
    db: Session = Depends(get_db),
) -> ImportHistoryResponse:
    """Get a specific import history record."""
    
    history_item = db.query(ImportHistory).filter(ImportHistory.id == history_id).first()
    
    if not history_item:
        raise HTTPException(status_code=404, detail="Import history record not found")
    
    return history_item


@app.delete("/import/history/{history_id}")
def delete_import_history(
    history_id: int,
    delete_conversations: bool = Query(True, description="Also delete imported conversations"),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Delete an import history record and optionally its conversations."""
    
    history_item = db.query(ImportHistory).filter(ImportHistory.id == history_id).first()
    
    if not history_item:
        raise HTTPException(status_code=404, detail="Import history record not found")
    
    deleted_conversations = 0
    
    # If delete_conversations is True, delete all conversations from this import
    if delete_conversations:
        # Find conversations that were created by this import
        conversations = db.query(Conversation).filter(
            Conversation.import_history_id == history_id
        ).all()
        
        deleted_conversations = len(conversations)
        
        # Delete the conversations (messages will cascade delete)
        for conv in conversations:
            db.delete(conv)
    
    # Delete the history record
    db.delete(history_item)
    db.commit()
    
    return {
        "deleted": True,
        "import_id": history_id,
        "deleted_conversations": deleted_conversations,
        "message": f"Deleted import history record" + 
                   (f" and {deleted_conversations} conversations" if delete_conversations else "")
    }


# ============ Import Settings Endpoints ============

@app.get("/settings/import", response_model=ImportSettingsResponse)
def get_import_settings(db: Session = Depends(get_db)) -> ImportSettingsResponse:
    """Get current import settings."""
    
    settings = db.query(ImportSettings).first()
    
    # Create default settings if none exist
    if not settings:
        settings = ImportSettings(
            allowed_formats="json,csv,xml",
            default_format="json",
            auto_merge_duplicates=False,
            keep_separate=True,
            skip_empty_conversations=True,
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
    
    return settings


@app.put("/settings/import", response_model=ImportSettingsResponse)
def update_import_settings(
    updates: ImportSettingsUpdate,
    db: Session = Depends(get_db),
) -> ImportSettingsResponse:
    """Update import settings."""
    
    settings = db.query(ImportSettings).first()
    
    # Create if doesn't exist
    if not settings:
        settings = ImportSettings()
        db.add(settings)
    
    # Apply updates
    update_data = updates.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(settings, key, value)
    
    settings.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(settings)
    
    return settings


# ============ Tag Endpoints ============

@app.get("/tags", response_model=TagListResponse)
def list_tags(
    db: Session = Depends(get_db),
) -> TagListResponse:
    """List all tags with their usage counts."""
    # Get all tags with conversation count
    tags = db.query(Tag).all()
    
    # Calculate conversation count for each tag
    tag_responses = []
    for tag in tags:
        count = db.query(ConversationTag).filter(ConversationTag.tag_id == tag.id).count()
        tag_response = TagResponse(
            id=tag.id,
            name=tag.name,
            description=tag.description,
            color=tag.color,
            created_at=tag.created_at,
            conversation_count=count,
        )
        tag_responses.append(tag_response)
    
    return TagListResponse(items=tag_responses, total=len(tag_responses))


@app.post("/tags", response_model=TagResponse)
def create_tag(
    tag: TagCreate,
    db: Session = Depends(get_db),
) -> TagResponse:
    """Create a new tag."""
    # Check if tag already exists
    existing_tag = db.query(Tag).filter(Tag.name == tag.name).first()
    if existing_tag:
        raise HTTPException(status_code=400, detail=f"Tag '{tag.name}' already exists")
    
    # Create new tag
    new_tag = Tag(
        name=tag.name,
        description=tag.description,
        color=tag.color,
    )
    db.add(new_tag)
    db.commit()
    db.refresh(new_tag)
    
    return TagResponse(
        id=new_tag.id,
        name=new_tag.name,
        description=new_tag.description,
        color=new_tag.color,
        created_at=new_tag.created_at,
        conversation_count=0,
    )


@app.put("/tags/{tag_id}", response_model=TagResponse)
def update_tag(
    tag_id: int,
    updates: TagUpdate,
    db: Session = Depends(get_db),
) -> TagResponse:
    """Update an existing tag."""
    tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")

    update_data = updates.model_dump(exclude_unset=True)
    if "name" in update_data:
        name = update_data["name"].strip()
        if not name:
            raise HTTPException(status_code=400, detail="Tag name cannot be empty")
        existing_tag = (
            db.query(Tag)
            .filter(Tag.name == name, Tag.id != tag_id)
            .first()
        )
        if existing_tag:
            raise HTTPException(status_code=400, detail=f"Tag '{name}' already exists")
        update_data["name"] = name

    if "description" in update_data:
        update_data["description"] = update_data["description"] or None
    if "color" in update_data:
        update_data["color"] = update_data["color"] or None

    for key, value in update_data.items():
        setattr(tag, key, value)

    db.commit()
    db.refresh(tag)

    count = db.query(ConversationTag).filter(ConversationTag.tag_id == tag.id).count()
    return TagResponse(
        id=tag.id,
        name=tag.name,
        description=tag.description,
        color=tag.color,
        created_at=tag.created_at,
        conversation_count=count,
    )


@app.delete("/tags/{tag_id}")
def delete_tag(
    tag_id: int,
    db: Session = Depends(get_db),
) -> dict[str, str]:
    """Delete a tag and remove it from all conversations."""
    tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")

    db.delete(tag)
    db.commit()

    return {"status": "ok", "message": "Tag deleted"}


@app.post("/conversations/{conversation_id}/tags")
def add_tag_to_conversation(
    conversation_id: int,
    request: AddTagRequest,
    db: Session = Depends(get_db),
) -> dict[str, str]:
    """Add a tag to a conversation."""
    # Check if conversation exists
    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Get or create tag
    tag = db.query(Tag).filter(Tag.name == request.tag_name).first()
    if not tag:
        # Get tag info from tagging engine
        engine = get_tagging_engine()
        tag_info = engine.get_tag_info(request.tag_name)
        
        if tag_info:
            tag = Tag(
                name=tag_info["name"],
                description=tag_info["description"],
                color=tag_info["color"],
            )
        else:
            # Create tag with default values
            tag = Tag(name=request.tag_name)
        
        db.add(tag)
        db.commit()
        db.refresh(tag)
    
    # Check if tag is already assigned
    existing = db.query(ConversationTag).filter(
        ConversationTag.conversation_id == conversation_id,
        ConversationTag.tag_id == tag.id,
    ).first()
    
    if existing:
        return {"status": "ok", "message": "Tag already assigned to conversation"}
    
    # Add tag to conversation
    conversation_tag = ConversationTag(
        conversation_id=conversation_id,
        tag_id=tag.id,
        auto_tagged=request.auto_tagged,
    )
    db.add(conversation_tag)
    db.commit()
    
    return {"status": "ok", "message": "Tag added to conversation"}


@app.delete("/conversations/{conversation_id}/tags/{tag_id}")
def remove_tag_from_conversation(
    conversation_id: int,
    tag_id: int,
    db: Session = Depends(get_db),
) -> dict[str, str]:
    """Remove a tag from a conversation."""
    # Check if conversation exists
    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Check if tag exists
    tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    
    # Remove tag association
    conversation_tag = db.query(ConversationTag).filter(
        ConversationTag.conversation_id == conversation_id,
        ConversationTag.tag_id == tag_id,
    ).first()
    
    if not conversation_tag:
        raise HTTPException(status_code=404, detail="Tag not assigned to conversation")
    
    db.delete(conversation_tag)
    db.commit()
    
    return {"status": "ok", "message": "Tag removed from conversation"}


@app.post("/conversations/auto-tag", response_model=AutoTagResponse)
def auto_tag_conversations(
    request: AutoTagRequest,
    db: Session = Depends(get_db),
) -> AutoTagResponse:
    """Automatically tag conversations based on content analysis."""
    engine = get_tagging_engine()

    # Ensure all predefined tags exist in database BEFORE loading conversations,
    # so the commit here doesn't expire the conversation objects mid-loop.
    for tag_info in engine.get_all_tags():
        existing_tag = db.query(Tag).filter(Tag.name == tag_info["name"]).first()
        if not existing_tag:
            new_tag = Tag(
                name=tag_info["name"],
                description=tag_info["description"],
                color=tag_info["color"],
            )
            db.add(new_tag)

    db.commit()

    # Get conversations to tag (loaded fresh after the commit above)
    if request.conversation_ids:
        conversations = db.query(Conversation).filter(
            Conversation.id.in_(request.conversation_ids)
        ).all()
    else:
        conversations = db.query(Conversation).all()

    if not conversations:
        raise HTTPException(status_code=404, detail="No conversations found")
    
    # Auto-tag each conversation
    tagged_count = 0
    tagged_ids = []
    tags_added: dict[str, int] = {}
    
    for conversation in conversations:
        # Load messages for content analysis
        messages = db.query(Message).filter(
            Message.conversation_id == conversation.id
        ).order_by(Message.order_index).all()
        
        message_data = [
            {"role": msg.role, "content": msg.content}
            for msg in messages
        ]
        
        # Classify conversation
        tag_names = engine.classify_conversation(
            title=conversation.title,
            messages=message_data,
        )
        
        if not tag_names:
            continue
        
        # Remove existing auto-tags if overwrite is enabled
        if request.overwrite_existing:
            existing_auto_tags = db.query(ConversationTag).filter(
                ConversationTag.conversation_id == conversation.id,
                ConversationTag.auto_tagged.is_(True),
            ).all()
            for ct in existing_auto_tags:
                db.delete(ct)
        
        # Add new tags
        tags_added_to_conv = False
        for tag_name in tag_names:
            tag = db.query(Tag).filter(Tag.name == tag_name).first()
            if not tag:
                continue
            
            # Check if already assigned
            existing = db.query(ConversationTag).filter(
                ConversationTag.conversation_id == conversation.id,
                ConversationTag.tag_id == tag.id,
            ).first()
            
            if not existing:
                conversation_tag = ConversationTag(
                    conversation_id=conversation.id,
                    tag_id=tag.id,
                    auto_tagged=True,
                )
                db.add(conversation_tag)
                tags_added_to_conv = True
                tags_added[tag_name] = tags_added.get(tag_name, 0) + 1
        
        if tags_added_to_conv:
            tagged_count += 1
            tagged_ids.append(conversation.id)
    
    db.commit()
    
    return AutoTagResponse(
        tagged_count=tagged_count,
        conversation_ids=tagged_ids,
        tags_added=tags_added,
    )


# ============ Project Endpoints ============

@app.get("/projects", response_model=ProjectListResponse)
def list_projects(
    db: Session = Depends(get_db),
) -> ProjectListResponse:
    """List all projects with conversation counts."""
    
    # Get all projects with conversation counts in a single query
    projects_with_counts = (
        db.query(
            Project,
            func.count(Conversation.id).label('conversation_count')
        )
        .outerjoin(Conversation, Conversation.project_id == Project.id)
        .group_by(Project.id)
        .order_by(Project.name)
        .all()
    )
    
    project_responses = []
    for project, conversation_count in projects_with_counts:
        project_response = ProjectResponse(
            id=project.id,
            name=project.name,
            description=project.description,
            color=project.color,
            created_at=project.created_at,
            conversation_count=conversation_count,
        )
        project_responses.append(project_response)
    
    return ProjectListResponse(
        items=project_responses,
        total=len(project_responses),
    )


@app.post("/projects", response_model=ProjectResponse)
def create_project(
    project: ProjectCreate,
    db: Session = Depends(get_db),
) -> ProjectResponse:
    """Create a new project."""
    
    # Check if project with this name already exists
    existing = db.query(Project).filter(Project.name == project.name).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Project with name '{project.name}' already exists"
        )
    
    # Create new project
    db_project = Project(
        name=project.name,
        description=project.description,
        color=project.color,
    )
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    
    return ProjectResponse(
        id=db_project.id,
        name=db_project.name,
        description=db_project.description,
        color=db_project.color,
        created_at=db_project.created_at,
        conversation_count=0,
    )


@app.get("/projects/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
) -> ProjectResponse:
    """Get a specific project."""
    
    project = db.query(Project).filter(Project.id == project_id).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    conversation_count = db.query(Conversation).filter(
        Conversation.project_id == project.id
    ).count()
    
    return ProjectResponse(
        id=project.id,
        name=project.name,
        description=project.description,
        color=project.color,
        created_at=project.created_at,
        conversation_count=conversation_count,
    )


@app.put("/projects/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: int,
    project_update: ProjectUpdate,
    db: Session = Depends(get_db),
) -> ProjectResponse:
    """Update a project."""
    
    project = db.query(Project).filter(Project.id == project_id).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check if new name conflicts with existing project
    if project_update.name and project_update.name != project.name:
        existing = db.query(Project).filter(Project.name == project_update.name).first()
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"Project with name '{project_update.name}' already exists"
            )
        project.name = project_update.name
    
    if project_update.description is not None:
        project.description = project_update.description
    
    if project_update.color is not None:
        project.color = project_update.color
    
    db.commit()
    db.refresh(project)
    
    conversation_count = db.query(Conversation).filter(
        Conversation.project_id == project.id
    ).count()
    
    return ProjectResponse(
        id=project.id,
        name=project.name,
        description=project.description,
        color=project.color,
        created_at=project.created_at,
        conversation_count=conversation_count,
    )


@app.delete("/projects/{project_id}")
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
) -> dict[str, str]:
    """Delete a project. Conversations in this project will become uncategorized (via ON DELETE SET NULL)."""
    
    project = db.query(Project).filter(Project.id == project_id).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Database will automatically set project_id to NULL via ON DELETE SET NULL constraint
    db.delete(project)
    db.commit()
    
    return {"status": "deleted", "id": str(project_id)}


@app.post("/conversations/{conversation_id}/move")
def move_conversation_to_project(
    conversation_id: int,
    request: MoveToProjectRequest,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Move a conversation to a project (or remove from project if project_id is None)."""
    
    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Validate project exists if project_id is provided
    if request.project_id is not None:
        project = db.query(Project).filter(Project.id == request.project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
    
    old_project_id = conversation.project_id
    conversation.project_id = request.project_id
    
    db.commit()
    db.refresh(conversation)
    
    return {
        "status": "moved",
        "conversation_id": conversation_id,
        "old_project_id": old_project_id,
        "new_project_id": request.project_id,
    }


# ============ Supabase Settings & Sync Endpoints ============

@app.get("/settings/supabase")
def get_supabase_settings() -> dict[str, Any]:
    """Get Supabase connection status and configuration (without exposing keys)."""
    connection_info = get_connection_info()
    return {
        "status": "connected" if connection_info["configured"] else "disconnected",
        "configured": connection_info["configured"],
        "url": connection_info["url"],
        "project_id": connection_info["project_id"],
        "bucket_name": connection_info["bucket_name"],
        "database_mode": DATABASE_MODE,
    }


@app.get("/settings/supabase-dashboard-url")
def get_supabase_dashboard() -> dict[str, Any]:
    """Get the Supabase admin dashboard URL."""
    dashboard_url = get_dashboard_url()
    
    if not dashboard_url:
        raise HTTPException(
            status_code=404,
            detail="Supabase not configured or project ID not available"
        )
    
    return {
        "dashboard_url": dashboard_url,
        "configured": is_supabase_configured(),
    }


@app.get("/storage/files")
def list_storage(
    source_type: str | None = Query(None, description="Filter by source type"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum files to return"),
    offset: int = Query(0, ge=0, description="Number of files to skip"),
) -> dict[str, Any]:
    """List files in Supabase storage bucket."""
    if not is_supabase_configured():
        raise HTTPException(
            status_code=503,
            detail="Supabase storage not configured"
        )
    
    files = list_storage_files(source_type=source_type, limit=limit, offset=offset)
    
    if files is None:
        raise HTTPException(
            status_code=500,
            detail="Failed to list storage files"
        )
    
    return {
        "files": files,
        "count": len(files),
        "source_type": source_type,
        "limit": limit,
        "offset": offset,
    }


@app.post("/sync/upload")
def sync_to_supabase(db: Session = Depends(get_db)) -> dict[str, Any]:
    """
    Manually trigger sync of local data to Supabase.
    This is a placeholder - full implementation would involve complex data syncing logic.
    """
    if not is_supabase_configured():
        raise HTTPException(
            status_code=503,
            detail="Supabase not configured"
        )
    
    # Get count of local conversations
    conversation_count = db.query(func.count(Conversation.id)).scalar()
    
    return {
        "status": "not_implemented",
        "message": "Manual sync to Supabase is not yet fully implemented. Use the migration script instead.",
        "local_conversations": conversation_count,
        "database_mode": DATABASE_MODE,
    }


@app.post("/sync/download")
def sync_from_supabase(db: Session = Depends(get_db)) -> dict[str, Any]:
    """
    Pull data from Supabase to local database.
    This is a placeholder - full implementation would involve complex data syncing logic.
    """
    if not is_supabase_configured():
        raise HTTPException(
            status_code=503,
            detail="Supabase not configured"
        )
    
    return {
        "status": "not_implemented",
        "message": "Manual sync from Supabase is not yet fully implemented. The app uses Supabase directly when configured.",
        "database_mode": DATABASE_MODE,
    }


def _get_frontend_dist() -> Path | None:
    """Locate the built React frontend, whether frozen or in development."""
    if getattr(sys, "frozen", False):
        return Path(sys._MEIPASS) / "frontend" / "dist"  # type: ignore[attr-defined]
    dev_dist = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
    return dev_dist if dev_dist.exists() else None


_frontend_dist = _get_frontend_dist()
if _frontend_dist and _frontend_dist.exists():
    _assets_dir = _frontend_dist / "assets"
    if _assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=_assets_dir), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def _serve_spa(full_path: str) -> FileResponse:
        file_path = _frontend_dist / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(_frontend_dist / "index.html")


def _open_browser_delayed(url: str, delay: float = 2.0) -> None:
    time.sleep(delay)
    webbrowser.open(url)


if __name__ == "__main__":
    if getattr(sys, "frozen", False):
        # When running as a PyInstaller bundle there is no attached console,
        # so sys.stdout/stderr are None.  Redirect them to a log file so that
        # uvicorn's logging formatters (which call stream.isatty()) don't crash.
        log_path = Path(sys.executable).parent / "chatarchive.log"
        _log_file = open(log_path, "w", buffering=1, encoding="utf-8")
        sys.stdout = _log_file
        sys.stderr = _log_file
        logging.basicConfig(stream=_log_file, level=logging.INFO)

        threading.Thread(
            target=_open_browser_delayed,
            args=("http://localhost:8000",),
            daemon=True,
        ).start()
        uvicorn.run(
            app,
            host="0.0.0.0",
            port=8000,
            reload=False,
            log_config=None,
        )
    else:
        uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
