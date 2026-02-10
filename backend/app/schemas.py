from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


# ============ Project Schemas ============

class ProjectBase(BaseModel):
    name: str
    description: str | None = None
    color: str | None = None


class ProjectCreate(ProjectBase):
    """Create a new project."""
    pass


class ProjectUpdate(BaseModel):
    """Update an existing project."""
    name: str | None = None
    description: str | None = None
    color: str | None = None


class ProjectResponse(ProjectBase):
    """Project with usage statistics."""
    id: int
    created_at: datetime
    conversation_count: int = 0
    
    model_config = ConfigDict(from_attributes=True)


class ProjectListResponse(BaseModel):
    """List of all projects."""
    items: list[ProjectResponse]
    total: int


class MoveToProjectRequest(BaseModel):
    """Request to move a conversation to a project."""
    project_id: int | None  # None = move to uncategorized


# ============ Tag Schemas ============

class TagBase(BaseModel):
    name: str
    description: str | None = None
    color: str | None = None


class TagCreate(TagBase):
    """Create a new tag."""
    pass


class TagUpdate(BaseModel):
    """Update an existing tag."""
    name: str | None = None
    description: str | None = None
    color: str | None = None


class TagResponse(TagBase):
    """Tag with usage statistics."""
    id: int
    created_at: datetime
    conversation_count: int = 0
    
    model_config = ConfigDict(from_attributes=True)


class TagListResponse(BaseModel):
    """List of all tags."""
    items: list[TagResponse]
    total: int


class AddTagRequest(BaseModel):
    """Request to add a tag to a conversation."""
    tag_name: str
    auto_tagged: bool = False


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
    tags: list[TagResponse] = []
    project: ProjectResponse | None = None
    
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


# ============ Duplicate Detection Schemas ============

class DuplicateConversation(BaseModel):
    """Conversation info for duplicate detection."""
    id: int
    source: str
    source_id: str | None
    title: str | None
    created_at: datetime | None
    updated_at: datetime | None
    message_count: int

    model_config = ConfigDict(from_attributes=True)


class DuplicateGroup(BaseModel):
    """A group of duplicate conversations."""
    key: str
    source: str
    source_id: str | None
    title: str | None
    count: int
    conversations: list[DuplicateConversation]
    total_messages: int


class DuplicateGroupsResponse(BaseModel):
    """Response containing all duplicate groups."""
    groups: list[DuplicateGroup]
    total_duplicates: int
    total_groups: int
    strategy: str


# ============ Bulk Operations Schemas ============

class BulkDeleteRequest(BaseModel):
    """Request to delete multiple conversations."""
    conversation_ids: list[int]


class BulkDeleteResponse(BaseModel):
    """Response from bulk delete operation."""
    deleted_count: int
    deleted_ids: list[int]
    failed_ids: list[int] = []


# ============ Auto-Tagging Schemas ============

class AutoTagRequest(BaseModel):
    """Request to auto-tag conversations."""
    conversation_ids: list[int] | None = None  # If None, tag all conversations
    overwrite_existing: bool = False  # Whether to overwrite manually added tags


class AutoTagResponse(BaseModel):
    """Response from auto-tagging operation."""
    tagged_count: int
    conversation_ids: list[int]
    tags_added: dict[str, int]  # tag_name -> count
