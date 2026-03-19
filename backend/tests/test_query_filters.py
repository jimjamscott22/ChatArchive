from __future__ import annotations

import importlib
from datetime import datetime, timezone

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.models import Base, Conversation, Project, Tag


@pytest.fixture()
def db_session() -> Session:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    session_local = sessionmaker(bind=engine)
    session = session_local()
    try:
        yield session
    finally:
        session.close()


def _make_conversation(
    db_session: Session,
    *,
    title: str,
    source: str,
    tag: Tag,
    project: Project | None,
) -> Conversation:
    conversation = Conversation(
        source=source,
        source_id=f"{source}-{title}",
        title=title,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
        message_count=1,
        raw_json="{}",
        project=project,
        tags=[tag],
    )
    db_session.add(conversation)
    db_session.commit()
    return conversation


def _load_filter_helper():
    try:
        module = importlib.import_module("app.query_filters")
    except ModuleNotFoundError as exc:
        pytest.fail(f"Expected app.query_filters helper module: {exc}")

    return module.apply_conversation_filters


def test_apply_conversation_filters_combines_source_tag_and_project(db_session: Session):
    apply_conversation_filters = _load_filter_helper()

    coding = Tag(name="coding", color="#3B82F6")
    writing = Tag(name="writing", color="#EC4899")
    polish = Project(name="Archive polish", color="#8B5CF6")
    db_session.add_all([coding, writing, polish])
    db_session.commit()

    matching = _make_conversation(
        db_session,
        title="matching",
        source="chatgpt",
        tag=coding,
        project=polish,
    )
    _make_conversation(
        db_session,
        title="wrong-source",
        source="claude",
        tag=coding,
        project=polish,
    )
    _make_conversation(
        db_session,
        title="wrong-tag",
        source="chatgpt",
        tag=writing,
        project=polish,
    )

    query = apply_conversation_filters(
        db_session.query(Conversation),
        source="chatgpt",
        tag="coding",
        project_id=polish.id,
    )

    assert [conversation.id for conversation in query.all()] == [matching.id]


def test_apply_conversation_filters_supports_uncategorized_project(db_session: Session):
    apply_conversation_filters = _load_filter_helper()

    coding = Tag(name="coding", color="#3B82F6")
    polish = Project(name="Archive polish", color="#8B5CF6")
    db_session.add_all([coding, polish])
    db_session.commit()

    uncategorized = _make_conversation(
        db_session,
        title="uncategorized",
        source="chatgpt",
        tag=coding,
        project=None,
    )
    _make_conversation(
        db_session,
        title="categorized",
        source="chatgpt",
        tag=coding,
        project=polish,
    )

    query = apply_conversation_filters(
        db_session.query(Conversation),
        source="chatgpt",
        tag="coding",
        project_id=-1,
    )

    assert [conversation.id for conversation in query.all()] == [uncategorized.id]
