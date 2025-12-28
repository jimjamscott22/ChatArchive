from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


# ============ Message Schemas ============

class MessageBase(BaseModel):
    role: str
    content: str
    content_type: str = "text"
    created_at: datetime | None = None
    model: str | None = None


class MessageResponse(MessageBase):
    id: int
    conversation_id: int
    order_index: int
    source_id: str | None = None
    
    model_config = ConfigDict(from_attributes=True)


# ============ Conversation Schemas ============

class ConversationCreate(BaseModel):
    source: str
    title: str | None = None
    created_at: datetime | None = None
    raw_json: str


class ConversationBase(BaseModel):
    id: int
    source: str
    source_id: str | None = None
    title: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    message_count: int = 0
    
    model_config = ConfigDict(from_attributes=True)


class ConversationResponse(ConversationBase):
    """Basic conversation info without messages."""
    pass


class ConversationDetail(ConversationBase):
    """Full conversation with messages."""
    messages: list[MessageResponse] = []


# ============ List/Search Schemas ============

class ConversationListResponse(BaseModel):
    """Paginated list of conversations."""
    items: list[ConversationResponse]
    total: int
    page: int
    page_size: int
    pages: int


class SearchResult(BaseModel):
    """Search result with highlighted snippet."""
    conversation: ConversationResponse
    snippet: str | None = None
    match_count: int = 0
