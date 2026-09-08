from __future__ import annotations

import re
from html.parser import HTMLParser
from pathlib import PurePosixPath
from typing import Any, Iterator

from app.importers.bundle_reader import BundleReader, BundleValidationError
from app.importers.bundle_types import (
    ImportWarning,
    ParsedBundle,
    ParsedProject,
    ParsedResource,
    ResourceAvailability,
    ResourceKind,
)
from app.importers.claude import parse_claude_export


_LEGACY_OPEN_RE = re.compile(r"<antartifact\b", re.IGNORECASE)
_LEGACY_CLOSE_RE = re.compile(r"</antartifact\s*>", re.IGNORECASE)
_MAX_LEGACY_OPEN_TAG = 8 * 1024


class _OpeningTagParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.attributes: dict[str, str] = {}

    def handle_starttag(
        self,
        tag: str,
        attrs: list[tuple[str, str | None]],
    ) -> None:
        if tag.casefold() == "antartifact":
            self.attributes = {key.casefold(): value or "" for key, value in attrs}


def parse_claude_bundle(reader: BundleReader) -> ParsedBundle:
    conversation_paths = reader.find_basename("conversations.json")
    if not conversation_paths:
        raise BundleValidationError(
            "BUNDLE_CONVERSATIONS_MISSING",
            "Claude bundle does not contain conversations.json",
        )
    if len(conversation_paths) > 1:
        raise BundleValidationError(
            "BUNDLE_CONVERSATIONS_AMBIGUOUS",
            "Claude bundle contains multiple conversations.json files",
        )
    payload = reader.read_json(conversation_paths[0])
    raw_conversations = _conversation_values(payload)
    conversations = parse_claude_export(raw_conversations)

    raw_by_id = {
        str(item.get("uuid") or item.get("id")): item
        for item in raw_conversations
        if item.get("uuid") or item.get("id")
    }
    for conversation in conversations:
        raw = raw_by_id.get(str(conversation.get("source_id")))
        if raw and raw.get("project_uuid") is not None:
            conversation["source_project_id"] = str(raw["project_uuid"])

    projects = _parse_projects(reader)
    referenced_project_ids = {
        str(item["project_uuid"])
        for item in raw_conversations
        if item.get("project_uuid") is not None
    }
    known_project_ids = {project.source_id for project in projects}
    for project_id in sorted(referenced_project_ids - known_project_ids):
        projects.append(
            ParsedProject(
                source="claude",
                source_id=project_id,
                name=f"Claude project {project_id[:8]}",
            )
        )

    warnings = list(reader.warnings)
    resources = _extract_resources(raw_conversations, reader, warnings)
    supported_json = {conversation_paths[0].casefold()}
    supported_json.update(path.casefold() for path in reader.find_basename("projects.json"))
    for path in reader.paths:
        if path.casefold().endswith(".json") and path.casefold() not in supported_json:
            warnings.append(
                ImportWarning(
                    code="UNSUPPORTED_COMPANION_FILE",
                    message="Companion JSON is inventoried but is not imported.",
                    entry=path,
                )
            )

    return ParsedBundle(
        source="claude",
        conversations=conversations,
        projects=projects,
        resources=resources,
        inventory=reader.inventory,
        warnings=warnings,
    )


def iter_legacy_artifacts(text: str) -> Iterator[dict[str, Any]]:
    """Yield bounded legacy antArtifact blocks while preserving inner source."""
    position = 0
    while match := _LEGACY_OPEN_RE.search(text, position):
        open_end = text.find(">", match.end())
        if open_end < 0 or open_end - match.start() > _MAX_LEGACY_OPEN_TAG:
            position = match.end()
            continue
        close = _LEGACY_CLOSE_RE.search(text, open_end + 1)
        if close is None:
            position = open_end + 1
            continue

        parser = _OpeningTagParser()
        parser.feed(text[match.start() : open_end + 1])
        attributes = parser.attributes
        yield {
            "identifier": attributes.get("identifier") or attributes.get("id"),
            "title": attributes.get("title"),
            "type": attributes.get("type"),
            "language": attributes.get("language"),
            "content": text[open_end + 1 : close.start()],
        }
        position = close.end()


def _conversation_values(payload: object) -> list[dict[str, Any]]:
    values = payload.get("conversations") if isinstance(payload, dict) else payload
    if not isinstance(values, list):
        raise BundleValidationError(
            "BUNDLE_CONVERSATIONS_INVALID",
            "Claude conversations.json is not an array",
        )
    return [item for item in values if isinstance(item, dict)]


def _parse_projects(reader: BundleReader) -> list[ParsedProject]:
    paths = reader.find_basename("projects.json")
    if len(paths) != 1:
        return []
    payload = reader.read_json(paths[0])
    values = payload.get("projects") if isinstance(payload, dict) else payload
    if not isinstance(values, list):
        return []

    projects: list[ParsedProject] = []
    for item in values:
        if not isinstance(item, dict):
            continue
        project_id = item.get("uuid") or item.get("id") or item.get("project_uuid")
        if project_id is None:
            continue
        project_id = str(project_id)
        projects.append(
            ParsedProject(
                source="claude",
                source_id=project_id,
                name=str(item.get("name") or item.get("title") or f"Claude project {project_id[:8]}"),
                description=_optional_string(item.get("description")),
                instructions=_optional_string(item.get("instructions")),
                created_at=item.get("created_at"),
                updated_at=item.get("updated_at"),
                raw_metadata=item,
            )
        )
    return projects


def _extract_resources(
    conversations: list[dict[str, Any]],
    reader: BundleReader,
    warnings: list[ImportWarning],
) -> list[ParsedResource]:
    inventory_by_path = {entry.path: entry for entry in reader.inventory}
    resources: list[ParsedResource] = []
    revisions: dict[tuple[str, str], int] = {}

    for conversation in conversations:
        conversation_id = _optional_string(
            conversation.get("uuid") or conversation.get("id")
        )
        project_id = _optional_string(conversation.get("project_uuid"))
        messages = conversation.get("chat_messages") or []
        if not isinstance(messages, list):
            continue
        for message in messages:
            if not isinstance(message, dict):
                continue
            message_id = _optional_string(message.get("uuid") or message.get("id"))
            blocks = message.get("content") or []
            if isinstance(blocks, list):
                for block in blocks:
                    artifact = _artifact_from_tool_block(block)
                    if artifact:
                        resources.append(
                            _artifact_resource(
                                artifact,
                                conversation_id,
                                message_id,
                                project_id,
                                revisions,
                            )
                        )

            text = message.get("text")
            if isinstance(text, str):
                for artifact in iter_legacy_artifacts(text):
                    resources.append(
                        _artifact_resource(
                            artifact,
                            conversation_id,
                            message_id,
                            project_id,
                            revisions,
                        )
                    )

            attachments = message.get("attachments") or message.get("files") or []
            if not isinstance(attachments, list):
                continue
            for attachment in attachments:
                if not isinstance(attachment, dict):
                    continue
                filename = _optional_string(
                    attachment.get("file_name")
                    or attachment.get("filename")
                    or attachment.get("name")
                )
                source_id = _optional_string(
                    attachment.get("uuid")
                    or attachment.get("id")
                    or attachment.get("file_id")
                    or filename
                )
                if source_id is None:
                    continue
                matched_path, ambiguous = _match_attachment(reader, source_id, filename)
                if ambiguous:
                    warnings.append(
                        ImportWarning(
                            code="AMBIGUOUS_ASSET_REFERENCE",
                            message="Multiple archive entries match an attachment.",
                            context={"reference": source_id},
                        )
                    )
                extracted = _optional_string(
                    attachment.get("extracted_content")
                    or attachment.get("extracted")
                    or attachment.get("text")
                )
                if matched_path:
                    availability = ResourceAvailability.STORED
                    filename = filename or PurePosixPath(matched_path).name
                    byte_size = inventory_by_path[matched_path].byte_size
                elif extracted:
                    availability = ResourceAvailability.INLINE
                    byte_size = _optional_int(
                        attachment.get("size") or attachment.get("byte_size")
                    )
                else:
                    availability = ResourceAvailability.METADATA_ONLY
                    byte_size = _optional_int(
                        attachment.get("size") or attachment.get("byte_size")
                    )
                    warnings.append(
                        ImportWarning(
                            code="RESOURCE_BYTES_MISSING",
                            message="The export references an attachment but omits its bytes.",
                            context={"reference": source_id},
                        )
                    )
                mime_type = _optional_string(
                    attachment.get("mime_type") or attachment.get("content_type")
                )
                resources.append(
                    ParsedResource(
                        source="claude",
                        source_id=source_id,
                        kind=_resource_kind(mime_type),
                        availability=availability,
                        title=filename,
                        filename=filename,
                        mime_type=mime_type,
                        byte_size=byte_size,
                        text_content=extracted,
                        archive_entry=matched_path,
                        source_project_id=project_id,
                        source_conversation_id=conversation_id,
                        source_message_id=message_id,
                        raw_metadata=attachment,
                    )
                )
    return resources


def _artifact_from_tool_block(block: Any) -> dict[str, Any] | None:
    if not isinstance(block, dict) or block.get("type") != "tool_use":
        return None
    if str(block.get("name", "")).casefold() != "artifacts":
        return None
    value = block.get("input")
    if not isinstance(value, dict) or not value.get("content"):
        return None
    return {
        "identifier": value.get("id") or value.get("identifier"),
        "title": value.get("title"),
        "type": value.get("type"),
        "language": value.get("language"),
        "content": str(value["content"]),
        "raw_metadata": value,
    }


def _artifact_resource(
    artifact: dict[str, Any],
    conversation_id: str | None,
    message_id: str | None,
    project_id: str | None,
    revisions: dict[tuple[str, str], int],
) -> ParsedResource:
    logical_id = _optional_string(artifact.get("identifier"))
    fallback = f"{message_id or 'message'}:{artifact.get('title') or 'artifact'}"
    revision_key = (conversation_id or "", logical_id or fallback)
    version = revisions.get(revision_key, 0)
    revisions[revision_key] = version + 1
    artifact_type = _optional_string(artifact.get("type"))
    return ParsedResource(
        source="claude",
        source_id=logical_id,
        logical_id=logical_id,
        version_index=version,
        kind=ResourceKind.ARTIFACT,
        availability=ResourceAvailability.INLINE,
        title=_optional_string(artifact.get("title")) or "Artifact",
        mime_type=artifact_type,
        text_content=_optional_string(artifact.get("content")),
        source_project_id=project_id,
        source_conversation_id=conversation_id,
        source_message_id=message_id,
        raw_metadata=artifact.get("raw_metadata") or {
            key: value for key, value in artifact.items() if key != "content"
        },
    )


def _match_attachment(
    reader: BundleReader,
    source_id: str,
    filename: str | None,
) -> tuple[str | None, bool]:
    for value in (filename, source_id):
        if not value:
            continue
        try:
            exact = reader.find_path(value)
        except BundleValidationError:
            exact = None
        if exact:
            return exact, False
        matches = reader.find_basename(value)
        if len(matches) == 1:
            return matches[0], False
        if len(matches) > 1:
            return None, True
    return None, False


def _resource_kind(mime_type: str | None) -> ResourceKind:
    if mime_type and mime_type.startswith("image/"):
        return ResourceKind.IMAGE
    if mime_type and mime_type.startswith("audio/"):
        return ResourceKind.AUDIO
    return ResourceKind.ATTACHMENT


def _optional_string(value: Any) -> str | None:
    return str(value) if value is not None and str(value) else None


def _optional_int(value: Any) -> int | None:
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None
