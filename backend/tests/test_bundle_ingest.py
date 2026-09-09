from __future__ import annotations

import io
import json
import zipfile
from typing import Any

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.bundle_ingest import ingest_parsed_bundle
from app.importers.bundle_reader import BundleReader
from app.importers.bundle_types import (
    ParsedBundle,
    ParsedProject,
    ParsedResource,
    ResourceAvailability,
    ResourceKind,
)
from app.models import Base, Conversation, ImportHistory, ImportSettings, Message, Project, Resource


def make_zip(entries: dict[str, bytes]) -> bytes:
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w") as archive:
        for path, content in entries.items():
            archive.writestr(path, content)
    return output.getvalue()


def ingest_conversations(
    db: Session,
    parsed: list[dict[str, Any]],
    import_record: ImportHistory,
    _settings: object,
) -> tuple[list[Conversation], int, int]:
    records: list[Conversation] = []
    for item in parsed:
        messages = item.pop("messages")
        conversation = Conversation(
            **item,
            import_history_id=import_record.id,
        )
        db.add(conversation)
        db.flush()
        for message in messages:
            db.add(Message(conversation_id=conversation.id, **message))
        records.append(conversation)
    db.flush()
    return records, 0, 0


def test_ingest_bundle_maps_projects_and_sniffs_active_content() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    uploaded_mime_types: list[str | None] = []

    def upload(
        import_id: int,
        sha256: str,
        filename: str | None,
        content: bytes,
        mime_type: str | None,
    ) -> dict[str, object]:
        uploaded_mime_types.append(mime_type)
        return {
            "success": True,
            "path": f"imports/{import_id}/{sha256}/{filename}",
        }

    with Session(engine) as db:
        db.add(Project(name="Research"))
        history = ImportHistory(
            filename="export.zip",
            source_type="claude",
            file_format="zip",
            status="processing",
        )
        db.add(history)
        db.flush()
        bundle = ParsedBundle(
            source="claude",
            conversations=[
                {
                    "source": "claude",
                    "source_id": "conversation-1",
                    "title": "Bundle",
                    "message_count": 1,
                    "raw_json": "{}",
                    "source_project_id": "project-1",
                    "messages": [
                        {
                            "source_id": "message-1",
                            "role": "assistant",
                            "content": "Attached",
                            "content_type": "text",
                            "order_index": 0,
                        }
                    ],
                }
            ],
            projects=[
                ParsedProject(
                    source="claude",
                    source_id="project-1",
                    name="Research",
                )
            ],
            resources=[
                ParsedResource(
                    source="claude",
                    source_id="file-1",
                    kind=ResourceKind.IMAGE,
                    availability=ResourceAvailability.STORED,
                    filename="mislabelled.png",
                    mime_type="image/png",
                    archive_entry="mislabelled.png",
                    source_project_id="project-1",
                    source_conversation_id="conversation-1",
                    source_message_id="message-1",
                )
            ],
        )
        archive = make_zip(
            {"mislabelled.png": b"<!doctype html><script>alert(1)</script>"}
        )
        with BundleReader("export.zip", archive) as reader:
            bundle.inventory = reader.inventory
            result = ingest_parsed_bundle(
                db,
                bundle,
                reader,
                history,
                None,
                ingest_conversations,
                upload,
            )
        db.commit()

        resource = db.query(Resource).one()
        project = db.query(Project).filter(Project.source_id == "project-1").one()
        assert project.name == "Research (Claude project-)"
        assert resource.project_id == project.id
        assert resource.conversation_id == result.records[0].id
        assert resource.message_id is not None
        assert resource.availability == "stored"
        assert resource.mime_type == "text/html"
        assert uploaded_mime_types == ["text/html"]
        assert history.resource_count == 1
        manifest = json.loads(history.manifest_json or "{}")
        assert manifest["inventory"][0]["path"] == "mislabelled.png"
        assert manifest["inventory"][0]["byte_size"] == 40
        assert manifest["warnings"] == []


@pytest.fixture
def db():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    engine.dispose()


def reimport_bundle(db, bundle, entries=None, uploader=None):
    """Exercise bundle merging with an ingester that returns existing rows."""
    history = ImportHistory(
        filename="export.zip", source_type=bundle.source,
        file_format="zip", status="processing",
    )
    db.add(history)
    db.flush()

    def existing_conversations(session, parsed, import_record, settings):
        records = [
            session.query(Conversation).filter_by(
                source=item["source"], source_id=item["source_id"],
            ).one()
            for item in parsed
        ]
        return records, 0, len(records)

    with BundleReader("export.zip", make_zip(entries or {})) as reader:
        result = ingest_parsed_bundle(
            db, bundle, reader, history,
            ImportSettings(auto_merge_duplicates=True, keep_separate=False),
            existing_conversations, uploader or (lambda *args: None),
        )
    db.flush()
    return result


@pytest.mark.parametrize("has_project", [False, True])
@pytest.mark.parametrize("provider_project", ["project-1", "unknown", None])
def test_merge_applies_only_resolved_provider_project(db, has_project, provider_project):
    manual_project = Project(name="Manual")
    db.add(manual_project)
    db.flush()
    original_id = manual_project.id if has_project else None
    conversation = Conversation(
        source="claude", source_id="conversation-1", raw_json="{}",
        project_id=original_id,
    )
    db.add(conversation)
    bundle = ParsedBundle(
        source="claude",
        conversations=[{
            "source": "claude", "source_id": "conversation-1",
            "source_project_id": provider_project,
        }],
        projects=[ParsedProject(source="claude", source_id="project-1", name="Provider")],
    )

    reimport_bundle(db, bundle)
    db.expire_all()

    provider = db.query(Project).filter_by(source_id="project-1").one()
    assert conversation.project_id == (provider.id if provider_project == "project-1" else original_id)


@pytest.mark.parametrize("replacement", ["omitted", "failed", "stored"])
def test_merge_preserves_stored_content_until_replacement_is_stored(db, replacement):
    history = ImportHistory(
        filename="old.zip", source_type="claude", file_format="zip", status="success",
    )
    db.add(history)
    db.flush()
    existing = Resource(
        import_history_id=history.id,
        source="claude", source_id="file-1", kind="attachment",
        availability="stored", storage_path="imports/1/resources/old/file.txt",
        byte_size=3, sha256="old-hash", mime_type="text/plain", title="Old title",
    )
    db.add(existing)
    bundle = ParsedBundle(source="claude", resources=[ParsedResource(
        source="claude", source_id="file-1", kind=ResourceKind.ATTACHMENT,
        availability=ResourceAvailability.METADATA_ONLY, title="New title",
        archive_entry="file.txt" if replacement != "omitted" else None,
        filename="file.txt", mime_type="application/octet-stream",
    )])
    new_path = "imports/2/resources/new/file.txt"
    result = reimport_bundle(
        db, bundle, {"file.txt": b"replacement"},
        (lambda *args: {"success": True, "path": new_path}) if replacement == "stored" else None,
    )
    db.expire_all()
    resource = db.query(Resource).one()
    assert resource.title == "New title"
    assert resource.availability == "stored"
    assert resource.storage_path == (new_path if replacement == "stored" else "imports/1/resources/old/file.txt")
    if replacement != "stored":
        assert (resource.byte_size, resource.sha256, resource.mime_type) == (3, "old-hash", "text/plain")
    else:
        assert resource.byte_size == 11
        assert resource.sha256 != "old-hash"
    assert result.resource_counts["stored"] == 1
    assert result.status == ("partial" if replacement == "failed" else "success")


@pytest.mark.parametrize("logical_id", ["artifact-1", None])
def test_merge_keeps_artifact_versions_distinct_and_reimport_is_idempotent(db, logical_id):
    bundle = ParsedBundle(source="claude", resources=[
        ParsedResource(
            source="claude", source_id="artifact-1", logical_id=logical_id,
            version_index=version, kind=ResourceKind.ARTIFACT,
            availability=ResourceAvailability.INLINE, text_content=f"Revision {version}",
        )
        for version in (1, 2)
    ])

    reimport_bundle(db, bundle)
    rows = db.query(Resource).order_by(Resource.version_index).all()
    assert [(row.version_index, row.text_content) for row in rows] == [(1, "Revision 1"), (2, "Revision 2")]
    original_ids = [row.id for row in rows]

    bundle.resources[1].text_content = "Updated revision 2"
    reimport_bundle(db, bundle)
    db.expire_all()
    rows = db.query(Resource).order_by(Resource.version_index).all()
    assert [row.id for row in rows] == original_ids
    assert [row.text_content for row in rows] == ["Revision 1", "Updated revision 2"]
