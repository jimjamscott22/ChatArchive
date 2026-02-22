"""Pydantic models for the preprocessing pipeline."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class ContentType(str, Enum):
    TEXT = "text"
    CODE = "code"
    TABLE = "table"
    IMAGE = "image"


class CodeBlock(BaseModel):
    """An extracted code block from a conversation message."""

    language: str | None = None
    code: str
    start_line: int = 0
    end_line: int = 0


class ExtractedTable(BaseModel):
    """A table extracted from markdown content."""

    headers: list[str] = []
    rows: list[list[str]] = []
    raw_markdown: str = ""


class ExtractedArtifact(BaseModel):
    """An artifact extracted from a Claude response."""

    identifier: str | None = None
    artifact_type: str | None = None
    title: str | None = None
    content: str = ""


class EntityExtraction(BaseModel):
    """Entities extracted from conversation content."""

    programming_languages: list[str] = []
    frameworks: list[str] = []
    libraries: list[str] = []
    project_names: list[str] = []
    technologies: list[str] = []


class TokenMetrics(BaseModel):
    """Token count metrics for a conversation."""

    total_tokens: int = 0
    user_tokens: int = 0
    assistant_tokens: int = 0
    avg_tokens_per_message: float = 0.0


class ProcessedMessage(BaseModel):
    """A single message after preprocessing."""

    source_id: str | None = None
    role: str
    content: str
    content_type: str = "text"
    created_at: datetime | None = None
    order_index: int = 0
    model: str | None = None
    code_blocks: list[CodeBlock] = []
    tables: list[ExtractedTable] = []
    token_count: int = 0


class ProcessedConversation(BaseModel):
    """A fully processed conversation ready for database storage."""

    # Core fields (match existing DB schema)
    source: str = "claude"
    source_id: str | None = None
    title: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    message_count: int = 0
    raw_json: str = ""

    # Processed messages
    messages: list[ProcessedMessage] = []

    # Extracted metadata
    duration_seconds: float | None = None
    code_blocks: list[CodeBlock] = []
    artifacts: list[ExtractedArtifact] = []
    entities: EntityExtraction = Field(default_factory=EntityExtraction)

    # Classification
    tags: list[str] = []

    # Token metrics
    token_metrics: TokenMetrics = Field(default_factory=TokenMetrics)

    # Preview
    preview: str | None = None

    # Deduplication
    content_hash: str | None = None

    def to_db_dict(self) -> dict[str, Any]:
        """Convert to a dictionary compatible with the existing DB models."""
        return {
            "source": self.source,
            "source_id": self.source_id,
            "title": self.title,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "message_count": self.message_count,
            "raw_json": self.raw_json,
            "messages": [
                {
                    "source_id": msg.source_id,
                    "role": msg.role,
                    "content": msg.content,
                    "content_type": msg.content_type,
                    "created_at": msg.created_at,
                    "order_index": msg.order_index,
                    "model": msg.model,
                }
                for msg in self.messages
            ],
        }


class ImportResult(BaseModel):
    """Result of processing a batch of conversations."""

    total_conversations: int = 0
    processed_conversations: int = 0
    skipped_duplicates: int = 0
    failed_conversations: int = 0
    conversations: list[ProcessedConversation] = []
    errors: list[str] = []


class PipelineProgress(BaseModel):
    """Progress tracking for the pipeline."""

    stage: str = ""
    current: int = 0
    total: int = 0
    message: str = ""

    @property
    def percentage(self) -> float:
        if self.total == 0:
            return 0.0
        return (self.current / self.total) * 100.0
