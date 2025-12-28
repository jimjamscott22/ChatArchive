from __future__ import annotations

import json
from typing import Any, Literal

from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload
import uvicorn

from app.database import get_db
from app.importers.chatgpt import parse_chatgpt_export
from app.models import Base, Conversation, Message
from app.schemas import (
    ConversationResponse,
    ConversationDetail,
    ConversationListResponse,
    MessageResponse,
)

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
    try:
        payload: Any = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Invalid JSON") from exc

    try:
        parsed = parse_chatgpt_export(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    records: list[Conversation] = []
    for item in parsed:
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

    return records


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
