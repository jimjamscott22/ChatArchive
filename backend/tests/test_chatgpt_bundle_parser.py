from __future__ import annotations

import io
import json
import zipfile

import pytest

from app.importers.bundle_reader import BundleReader, BundleValidationError
from app.importers.bundles import parse_export_bundle
from app.importers.bundle_types import ResourceAvailability, ResourceKind


def make_bundle(entries: dict[str, object | bytes]) -> bytes:
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for path, value in entries.items():
            content = value if isinstance(value, bytes) else json.dumps(value).encode()
            archive.writestr(path, content)
    return output.getvalue()


def conversation(
    conversation_id: str,
    *,
    project_id: str | None = None,
    asset: dict[str, object] | None = None,
) -> dict[str, object]:
    parts: list[object] = ["hello"]
    content_type = "text"
    if asset:
        parts = [asset]
        content_type = "multimodal_text"
    value: dict[str, object] = {
        "id": conversation_id,
        "title": conversation_id,
        "mapping": {
            "root": {"parent": None, "children": ["message"], "message": None},
            "message": {
                "parent": "root",
                "children": [],
                "message": {
                    "id": f"{conversation_id}-message",
                    "author": {"role": "user"},
                    "content": {"content_type": content_type, "parts": parts},
                    "metadata": {},
                },
            },
        },
    }
    if project_id:
        value["project_id"] = project_id
    return value


def test_chatgpt_bundle_combines_numbered_files_and_projects() -> None:
    bundle = make_bundle(
        {
            "conversations.json": [conversation("one", project_id="project-1")],
            "conversations-2.json": [conversation("two", project_id="project-2")],
            "projects.json": [
                {
                    "id": "project-1",
                    "name": "Research",
                    "description": "Provider project",
                    "instructions": "Treat as inert text",
                }
            ],
        }
    )

    with BundleReader("chatgpt.zip", bundle) as reader:
        parsed = parse_export_bundle("chatgpt", reader)

    assert [item["source_id"] for item in parsed.conversations] == ["one", "two"]
    assert parsed.conversations[0]["source_project_id"] == "project-1"
    assert [(project.source_id, project.name) for project in parsed.projects] == [
        ("project-1", "Research"),
        ("project-2", "ChatGPT project project-"),
    ]
    assert parsed.projects[0].instructions == "Treat as inert text"


def test_chatgpt_bundle_resolves_asset_and_reports_missing_asset() -> None:
    bundle = make_bundle(
        {
            "conversations.json": [
                conversation(
                    "stored",
                    asset={
                        "asset_pointer": "images/chart.png",
                        "mime_type": "image/png",
                    },
                ),
                conversation(
                    "missing",
                    asset={
                        "file_id": "file-404",
                        "file_name": "missing.pdf",
                        "mime_type": "application/pdf",
                    },
                ),
            ],
            "images/chart.png": b"\x89PNG\r\n\x1a\nfake",
        }
    )

    with BundleReader("chatgpt.zip", bundle) as reader:
        parsed = parse_export_bundle("chatgpt", reader)

    stored, missing = parsed.resources
    assert stored.kind is ResourceKind.IMAGE
    assert stored.availability is ResourceAvailability.STORED
    assert stored.archive_entry == "images/chart.png"
    assert missing.availability is ResourceAvailability.METADATA_ONLY
    assert missing.filename == "missing.pdf"
    assert "RESOURCE_BYTES_MISSING" in [warning.code for warning in parsed.warnings]
    assert parsed.conversations[0]["messages"][0]["content"] == "[image]"


def test_chatgpt_bundle_reports_ambiguous_and_unsupported_entries() -> None:
    bundle = make_bundle(
        {
            "conversations.json": [
                conversation("one", asset={"file_name": "same.png"})
            ],
            "one/same.png": b"one",
            "two/same.png": b"two",
            "user.json": {},
        }
    )
    with BundleReader("chatgpt.zip", bundle) as reader:
        parsed = parse_export_bundle("chatgpt", reader)
    codes = [warning.code for warning in parsed.warnings]
    assert "AMBIGUOUS_ASSET_REFERENCE" in codes
    assert "RESOURCE_BYTES_MISSING" in codes
    assert "UNSUPPORTED_COMPANION_FILE" in codes


def test_chatgpt_bundle_requires_authoritative_conversations() -> None:
    with BundleReader("chatgpt.zip", make_bundle({"user.json": {}})) as reader:
        with pytest.raises(BundleValidationError) as exc_info:
            parse_export_bundle("chatgpt", reader)
    assert exc_info.value.code == "BUNDLE_CONVERSATIONS_MISSING"
