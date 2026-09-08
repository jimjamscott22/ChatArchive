from __future__ import annotations

import io
import json
import zipfile
from typing import Any

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
from app.models import Base, Conversation, ImportHistory, Message, Project, Resource


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
