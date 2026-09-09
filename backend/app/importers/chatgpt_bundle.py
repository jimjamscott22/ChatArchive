from __future__ import annotations

import re
from pathlib import PurePosixPath
from typing import Any, Iterable

from app.importers.bundle_reader import BundleReader, BundleValidationError
from app.importers.bundle_types import (
    ImportWarning,
    ParsedBundle,
    ParsedProject,
    ParsedResource,
    ResourceAvailability,
    ResourceKind,
)
from app.importers.chatgpt import parse_chatgpt_export


_CONVERSATION_FILE_RE = re.compile(
    r"^conversations(?:[-_]?\d+)?\.json$",
    re.IGNORECASE,
)
_ASSET_KEYS = (
    "asset_pointer",
    "image_asset_pointer",
    "file_id",
    "file_name",
    "filename",
    "name",
)


def parse_chatgpt_bundle(reader: BundleReader) -> ParsedBundle:
    conversation_paths = sorted(
        (
            path
            for path in reader.paths
            if _CONVERSATION_FILE_RE.fullmatch(PurePosixPath(path).name)
        ),
        key=_conversation_file_sort_key,
    )
    if not conversation_paths:
        raise BundleValidationError(
            "BUNDLE_CONVERSATIONS_MISSING",
            "ChatGPT bundle does not contain conversations.json",
        )

    raw_conversations: list[dict[str, Any]] = []
    for path in conversation_paths:
        payload = reader.read_json(path)
        values = payload.get("conversations") if isinstance(payload, dict) else payload
        if not isinstance(values, list):
            raise BundleValidationError(
                "BUNDLE_CONVERSATIONS_INVALID",
                f"ChatGPT conversation entry is not an array: {path}",
            )
        raw_conversations.extend(item for item in values if isinstance(item, dict))

    conversations = parse_chatgpt_export(raw_conversations)
    raw_by_id = {
        str(item.get("id") or item.get("conversation_id")): item
        for item in raw_conversations
        if item.get("id") or item.get("conversation_id")
    }
    for conversation in conversations:
        raw = raw_by_id.get(str(conversation.get("source_id")))
        if raw and raw.get("project_id") is not None:
            conversation["source_project_id"] = str(raw["project_id"])

    projects = _parse_projects(reader)
    referenced_project_ids = {
        str(item["project_id"])
        for item in raw_conversations
        if item.get("project_id") is not None
    }
    known_project_ids = {project.source_id for project in projects}
    for project_id in sorted(referenced_project_ids - known_project_ids):
        projects.append(
            ParsedProject(
                source="chatgpt",
                source_id=project_id,
                name=f"ChatGPT project {project_id[:8]}",
            )
        )

    warnings = list(reader.warnings)
    resources = _extract_resources(raw_conversations, reader, warnings)
    _warn_unsupported_json(reader, conversation_paths, warnings)
    return ParsedBundle(
        source="chatgpt",
        conversations=conversations,
        projects=projects,
        resources=resources,
        inventory=reader.inventory,
        warnings=warnings,
    )


def _conversation_file_sort_key(path: str) -> tuple[int, str]:
    name = PurePosixPath(path).name.casefold()
    return (0 if name == "conversations.json" else 1, path.casefold())


def _parse_projects(reader: BundleReader) -> list[ParsedProject]:
    paths = reader.find_basename("projects.json")
    if not paths:
        return []
    if len(paths) > 1:
        return []
    payload = reader.read_json(paths[0])
    values = payload.get("projects") if isinstance(payload, dict) else payload
    if not isinstance(values, list):
        return []

    projects: list[ParsedProject] = []
    for item in values:
        if not isinstance(item, dict):
            continue
        project_id = item.get("id") or item.get("uuid") or item.get("project_id")
        if project_id is None:
            continue
        project_id = str(project_id)
        projects.append(
            ParsedProject(
                source="chatgpt",
                source_id=project_id,
                name=str(item.get("name") or item.get("title") or f"ChatGPT project {project_id[:8]}"),
                description=_optional_string(item.get("description")),
                instructions=_optional_string(item.get("instructions")),
                created_at=item.get("created_at") or item.get("create_time"),
                updated_at=item.get("updated_at") or item.get("update_time"),
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
    seen: set[tuple[str, str, str]] = set()

    for conversation in conversations:
        conversation_id = str(
            conversation.get("id") or conversation.get("conversation_id") or ""
        )
        project_id = _optional_string(conversation.get("project_id"))
        mapping = conversation.get("mapping")
        if not isinstance(mapping, dict):
            continue
        for node in mapping.values():
            if not isinstance(node, dict):
                continue
            message = node.get("message")
            if not isinstance(message, dict):
                continue
            message_id = str(message.get("id") or "")
            for candidate in _message_asset_candidates(message):
                source_id = candidate["source_id"]
                dedupe_key = (conversation_id, message_id, source_id)
                if dedupe_key in seen:
                    continue
                seen.add(dedupe_key)
                matched_path, ambiguous = _match_asset_entry(reader, candidate)
                if ambiguous:
                    warnings.append(
                        ImportWarning(
                            code="AMBIGUOUS_ASSET_REFERENCE",
                            message="Multiple archive entries match an asset reference.",
                            context={"reference": source_id},
                        )
                    )
                if matched_path:
                    entry = inventory_by_path[matched_path]
                    availability = ResourceAvailability.STORED
                    filename = PurePosixPath(matched_path).name
                    byte_size = entry.byte_size
                else:
                    availability = ResourceAvailability.METADATA_ONLY
                    filename = candidate.get("filename")
                    byte_size = _optional_int(candidate.get("byte_size"))
                    warnings.append(
                        ImportWarning(
                            code="RESOURCE_BYTES_MISSING",
                            message="The export references a resource but does not contain its bytes.",
                            context={"reference": source_id},
                        )
                    )
                resources.append(
                    ParsedResource(
                        source="chatgpt",
                        source_id=source_id,
                        kind=_resource_kind(candidate.get("mime_type")),
                        availability=availability,
                        title=candidate.get("title") or filename,
                        filename=filename,
                        mime_type=candidate.get("mime_type"),
                        byte_size=byte_size,
                        archive_entry=matched_path,
                        source_project_id=project_id,
                        source_conversation_id=conversation_id or None,
                        source_message_id=message_id or None,
                        raw_metadata=candidate["raw_metadata"],
                    )
                )
    return resources


def _message_asset_candidates(message: dict[str, Any]) -> Iterable[dict[str, Any]]:
    containers: list[Any] = []
    content = message.get("content")
    if isinstance(content, dict):
        containers.extend(content.get("parts") or [])
    metadata = message.get("metadata")
    if isinstance(metadata, dict):
        for key in ("attachments", "files", "assets"):
            value = metadata.get(key)
            if isinstance(value, list):
                containers.extend(value)

    for item in containers:
        if not isinstance(item, dict):
            continue
        source_value = next((item.get(key) for key in _ASSET_KEYS if item.get(key)), None)
        if source_value is None:
            continue
        filename = item.get("file_name") or item.get("filename") or item.get("name")
        yield {
            "source_id": str(source_value),
            "filename": _optional_string(filename),
            "title": _optional_string(item.get("title")),
            "mime_type": _optional_string(
                item.get("mime_type") or item.get("content_type")
            ),
            "byte_size": item.get("size") or item.get("byte_size"),
            "raw_metadata": item,
        }


def _match_asset_entry(
    reader: BundleReader,
    candidate: dict[str, Any],
) -> tuple[str | None, bool]:
    for value in (candidate.get("filename"), candidate.get("source_id")):
        if not value:
            continue
        try:
            exact = reader.find_path(str(value))
        except BundleValidationError:
            exact = None
        if exact:
            return exact, False
        matches = reader.find_basename(str(value))
        if len(matches) == 1:
            return matches[0], False
        if len(matches) > 1:
            return None, True
    return None, False


def _warn_unsupported_json(
    reader: BundleReader,
    authoritative_paths: list[str],
    warnings: list[ImportWarning],
) -> None:
    supported = {path.casefold() for path in authoritative_paths}
    supported.update(path.casefold() for path in reader.find_basename("projects.json"))
    for path in reader.paths:
        if path.casefold().endswith(".json") and path.casefold() not in supported:
            warnings.append(
                ImportWarning(
                    code="UNSUPPORTED_COMPANION_FILE",
                    message="Companion JSON is inventoried but is not imported.",
                    entry=path,
                )
            )


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
