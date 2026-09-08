from __future__ import annotations

import io
import json
import zipfile

import pytest

from app.importers.bundle_reader import BundleReader, BundleValidationError
from app.importers.bundles import parse_export_bundle
from app.importers.bundle_types import ResourceAvailability, ResourceKind
from app.importers.claude_bundle import iter_legacy_artifacts


def make_bundle(entries: dict[str, object | bytes]) -> bytes:
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for path, value in entries.items():
            content = value if isinstance(value, bytes) else json.dumps(value).encode()
            archive.writestr(path, content)
    return output.getvalue()


def test_claude_bundle_extracts_artifact_revisions_and_project() -> None:
    artifact = {
        "type": "tool_use",
        "name": "artifacts",
        "input": {
            "id": "artifact-1",
            "title": "Calculator",
            "type": "text/javascript",
            "content": "export const value = 1;",
        },
    }
    conversations = [
        {
            "uuid": "conversation-1",
            "name": "Artifacts",
            "project_uuid": "project-1",
            "chat_messages": [
                {
                    "uuid": "message-1",
                    "sender": "assistant",
                    "content": [artifact],
                },
                {
                    "uuid": "message-2",
                    "sender": "assistant",
                    "content": [
                        {
                            **artifact,
                            "input": {
                                **artifact["input"],
                                "content": "export const value = 2;",
                            },
                        }
                    ],
                },
            ],
        }
    ]
    bundle = make_bundle(
        {
            "conversations.json": conversations,
            "projects.json": [
                {
                    "uuid": "project-1",
                    "name": "Code",
                    "instructions": "Archived only",
                }
            ],
        }
    )

    with BundleReader("claude.zip", bundle) as reader:
        parsed = parse_export_bundle("claude", reader)

    assert parsed.conversations[0]["source_project_id"] == "project-1"
    assert parsed.projects[0].name == "Code"
    assert parsed.projects[0].instructions == "Archived only"
    assert [resource.version_index for resource in parsed.resources] == [0, 1]
    assert all(resource.kind is ResourceKind.ARTIFACT for resource in parsed.resources)
    assert all(
        resource.availability is ResourceAvailability.INLINE
        for resource in parsed.resources
    )
    assert "export const value = 1;" in parsed.conversations[0]["messages"][0]["content"]


def test_claude_bundle_extracts_legacy_artifact_without_eating_markup() -> None:
    text = (
        'Before <antArtifact identifier="legacy" title="Page" type="text/html">'
        "<main><h1>Hello</h1></main></antArtifact> after"
    )
    artifacts = list(iter_legacy_artifacts(text))
    assert artifacts == [
        {
            "identifier": "legacy",
            "title": "Page",
            "type": "text/html",
            "language": None,
            "content": "<main><h1>Hello</h1></main>",
        }
    ]

    bundle = make_bundle(
        {
            "conversations.json": [
                {
                    "uuid": "conversation-1",
                    "name": "Legacy",
                    "chat_messages": [
                        {
                            "uuid": "message-1",
                            "sender": "assistant",
                            "text": text,
                        }
                    ],
                }
            ]
        }
    )
    with BundleReader("claude.zip", bundle) as reader:
        parsed = parse_export_bundle("claude", reader)
    assert parsed.resources[0].text_content == "<main><h1>Hello</h1></main>"
    assert parsed.resources[0].mime_type == "text/html"


def test_claude_bundle_preserves_attachment_text_and_binary_state() -> None:
    conversations = [
        {
            "uuid": "conversation-1",
            "name": "Files",
            "chat_messages": [
                {
                    "uuid": "message-1",
                    "sender": "human",
                    "attachments": [
                        {
                            "id": "stored",
                            "file_name": "photo.png",
                            "mime_type": "image/png",
                        },
                        {
                            "id": "text-only",
                            "file_name": "notes.pdf",
                            "mime_type": "application/pdf",
                            "extracted_content": "A searchable invoice",
                        },
                        {
                            "id": "missing",
                            "file_name": "missing.docx",
                        },
                    ],
                }
            ],
        }
    ]
    bundle = make_bundle(
        {
            "conversations.json": conversations,
            "files/photo.png": b"\x89PNG\r\n\x1a\nfake",
        }
    )

    with BundleReader("claude.zip", bundle) as reader:
        parsed = parse_export_bundle("claude", reader)

    stored, inline, missing = parsed.resources
    assert stored.availability is ResourceAvailability.STORED
    assert stored.archive_entry == "files/photo.png"
    assert inline.availability is ResourceAvailability.INLINE
    assert inline.text_content == "A searchable invoice"
    assert missing.availability is ResourceAvailability.METADATA_ONLY
    assert [warning.code for warning in parsed.warnings] == [
        "RESOURCE_BYTES_MISSING"
    ]


def test_claude_bundle_creates_placeholder_project() -> None:
    bundle = make_bundle(
        {
            "conversations.json": [
                {
                    "uuid": "conversation-1",
                    "name": "Project",
                    "project_uuid": "123456789",
                    "chat_messages": [{"sender": "human", "text": "hello"}],
                }
            ]
        }
    )
    with BundleReader("claude.zip", bundle) as reader:
        parsed = parse_export_bundle("claude", reader)
    assert parsed.projects[0].name == "Claude project 12345678"


def test_claude_bundle_rejects_empty_authoritative_data() -> None:
    bundle = make_bundle({"conversations.json": []})
    with BundleReader("claude.zip", bundle) as reader:
        with pytest.raises(BundleValidationError) as exc_info:
            parse_export_bundle("claude", reader)
    assert exc_info.value.code == "BUNDLE_CONVERSATIONS_INVALID"
