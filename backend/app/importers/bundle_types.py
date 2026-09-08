from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class ResourceAvailability(str, Enum):
    STORED = "stored"
    INLINE = "inline"
    METADATA_ONLY = "metadata_only"
    UNAVAILABLE = "unavailable"


class ResourceKind(str, Enum):
    ARTIFACT = "artifact"
    IMAGE = "image"
    ATTACHMENT = "attachment"
    AUDIO = "audio"
    PROJECT_KNOWLEDGE = "project_knowledge"
    CITATION = "citation"
    OTHER = "other"


@dataclass(frozen=True, slots=True)
class ImportWarning:
    code: str
    message: str
    entry: str | None = None
    context: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class BundleInventoryEntry:
    path: str
    byte_size: int
    compressed_size: int
    crc32: int
    is_nested_archive: bool = False


@dataclass(slots=True)
class ParsedProject:
    source: str
    source_id: str
    name: str
    description: str | None = None
    instructions: str | None = None
    created_at: Any = None
    updated_at: Any = None
    raw_metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class ParsedResource:
    source: str
    kind: ResourceKind
    availability: ResourceAvailability
    source_id: str | None = None
    logical_id: str | None = None
    version_index: int | None = None
    title: str | None = None
    filename: str | None = None
    mime_type: str | None = None
    byte_size: int | None = None
    sha256: str | None = None
    text_content: str | None = None
    archive_entry: str | None = None
    source_project_id: str | None = None
    source_conversation_id: str | None = None
    source_message_id: str | None = None
    raw_metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class ParsedBundle:
    source: str
    conversations: list[dict[str, Any]] = field(default_factory=list)
    projects: list[ParsedProject] = field(default_factory=list)
    resources: list[ParsedResource] = field(default_factory=list)
    inventory: list[BundleInventoryEntry] = field(default_factory=list)
    warnings: list[ImportWarning] = field(default_factory=list)
