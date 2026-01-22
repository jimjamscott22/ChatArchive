from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload
import uvicorn

from app.database import get_db
from app.importers.chatgpt import parse_chatgpt_export
from app.importers.claude import parse_claude_export
from app.importers.gemini import parse_gemini_export
from app.importers.copilot import parse_copilot_export
from app.models import Base, Conversation, Message, ImportHistory, ImportSettings
from app.schemas import (
    ConversationResponse,
    ConversationDetail,
    ConversationListResponse,
    MessageResponse,
    ImportHistoryResponse,
    ImportHistoryListResponse,
    ImportSettingsResponse,
    ImportSettingsUpdate,
    DuplicateConversation,
    DuplicateGroup,
    DuplicateGroupsResponse,
    BulkDeleteRequest,
    BulkDeleteResponse,
)

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
    sort_by: Literal["created_at", "updated_at", "title", "message_count"] = Query(
        "created_at", description="Field to sort by"
    ),
    sort_order: Literal["asc", "desc"] = Query("desc", description="Sort order"),
) -> ConversationListResponse:
    """List all conversations with pagination and filtering."""
    
    query = db.query(Conversation)
    
    # Apply source filter
    if source:
        query = query.filter(Conversation.source == source)
    
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
        items=conversations,
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
    """Search conversations by title and optionally message content."""
    
    search_term = f"%{q}%"
    
    # Build search conditions
    conditions = [Conversation.title.ilike(search_term)]
    
    if search_messages:
        # Subquery to find conversations with matching messages
        message_match = (
            db.query(Message.conversation_id)
            .filter(Message.content.ilike(search_term))
            .distinct()
            .subquery()
        )
        conditions.append(Conversation.id.in_(db.query(message_match.c.conversation_id)))
    
    query = db.query(Conversation).filter(or_(*conditions))
    
    # Apply source filter
    if source:
        query = query.filter(Conversation.source == source)
    
    # Get total
    total = query.count()
    
    # Sort by relevance (title matches first) then by date
    query = query.order_by(
        Conversation.title.ilike(search_term).desc(),
        Conversation.created_at.desc().nulls_last()
    )
    
    # Paginate
    offset = (page - 1) * page_size
    conversations = query.offset(offset).limit(page_size).all()
    
    pages = (total + page_size - 1) // page_size
    
    return ConversationListResponse(
        items=conversations,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@app.get("/conversations/{conversation_id}", response_model=ConversationDetail)
def get_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
) -> ConversationDetail:
    """Get a single conversation with all its messages."""
    
    conversation = (
        db.query(Conversation)
        .options(joinedload(Conversation.messages))
        .filter(Conversation.id == conversation_id)
        .first()
    )
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Sort messages by order_index
    conversation.messages.sort(key=lambda m: m.order_index)
    
    return conversation


@app.delete("/conversations/{conversation_id}")
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

def get_import_settings(db: Session) -> ImportSettings | None:
    """Get the current import settings."""
    return db.query(ImportSettings).first()


def conversation_exists(
    db: Session,
    source: str,
    source_id: str | None
) -> bool:
    """Check if a conversation with the given source and source_id already exists."""
    if not source_id:
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

    deleted_ids = []
    failed_ids = []

    for conv_id in conversation_ids:
        try:
            conversation = db.query(Conversation).filter(
                Conversation.id == conv_id
            ).first()

            if conversation:
                db.delete(conversation)
                db.flush()
                deleted_ids.append(conv_id)
            else:
                failed_ids.append(conv_id)
        except Exception as e:
            logger.error(f"Failed to delete conversation {conv_id}: {e}")
            failed_ids.append(conv_id)
            db.rollback()

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to commit bulk delete: {e}")
        failed_ids.extend(deleted_ids)
        deleted_ids = []

    return deleted_ids, failed_ids


# ============ Duplicate Detection Endpoints ============

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


@app.post("/import/chatgpt", response_model=list[ConversationResponse])
async def import_chatgpt(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> list[ConversationResponse]:
    if not file.filename.endswith(".json"):
        raise HTTPException(status_code=400, detail="Expected a .json export")

    raw = await file.read()
    
    # Create import history record
    import_record = ImportHistory(
        filename=file.filename,
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
    settings = get_import_settings(db)
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
        logger.error(f"Import validation error for {file.filename}: {exc}")
        raise HTTPException(status_code=400, detail="Invalid data format") from exc
    except Exception as exc:
        # Handle unexpected errors without exposing internals
        db.rollback()
        import_record.status = "failure"
        import_record.error_message = "An error occurred during import"
        db.commit()
        logger.exception(f"Unexpected error during import of {file.filename}")
        raise HTTPException(status_code=500, detail="Import failed")

    return records


@app.post("/import/claude", response_model=list[ConversationResponse])
async def import_claude(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> list[ConversationResponse]:
    """Import conversations from Claude export."""
    if not file.filename.endswith(".json"):
        raise HTTPException(status_code=400, detail="Expected a .json export")

    raw = await file.read()
    
    import_record = ImportHistory(
        filename=file.filename,
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
    settings = get_import_settings(db)
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
        logger.exception(f"Error importing Claude file {file.filename}")
        raise HTTPException(status_code=500, detail="Import failed")

    return records


@app.post("/import/gemini", response_model=list[ConversationResponse])
async def import_gemini(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> list[ConversationResponse]:
    """Import conversations from Gemini/Bard export."""
    if not file.filename.endswith(".json"):
        raise HTTPException(status_code=400, detail="Expected a .json export")

    raw = await file.read()
    
    import_record = ImportHistory(
        filename=file.filename,
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
    settings = get_import_settings(db)
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
        logger.exception(f"Error importing Gemini file {file.filename}")
        raise HTTPException(status_code=500, detail="Import failed")

    return records


@app.post("/import/copilot", response_model=list[ConversationResponse])
async def import_copilot(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> list[ConversationResponse]:
    """Import conversations from GitHub Copilot export."""
    if not file.filename.endswith(".json"):
        raise HTTPException(status_code=400, detail="Expected a .json export")

    raw = await file.read()
    
    import_record = ImportHistory(
        filename=file.filename,
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
    settings = get_import_settings(db)
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
        logger.exception(f"Error importing Copilot file {file.filename}")
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


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
