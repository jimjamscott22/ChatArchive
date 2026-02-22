"""Comprehensive tests for the preprocessing pipeline."""

from __future__ import annotations

import json
from datetime import datetime

import pytest

from app.preprocessing.cleaner import (
    clean_conversation,
    clean_text,
    generate_preview,
    normalize_unicode,
    normalize_whitespace,
)
from app.preprocessing.classifier import (
    classify_conversation,
    extract_entities,
)
from app.preprocessing.deduplication import (
    compute_content_hash,
    deduplicate_conversations,
    mark_content_hash,
)
from app.preprocessing.extractor import (
    extract_artifacts,
    extract_code_blocks,
    extract_conversation_content,
    extract_tables,
)
from app.preprocessing.models import (
    EntityExtraction,
    ImportResult,
    ProcessedConversation,
    ProcessedMessage,
    TokenMetrics,
)
from app.preprocessing.parser import (
    parse_claude_export_to_conversations,
    parse_single_conversation,
    parse_timestamp,
)
from app.preprocessing.pipeline import (
    PipelineConfig,
    PreprocessingPipeline,
    process_export,
)
from app.preprocessing.token_counter import count_conversation_tokens, count_tokens


# ============================================================================
# Fixtures / helpers
# ============================================================================

def _make_export_payload(conversations=None):
    """Build a minimal Claude export payload."""
    if conversations is None:
        conversations = [_make_raw_conversation()]
    return conversations


def _make_raw_conversation(
    uuid="conv-001",
    name="Test Conversation",
    messages=None,
    model="claude-3",
):
    if messages is None:
        messages = [
            {
                "uuid": "msg-001",
                "sender": "human",
                "text": "Hello, can you help me with Python?",
                "created_at": "2024-06-01T10:00:00Z",
            },
            {
                "uuid": "msg-002",
                "sender": "assistant",
                "text": "Of course! I'd be happy to help you with Python. What do you need?",
                "created_at": "2024-06-01T10:00:05Z",
            },
        ]
    return {
        "uuid": uuid,
        "name": name,
        "created_at": "2024-06-01T10:00:00Z",
        "updated_at": "2024-06-01T10:30:00Z",
        "chat_messages": messages,
        "model": model,
    }


def _make_code_conversation():
    """Build a conversation with code blocks and tables."""
    return _make_raw_conversation(
        uuid="conv-code",
        name="Python sorting help",
        messages=[
            {
                "uuid": "msg-c1",
                "sender": "human",
                "text": "How do I sort a list in Python?",
                "created_at": "2024-06-01T10:00:00Z",
            },
            {
                "uuid": "msg-c2",
                "sender": "assistant",
                "text": (
                    "Here's how to sort a list:\n\n"
                    "```python\n"
                    "numbers = [3, 1, 4, 1, 5]\n"
                    "sorted_numbers = sorted(numbers)\n"
                    "print(sorted_numbers)\n"
                    "```\n\n"
                    "You can also sort in-place:\n\n"
                    "```python\n"
                    "numbers.sort()\n"
                    "```\n\n"
                    "Here's a comparison:\n\n"
                    "| Method | In-place | Returns |\n"
                    "|--------|----------|----------|\n"
                    "| sort() | Yes | None |\n"
                    "| sorted() | No | New list |\n"
                ),
                "created_at": "2024-06-01T10:00:10Z",
            },
        ],
    )


def _make_artifact_conversation():
    """Build a conversation with artifacts."""
    return _make_raw_conversation(
        uuid="conv-artifact",
        name="Build a calculator",
        messages=[
            {
                "uuid": "msg-a1",
                "sender": "human",
                "text": "Build me a simple calculator in React.",
                "created_at": "2024-06-01T11:00:00Z",
            },
            {
                "uuid": "msg-a2",
                "sender": "assistant",
                "text": (
                    'Here is a calculator component:\n\n'
                    '<antArtifact identifier="calc-v1" type="application/vnd.ant.react" '
                    'title="Simple Calculator">\n'
                    'function Calculator() {\n'
                    '  return <div>Calculator</div>;\n'
                    '}\n'
                    '</antArtifact>'
                ),
                "created_at": "2024-06-01T11:00:30Z",
            },
        ],
    )


# ============================================================================
# Parser tests
# ============================================================================

class TestParser:
    def test_parse_timestamp_iso(self):
        result = parse_timestamp("2024-06-01T10:00:00Z")
        assert isinstance(result, datetime)
        assert result.year == 2024
        assert result.month == 6

    def test_parse_timestamp_unix(self):
        result = parse_timestamp(1717232400)
        assert isinstance(result, datetime)

    def test_parse_timestamp_none(self):
        assert parse_timestamp(None) is None

    def test_parse_timestamp_invalid(self):
        assert parse_timestamp("not-a-date") is None

    def test_parse_single_conversation(self):
        raw = _make_raw_conversation()
        conv = parse_single_conversation(raw)

        assert conv.source == "claude"
        assert conv.source_id == "conv-001"
        assert conv.title == "Test Conversation"
        assert conv.message_count == 2
        assert len(conv.messages) == 2
        assert conv.messages[0].role == "user"
        assert conv.messages[1].role == "assistant"

    def test_parse_conversation_skips_empty_messages(self):
        raw = _make_raw_conversation(messages=[
            {"uuid": "m1", "sender": "human", "text": "Hello", "created_at": "2024-01-01T00:00:00Z"},
            {"uuid": "m2", "sender": "assistant", "text": "  ", "created_at": "2024-01-01T00:00:01Z"},
            {"uuid": "m3", "sender": "human", "text": "World", "created_at": "2024-01-01T00:00:02Z"},
        ])
        conv = parse_single_conversation(raw)
        assert conv.message_count == 2

    def test_parse_conversation_duration(self):
        raw = _make_raw_conversation()
        conv = parse_single_conversation(raw)
        assert conv.duration_seconds == 5.0

    def test_parse_export_list_format(self):
        payload = [_make_raw_conversation()]
        result = parse_claude_export_to_conversations(payload)
        assert len(result) == 1
        assert result[0].source_id == "conv-001"

    def test_parse_export_single_object(self):
        payload = _make_raw_conversation()
        result = parse_claude_export_to_conversations(payload)
        assert len(result) == 1

    def test_parse_export_wrapped_format(self):
        payload = {"conversations": [_make_raw_conversation()]}
        result = parse_claude_export_to_conversations(payload)
        assert len(result) == 1

    def test_parse_export_data_key(self):
        payload = {"data": [_make_raw_conversation()]}
        result = parse_claude_export_to_conversations(payload)
        assert len(result) == 1

    def test_parse_export_invalid_format(self):
        with pytest.raises(ValueError, match="Unrecognized"):
            parse_claude_export_to_conversations({"foo": "bar"})

    def test_parse_export_multiple_conversations(self):
        payload = [
            _make_raw_conversation(uuid="c1", name="First"),
            _make_raw_conversation(uuid="c2", name="Second"),
        ]
        result = parse_claude_export_to_conversations(payload)
        assert len(result) == 2
        assert result[0].title == "First"
        assert result[1].title == "Second"

    def test_parse_preserves_raw_json(self):
        raw = _make_raw_conversation()
        conv = parse_single_conversation(raw)
        parsed_back = json.loads(conv.raw_json)
        assert parsed_back["uuid"] == "conv-001"

    def test_parse_sender_mapping(self):
        raw = _make_raw_conversation(messages=[
            {"uuid": "m1", "sender": "human", "text": "Hi", "created_at": "2024-01-01T00:00:00Z"},
            {"uuid": "m2", "sender": "assistant", "text": "Hello", "created_at": "2024-01-01T00:00:01Z"},
            {"uuid": "m3", "sender": "unknown", "text": "?", "created_at": "2024-01-01T00:00:02Z"},
        ])
        conv = parse_single_conversation(raw)
        assert conv.messages[0].role == "user"
        assert conv.messages[1].role == "assistant"
        assert conv.messages[2].role == "assistant"  # unknown defaults to assistant


# ============================================================================
# Extractor tests
# ============================================================================

class TestExtractor:
    def test_extract_code_blocks_with_language(self):
        text = "Some text\n\n```python\nprint('hello')\n```\n\nMore text"
        blocks = extract_code_blocks(text)
        assert len(blocks) == 1
        assert blocks[0].language == "python"
        assert "print('hello')" in blocks[0].code

    def test_extract_code_blocks_no_language(self):
        text = "```\nsome code\n```"
        blocks = extract_code_blocks(text)
        assert len(blocks) == 1
        assert blocks[0].language is None

    def test_extract_multiple_code_blocks(self):
        text = "```python\na = 1\n```\ntext\n```javascript\nlet b = 2;\n```"
        blocks = extract_code_blocks(text)
        assert len(blocks) == 2
        assert blocks[0].language == "python"
        assert blocks[1].language == "javascript"

    def test_extract_no_code_blocks(self):
        text = "Just plain text with no code."
        blocks = extract_code_blocks(text)
        assert len(blocks) == 0

    def test_extract_tables(self):
        text = (
            "| Name | Age |\n"
            "|------|-----|\n"
            "| Alice | 30 |\n"
            "| Bob | 25 |\n"
        )
        tables = extract_tables(text)
        assert len(tables) == 1
        assert tables[0].headers == ["Name", "Age"]
        assert len(tables[0].rows) == 2
        assert tables[0].rows[0] == ["Alice", "30"]

    def test_extract_no_tables(self):
        text = "Just text, no tables here."
        tables = extract_tables(text)
        assert len(tables) == 0

    def test_extract_artifacts(self):
        text = (
            '<antArtifact identifier="test-1" type="text/html" title="My Page">'
            "<h1>Hello</h1>"
            "</antArtifact>"
        )
        artifacts = extract_artifacts(text)
        assert len(artifacts) == 1
        assert artifacts[0].identifier == "test-1"
        assert artifacts[0].artifact_type == "text/html"
        assert artifacts[0].title == "My Page"
        assert "<h1>Hello</h1>" in artifacts[0].content

    def test_extract_no_artifacts(self):
        text = "No artifacts here."
        artifacts = extract_artifacts(text)
        assert len(artifacts) == 0

    def test_extract_conversation_content(self):
        raw = _make_code_conversation()
        conv = parse_single_conversation(raw)
        extract_conversation_content(conv)

        assert len(conv.code_blocks) == 2
        assert conv.code_blocks[0].language == "python"

    def test_extract_conversation_artifacts(self):
        raw = _make_artifact_conversation()
        conv = parse_single_conversation(raw)
        extract_conversation_content(conv)

        assert len(conv.artifacts) == 1
        assert conv.artifacts[0].identifier == "calc-v1"
        assert conv.artifacts[0].title == "Simple Calculator"


# ============================================================================
# Cleaner tests
# ============================================================================

class TestCleaner:
    def test_normalize_unicode(self):
        # Replacement character should be removed
        text = "Hello\ufffdWorld"
        assert normalize_unicode(text) == "HelloWorld"

    def test_normalize_whitespace_collapses_excessive_newlines(self):
        text = "Hello\n\n\n\n\n\nWorld"
        result = normalize_whitespace(text)
        assert result == "Hello\n\n\nWorld"

    def test_normalize_whitespace_preserves_double_newlines(self):
        text = "Paragraph one.\n\nParagraph two."
        result = normalize_whitespace(text)
        assert result == text

    def test_normalize_whitespace_strips_trailing(self):
        text = "Hello   \nWorld  "
        result = normalize_whitespace(text)
        assert result == "Hello\nWorld"

    def test_clean_text_combined(self):
        text = "Hello\ufffd   \n\n\n\n\n\nWorld  "
        result = clean_text(text)
        assert "\ufffd" not in result
        assert result == "Hello\n\n\nWorld"

    def test_generate_preview_short_text(self):
        text = "Short text."
        assert generate_preview(text) == "Short text."

    def test_generate_preview_long_text(self):
        text = "word " * 100
        preview = generate_preview(text, max_length=50)
        assert len(preview) <= 55  # Allow for "..."
        assert preview.endswith("...")

    def test_clean_conversation_generates_preview(self):
        raw = _make_raw_conversation()
        conv = parse_single_conversation(raw)
        clean_conversation(conv)

        assert conv.preview is not None
        assert "Python" in conv.preview

    def test_clean_conversation_cleans_title(self):
        raw = _make_raw_conversation(name="  Messy Title  ")
        conv = parse_single_conversation(raw)
        clean_conversation(conv)
        assert conv.title == "Messy Title"


# ============================================================================
# Classifier tests
# ============================================================================

class TestClassifier:
    def test_classify_coding_conversation(self):
        raw = _make_raw_conversation(
            name="Python sorting",
            messages=[
                {"uuid": "m1", "sender": "human", "text": "How do I sort a list in Python using the sorted function?", "created_at": "2024-01-01T00:00:00Z"},
                {"uuid": "m2", "sender": "assistant", "text": "You can use sorted() like this...", "created_at": "2024-01-01T00:00:01Z"},
            ],
        )
        conv = parse_single_conversation(raw)
        classify_conversation(conv)

        assert "coding" in conv.tags

    def test_classify_education_conversation(self):
        raw = _make_raw_conversation(
            name="Homework help",
            messages=[
                {"uuid": "m1", "sender": "human", "text": "Help me with my university assignment on research methods.", "created_at": "2024-01-01T00:00:00Z"},
                {"uuid": "m2", "sender": "assistant", "text": "I'd be happy to help with your assignment.", "created_at": "2024-01-01T00:00:01Z"},
            ],
        )
        conv = parse_single_conversation(raw)
        classify_conversation(conv)

        assert "education" in conv.tags

    def test_extract_entities_programming_languages(self):
        conv = ProcessedConversation(
            title="Python and JavaScript",
            messages=[
                ProcessedMessage(role="user", content="I need help with Python and React."),
                ProcessedMessage(role="assistant", content="Sure, let me help with Python and React."),
            ],
        )
        entities = extract_entities(conv)

        assert "python" in entities.programming_languages
        assert "react" in entities.frameworks

    def test_extract_entities_from_code(self):
        conv = ProcessedConversation(
            title="FastAPI app",
            messages=[
                ProcessedMessage(
                    role="user",
                    content="I'm building a FastAPI app with SQLAlchemy and deploying to AWS.",
                ),
            ],
        )
        entities = extract_entities(conv)

        assert "fastapi" in entities.frameworks
        assert "sqlalchemy" in entities.libraries
        assert "aws" in entities.technologies


# ============================================================================
# Token counter tests
# ============================================================================

class TestTokenCounter:
    def test_count_tokens_nonempty(self):
        tokens = count_tokens("Hello world, this is a test.")
        assert tokens > 0

    def test_count_tokens_empty(self):
        tokens = count_tokens("")
        # Even empty should return at least 0-1 depending on method
        assert tokens >= 0

    def test_count_conversation_tokens(self):
        raw = _make_raw_conversation()
        conv = parse_single_conversation(raw)
        count_conversation_tokens(conv)

        assert conv.token_metrics.total_tokens > 0
        assert conv.token_metrics.user_tokens > 0
        assert conv.token_metrics.assistant_tokens > 0
        assert conv.token_metrics.avg_tokens_per_message > 0

    def test_per_message_token_count(self):
        raw = _make_raw_conversation()
        conv = parse_single_conversation(raw)
        count_conversation_tokens(conv)

        for msg in conv.messages:
            assert msg.token_count > 0


# ============================================================================
# Deduplication tests
# ============================================================================

class TestDeduplication:
    def test_compute_content_hash_deterministic(self):
        raw = _make_raw_conversation()
        conv = parse_single_conversation(raw)
        h1 = compute_content_hash(conv)
        h2 = compute_content_hash(conv)
        assert h1 == h2

    def test_different_content_different_hash(self):
        c1 = parse_single_conversation(_make_raw_conversation(uuid="c1", name="First"))
        c2 = parse_single_conversation(_make_raw_conversation(uuid="c2", name="Second"))
        assert compute_content_hash(c1) != compute_content_hash(c2)

    def test_mark_content_hash(self):
        conv = parse_single_conversation(_make_raw_conversation())
        assert conv.content_hash is None
        mark_content_hash(conv)
        assert conv.content_hash is not None
        assert len(conv.content_hash) == 64  # SHA-256 hex

    def test_deduplicate_within_batch(self):
        # Two identical conversations in the same batch
        raw = _make_raw_conversation()
        c1 = parse_single_conversation(raw)
        c2 = parse_single_conversation(raw)
        mark_content_hash(c1)
        mark_content_hash(c2)

        unique, dupes = deduplicate_conversations([c1, c2])
        assert len(unique) == 1
        assert len(dupes) == 1

    def test_deduplicate_against_existing_source_ids(self):
        conv = parse_single_conversation(_make_raw_conversation())
        mark_content_hash(conv)

        unique, dupes = deduplicate_conversations(
            [conv], existing_source_ids={"conv-001"}
        )
        assert len(unique) == 0
        assert len(dupes) == 1

    def test_deduplicate_against_existing_hashes(self):
        conv = parse_single_conversation(_make_raw_conversation())
        mark_content_hash(conv)

        unique, dupes = deduplicate_conversations(
            [conv], existing_hashes={conv.content_hash}
        )
        assert len(unique) == 0
        assert len(dupes) == 1

    def test_deduplicate_no_duplicates(self):
        c1 = parse_single_conversation(_make_raw_conversation(uuid="c1", name="A"))
        c2 = parse_single_conversation(_make_raw_conversation(uuid="c2", name="B"))

        unique, dupes = deduplicate_conversations([c1, c2])
        assert len(unique) == 2
        assert len(dupes) == 0


# ============================================================================
# Pipeline integration tests
# ============================================================================

class TestPipeline:
    def test_process_export_basic(self):
        payload = _make_export_payload()
        result = process_export(payload)

        assert isinstance(result, ImportResult)
        assert result.total_conversations == 1
        assert result.processed_conversations == 1
        assert result.failed_conversations == 0
        assert len(result.conversations) == 1

    def test_process_export_all_fields_populated(self):
        payload = _make_export_payload([_make_code_conversation()])
        result = process_export(payload)

        conv = result.conversations[0]
        assert conv.source == "claude"
        assert conv.title is not None
        assert conv.messages
        assert conv.preview is not None
        assert conv.content_hash is not None
        assert conv.token_metrics.total_tokens > 0
        assert len(conv.code_blocks) > 0

    def test_process_export_with_artifacts(self):
        payload = _make_export_payload([_make_artifact_conversation()])
        result = process_export(payload)

        conv = result.conversations[0]
        assert len(conv.artifacts) == 1

    def test_process_export_deduplication(self):
        raw = _make_raw_conversation()
        payload = [raw, raw]  # Duplicate
        result = process_export(payload)

        assert result.total_conversations == 2
        assert result.processed_conversations == 1
        assert result.skipped_duplicates == 1

    def test_process_export_with_existing_ids(self):
        payload = _make_export_payload()
        config = PipelineConfig(existing_source_ids={"conv-001"})
        result = process_export(payload, config=config)

        assert result.processed_conversations == 0
        assert result.skipped_duplicates == 1

    def test_process_export_disable_steps(self):
        payload = _make_export_payload()
        config = PipelineConfig(
            enable_cleaning=False,
            enable_extraction=False,
            enable_classification=False,
            enable_token_counting=False,
            enable_deduplication=False,
        )
        result = process_export(payload, config=config)

        conv = result.conversations[0]
        assert conv.token_metrics.total_tokens == 0
        assert conv.tags == []

    def test_process_export_invalid_payload(self):
        result = process_export({"invalid": "data"})
        assert result.total_conversations == 0
        assert len(result.errors) == 1
        assert "Parsing failed" in result.errors[0]

    def test_process_export_multiple_conversations(self):
        payload = [
            _make_raw_conversation(uuid="c1", name="Conv 1"),
            _make_raw_conversation(uuid="c2", name="Conv 2"),
            _make_raw_conversation(uuid="c3", name="Conv 3"),
        ]
        result = process_export(payload)

        assert result.total_conversations == 3
        assert result.processed_conversations == 3

    def test_progress_callback(self):
        stages = []

        def on_progress(p):
            stages.append(p.stage)

        payload = _make_export_payload()
        process_export(payload, progress_callback=on_progress)

        assert "parsing" in stages
        assert "processing" in stages
        assert "deduplication" in stages
        assert "complete" in stages

    def test_to_db_dict(self):
        payload = _make_export_payload()
        result = process_export(payload)
        conv = result.conversations[0]
        db_dict = conv.to_db_dict()

        assert db_dict["source"] == "claude"
        assert db_dict["source_id"] == "conv-001"
        assert "messages" in db_dict
        assert len(db_dict["messages"]) == 2
        assert db_dict["messages"][0]["role"] == "user"


class TestPreprocessingPipeline:
    def test_pipeline_run(self):
        pipeline = PreprocessingPipeline()
        result = pipeline.run(_make_export_payload())

        assert result.processed_conversations == 1
        assert pipeline.progress is not None
        assert pipeline.progress.stage == "complete"

    def test_pipeline_dry_run(self):
        pipeline = PreprocessingPipeline()
        result = pipeline.dry_run(_make_export_payload())

        assert result.processed_conversations == 1
        # Config should be restored
        assert pipeline.config.dry_run is False

    def test_pipeline_with_config(self):
        config = PipelineConfig(enable_token_counting=False)
        pipeline = PreprocessingPipeline(config=config)
        result = pipeline.run(_make_export_payload())

        conv = result.conversations[0]
        assert conv.token_metrics.total_tokens == 0


# ============================================================================
# Edge case tests
# ============================================================================

class TestEdgeCases:
    def test_empty_conversation(self):
        raw = _make_raw_conversation(messages=[])
        conv = parse_single_conversation(raw)
        assert conv.message_count == 0
        assert conv.duration_seconds is None

    def test_very_long_message(self):
        long_text = "x " * 50000
        raw = _make_raw_conversation(messages=[
            {"uuid": "m1", "sender": "human", "text": long_text, "created_at": "2024-01-01T00:00:00Z"},
        ])
        payload = [raw]
        result = process_export(payload)

        conv = result.conversations[0]
        assert conv.preview is not None
        assert len(conv.preview) <= 310  # 300 + "..."
        assert conv.token_metrics.total_tokens > 0

    def test_conversation_with_only_code(self):
        raw = _make_raw_conversation(messages=[
            {
                "uuid": "m1",
                "sender": "human",
                "text": "```python\nprint('hello')\n```",
                "created_at": "2024-01-01T00:00:00Z",
            },
        ])
        payload = [raw]
        result = process_export(payload)

        conv = result.conversations[0]
        assert len(conv.code_blocks) == 1

    def test_conversation_with_mixed_content(self):
        raw = _make_code_conversation()
        payload = [raw]
        result = process_export(payload)

        conv = result.conversations[0]
        assert len(conv.code_blocks) > 0
        assert conv.tags  # Should be classified

    def test_conversation_no_title(self):
        raw = _make_raw_conversation(name=None)
        conv = parse_single_conversation(raw)
        assert conv.title is None

    def test_missing_timestamps(self):
        raw = _make_raw_conversation(messages=[
            {"uuid": "m1", "sender": "human", "text": "No time", "created_at": None},
        ])
        raw["created_at"] = None
        raw["updated_at"] = None
        conv = parse_single_conversation(raw)
        assert conv.created_at is None
        assert conv.messages[0].created_at is None

    def test_batch_processing(self):
        """Test processing a large batch of conversations."""
        payload = [
            _make_raw_conversation(uuid=f"conv-{i}", name=f"Conv {i}")
            for i in range(50)
        ]
        result = process_export(payload)

        assert result.total_conversations == 50
        assert result.processed_conversations == 50
        assert result.failed_conversations == 0
