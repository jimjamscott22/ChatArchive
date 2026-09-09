from __future__ import annotations

import copy
import hashlib
import json
from dataclasses import asdict, dataclass, field
from typing import Any, Callable

from sqlalchemy.orm import Session

from app.import_policy import should_auto_merge
from app.importers.bundle_reader import BundleReader, BundleValidationError
from app.importers.bundle_types import (
    ImportWarning,
    ParsedBundle,
    ParsedProject,
    ParsedResource,
    ResourceAvailability,
)
from app.models import Conversation, ImportHistory, ImportSettings, Message, Project, Resource
from app.storage import upload_resource_file


ConversationIngester = Callable[
    [Session, list[dict[str, Any]], ImportHistory, ImportSettings | None],
    tuple[list[Conversation], int, int],
]
ResourceUploader = Callable[
    [int, str, str | None, bytes, str | None],
    dict[str, Any] | None,
]


@dataclass(slots=True)
class BundleIngestResult:
    records: list[Conversation]
    status: str
    skipped_conversations: int
    merged_conversations: int
    projects_created: int
    projects_matched: int
    resource_counts: dict[str, int] = field(default_factory=dict)
    warnings: list[ImportWarning] = field(default_factory=list)


def ingest_parsed_bundle(
    db: Session,
    bundle: ParsedBundle,
    reader: BundleReader,
    import_record: ImportHistory,
    settings: ImportSettings | None,
    ingest_conversations: ConversationIngester,
    upload_resource: ResourceUploader = upload_resource_file,
) -> BundleIngestResult:
    warnings = list(bundle.warnings)
    projects_by_source_id, projects_created, projects_matched = _resolve_projects(
        db,
        bundle.projects,
    )

    conversation_values = copy.deepcopy(bundle.conversations)
    provider_project_ids: dict[tuple[str, str], int] = {}
    for conversation in conversation_values:
        source_project_id = conversation.pop("source_project_id", None)
        project = projects_by_source_id.get(str(source_project_id))
        if project is not None:
            conversation["project_id"] = project.id
            provider_project_ids[(conversation["source"], str(conversation["source_id"]))] = project.id

    records, skipped_count, merged_count = ingest_conversations(
        db,
        conversation_values,
        import_record,
        settings,
    )
    # The shared ingester does not apply bundle project metadata to merged rows.
    for record in records:
        project_id = provider_project_ids.get((record.source, str(record.source_id)))
        if project_id is not None:
            record.project_id = project_id
    db.flush()

    conversations_by_source_id = {
        str(record.source_id): record
        for record in records
        if record.source_id is not None
    }
    conversation_ids = [record.id for record in records]
    message_rows = (
        db.query(Message)
        .filter(Message.conversation_id.in_(conversation_ids))
        .all()
        if conversation_ids
        else []
    )
    messages_by_parent_and_source_id = {
        (message.conversation_id, str(message.source_id)): message
        for message in message_rows
        if message.source_id is not None
    }

    auto_merge = (
        should_auto_merge(settings.auto_merge_duplicates, settings.keep_separate)
        if settings
        else False
    )
    resource_counts = {availability.value: 0 for availability in ResourceAvailability}
    partial = False

    for parsed_resource in bundle.resources:
        conversation = conversations_by_source_id.get(
            str(parsed_resource.source_conversation_id)
        )
        project = projects_by_source_id.get(str(parsed_resource.source_project_id))
        message = (
            messages_by_parent_and_source_id.get(
                (conversation.id, str(parsed_resource.source_message_id))
            )
            if conversation and parsed_resource.source_message_id is not None
            else None
        )

        values, resource_warnings, upload_failed = _resource_values(
            parsed_resource,
            reader,
            import_record.id,
            upload_resource,
        )
        warnings.extend(resource_warnings)
        partial = partial or upload_failed
        values.update(
            {
                "import_history_id": import_record.id,
                "project_id": project.id if project else None,
                "conversation_id": conversation.id if conversation else None,
                "message_id": message.id if message else None,
            }
        )

        existing = (
            _find_existing_resource(db, values)
            if auto_merge
            else None
        )
        if existing:
            if (
                existing.availability == ResourceAvailability.STORED.value
                and existing.storage_path
                and not values["storage_path"]
            ):
                # Omitted bytes or a failed replacement must not hide stored content.
                for key in ("storage_path", "availability", "byte_size", "sha256", "mime_type"):
                    values[key] = getattr(existing, key)
            for key, value in values.items():
                setattr(existing, key, value)
            resource = existing
        else:
            resource = Resource(**values)
            db.add(resource)
        resource_counts[resource.availability] += 1

    import_record.resource_count = sum(resource_counts.values())
    import_record.unavailable_resource_count = resource_counts[
        ResourceAvailability.UNAVAILABLE.value
    ]
    import_record.warning_count = len(warnings)
    import_record.status = "partial" if partial else "success"
    import_record.imported_count = len(records)
    import_record.manifest_json = json.dumps(
        {
            "inventory": [asdict(entry) for entry in bundle.inventory],
            "warnings": [asdict(warning) for warning in warnings],
        },
        default=str,
    )

    notes: list[str] = []
    if merged_count:
        notes.append(f"Updated {merged_count} existing conversation(s)")
    if skipped_count:
        notes.append(f"Skipped {skipped_count} empty conversation(s)")
    import_record.error_message = "; ".join(notes) if notes else None

    return BundleIngestResult(
        records=records,
        status=import_record.status,
        skipped_conversations=skipped_count,
        merged_conversations=merged_count,
        projects_created=projects_created,
        projects_matched=projects_matched,
        resource_counts=resource_counts,
        warnings=warnings,
    )


def _resolve_projects(
    db: Session,
    parsed_projects: list[ParsedProject],
) -> tuple[dict[str, Project], int, int]:
    resolved: dict[str, Project] = {}
    created = 0
    matched = 0

    for parsed in parsed_projects:
        project = (
            db.query(Project)
            .filter(
                Project.source == parsed.source,
                Project.source_id == parsed.source_id,
            )
            .first()
        )
        if project:
            matched += 1
            project.description = parsed.description or project.description
            project.instructions = parsed.instructions or project.instructions
            project.raw_json = json.dumps(parsed.raw_metadata, default=str)
        else:
            project = Project(
                name=_available_project_name(db, parsed),
                description=parsed.description,
                source=parsed.source,
                source_id=parsed.source_id,
                instructions=parsed.instructions,
                raw_json=json.dumps(parsed.raw_metadata, default=str),
            )
            db.add(project)
            db.flush()
            created += 1
        resolved[parsed.source_id] = project
    return resolved, created, matched


def _available_project_name(db: Session, parsed: ParsedProject) -> str:
    base = parsed.name[:100] or f"{parsed.source.title()} project"
    existing = db.query(Project).filter(Project.name == base).first()
    if existing is None:
        return base

    suffix = f" ({parsed.source.title()} {parsed.source_id[:8]})"
    candidate = f"{base[: 100 - len(suffix)]}{suffix}"
    index = 2
    while db.query(Project).filter(Project.name == candidate).first():
        numbered_suffix = f"{suffix[:-1]} {index})"
        candidate = f"{base[: 100 - len(numbered_suffix)]}{numbered_suffix}"
        index += 1
    return candidate


def _resource_values(
    resource: ParsedResource,
    reader: BundleReader,
    import_history_id: int,
    uploader: ResourceUploader,
) -> tuple[dict[str, Any], list[ImportWarning], bool]:
    warnings: list[ImportWarning] = []
    availability = resource.availability
    byte_size = resource.byte_size
    sha256 = resource.sha256
    mime_type = resource.mime_type
    storage_path: str | None = None
    upload_failed = False

    if resource.archive_entry:
        try:
            content = reader.read_bytes(resource.archive_entry)
            byte_size = len(content)
            sha256 = hashlib.sha256(content).hexdigest()
            mime_type = _detect_mime_type(content, resource.mime_type)
            uploaded = uploader(
                import_history_id,
                sha256,
                resource.filename,
                content,
                mime_type,
            )
        except BundleValidationError:
            raise
        except Exception:
            uploaded = None

        if uploaded and uploaded.get("success"):
            availability = ResourceAvailability.STORED
            storage_path = str(uploaded["path"])
        else:
            availability = ResourceAvailability.UNAVAILABLE
            upload_failed = True
            warnings.append(
                ImportWarning(
                    code="RESOURCE_STORAGE_FAILED",
                    message="Resource bytes were present but could not be stored.",
                    entry=resource.archive_entry,
                )
            )

    values = {
        "source": resource.source,
        "source_id": resource.source_id,
        "logical_id": resource.logical_id,
        "version_index": resource.version_index,
        "kind": resource.kind.value,
        "title": resource.title,
        "filename": resource.filename,
        "mime_type": mime_type,
        "availability": availability.value,
        "byte_size": byte_size,
        "sha256": sha256,
        "storage_path": storage_path,
        "text_content": resource.text_content,
        "metadata_json": json.dumps(resource.raw_metadata, default=str),
    }
    return values, warnings, upload_failed


def _detect_mime_type(content: bytes, claimed: str | None) -> str:
    """Prefer security-relevant file signatures over provider metadata."""
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if content.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if content.startswith((b"GIF87a", b"GIF89a")):
        return "image/gif"
    if (
        len(content) >= 12
        and content.startswith(b"RIFF")
        and content[8:12] == b"WEBP"
    ):
        return "image/webp"
    if content.startswith(b"%PDF-"):
        return "application/pdf"
    if content.startswith(b"PK\x03\x04"):
        return "application/zip"

    sample = content[:4096].lstrip().lower()
    if sample.startswith(b"<?xml"):
        sample = sample[sample.find(b"?>") + 2 :].lstrip()
    if b"<svg" in sample[:1024]:
        return "image/svg+xml"
    if any(marker in sample[:1024] for marker in (b"<!doctype html", b"<html", b"<script")):
        return "text/html"
    return claimed or "application/octet-stream"


def _find_existing_resource(
    db: Session,
    values: dict[str, Any],
) -> Resource | None:
    query = db.query(Resource).filter(
        Resource.source == values["source"],
        Resource.conversation_id == values["conversation_id"],
    )
    if values["logical_id"]:
        return query.filter(
            Resource.logical_id == values["logical_id"],
            Resource.version_index == values["version_index"],
        ).first()
    if values["source_id"]:
        return query.filter(
            Resource.source_id == values["source_id"],
            Resource.version_index == values["version_index"],
        ).first()
    if values["sha256"]:
        return query.filter(
            Resource.kind == values["kind"],
            Resource.sha256 == values["sha256"],
        ).first()
    return None
