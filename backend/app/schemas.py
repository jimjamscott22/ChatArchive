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


# ============ Import History Schemas ============

class ImportHistoryResponse(BaseModel):
    """Import history record."""
    id: int
    filename: str
    source_location: str | None = None
    source_type: str
    file_format: str
    status: str
    created_at: datetime
    imported_count: int
    error_message: str | None = None
    
    model_config = ConfigDict(from_attributes=True)


class ImportHistoryListResponse(BaseModel):
    """Paginated list of import history records."""
    items: list[ImportHistoryResponse]
    total: int
    page: int
    page_size: int
    pages: int


# ============ Import Settings Schemas ============

class ImportSettingsResponse(BaseModel):
    """Import settings configuration."""
    id: int
    allowed_formats: str
    default_format: str
    auto_merge_duplicates: bool
    keep_separate: bool
    skip_empty_conversations: bool
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class ImportSettingsUpdate(BaseModel):
    """Import settings update payload."""
    allowed_formats: str | None = None
    default_format: str | None = None
    auto_merge_duplicates: bool | None = None
    keep_separate: bool | None = None
    skip_empty_conversations: bool | None = None
