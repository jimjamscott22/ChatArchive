"""Unit tests for Copilot parser."""
from __future__ import annotations

from datetime import datetime
from app.importers.copilot import (
    parse_copilot_export,
    determine_role,
    extract_content,
    detect_content_type,
    parse_timestamp,
    generate_title_from_messages,
)


def test_parse_copilot_export_list_format():
    """Test parsing Copilot export as a list."""
    payload = [
        {
            "id": "copilot-123",
            "title": "VS Code Chat",
            "createdAt": "2024-01-01T12:00:00Z",
            "updatedAt": "2024-01-02T12:00:00Z",
            "messages": [
                {
                    "id": "msg1",
                    "role": "user",
                    "content": "How do I write a for loop in Python?",
                    "timestamp": "2024-01-01T12:00:00Z"
                },
                {
                    "id": "msg2",
                    "role": "assistant",
                    "content": "Here's how to write a for loop:\n```python\nfor i in range(10):\n    print(i)\n```",
                    "timestamp": "2024-01-01T12:00:05Z",
                    "model": "copilot"
                }
            ]
        }
    ]
    
    result = parse_copilot_export(payload)
    
    assert len(result) == 1
    conv = result[0]
    assert conv["source"] == "copilot"
    assert conv["source_id"] == "copilot-123"
    assert conv["title"] == "VS Code Chat"
    assert conv["message_count"] == 2
    assert len(conv["messages"]) == 2
    
    # Verify messages
    msg1 = conv["messages"][0]
    assert msg1["role"] == "user"
    assert msg1["content"] == "How do I write a for loop in Python?"
    assert msg1["order_index"] == 0
    
    msg2 = conv["messages"][1]
    assert msg2["role"] == "assistant"
    assert "for i in range(10)" in msg2["content"]
    assert msg2["order_index"] == 1


def test_parse_copilot_export_dict_format():
    """Test parsing Copilot export as a dict with conversations key."""
    payload = {
        "conversations": [
            {
                "sessionId": "session-456",
                "name": "GitHub Chat",
                "startTime": "2024-01-01T12:00:00Z",
                "exchanges": [
                    {
                        "messageId": "msg1",
                        "author": "user",
                        "message": "Explain async/await",
                        "timestamp": "2024-01-01T12:00:00Z"
                    },
                    {
                        "messageId": "msg2",
                        "author": "copilot",
                        "message": "async/await is used for asynchronous programming...",
                        "timestamp": "2024-01-01T12:00:05Z"
                    }
                ]
            }
        ]
    }
    
    result = parse_copilot_export(payload)
    
    assert len(result) == 1
    assert result[0]["source_id"] == "session-456"
    assert result[0]["title"] == "GitHub Chat"
    assert len(result[0]["messages"]) == 2


def test_parse_copilot_export_alternative_keys():
    """Test parsing Copilot export with alternative key names."""
    payload = {
        "chats": [
            {
                "conversationId": "conv-789",
                "timestamp": 1704110400,  # Unix timestamp
                "turns": [
                    {
                        "type": "question",
                        "text": "What is REST?",
                        "createdAt": 1704110400
                    },
                    {
                        "type": "answer",
                        "text": "REST is an architectural style...",
                        "createdAt": 1704110405
                    }
                ]
            }
        ]
    }
    
    result = parse_copilot_export(payload)
    
    assert len(result) == 1
    assert result[0]["source_id"] == "conv-789"
    assert len(result[0]["messages"]) == 2
    assert result[0]["messages"][0]["role"] == "user"
    assert result[0]["messages"][1]["role"] == "assistant"


def test_determine_role_user_variants():
    """Test determine_role with various user role indicators."""
    assert determine_role({"role": "user"}) == "user"
    assert determine_role({"author": "human"}) == "user"
    assert determine_role({"sender": "question"}) == "user"
    assert determine_role({"type": "user"}) == "user"
    assert determine_role({"request": "some query"}) == "user"
    assert determine_role({"query": "some query"}) == "user"


def test_determine_role_assistant_variants():
    """Test determine_role with various assistant role indicators."""
    assert determine_role({"role": "assistant"}) == "assistant"
    assert determine_role({"author": "copilot"}) == "assistant"
    assert determine_role({"sender": "ai"}) == "assistant"
    assert determine_role({"type": "answer"}) == "assistant"
    assert determine_role({"response": "some response"}) == "assistant"


def test_determine_role_system():
    """Test determine_role with system role."""
    assert determine_role({"role": "system"}) == "system"
    assert determine_role({"type": "context"}) == "system"


def test_extract_content_simple_string():
    """Test extract_content with simple string content."""
    assert extract_content({"content": "Hello"}) == "Hello"
    assert extract_content({"text": "World"}) == "World"
    assert extract_content({"message": "Test"}) == "Test"


def test_extract_content_nested_dict():
    """Test extract_content with nested dict."""
    msg = {"content": {"text": "Nested content"}}
    assert extract_content(msg) == "Nested content"
    
    msg = {"content": {"value": "Another nested"}}
    assert extract_content(msg) == "Another nested"


def test_extract_content_list():
    """Test extract_content with list of parts."""
    msg = {"content": ["Part 1", "Part 2", "Part 3"]}
    assert extract_content(msg) == "Part 1\nPart 2\nPart 3"
    
    msg = {"content": [{"text": "P1"}, {"text": "P2"}]}
    assert extract_content(msg) == "P1\nP2"


def test_extract_content_request_response():
    """Test extract_content with request/response/query fields."""
    assert extract_content({"request": "Question"}) == "Question"
    assert extract_content({"response": "Answer"}) == "Answer"
    assert extract_content({"query": "Search"}) == "Search"


def test_detect_content_type_text():
    """Test detect_content_type for plain text."""
    msg = {"content": "Just plain text"}
    assert detect_content_type(msg) == "text"


def test_detect_content_type_code():
    """Test detect_content_type for code content."""
    msg = {"content": "Here's the code:\n```python\nprint('hello')\n```"}
    assert detect_content_type(msg) == "code"
    
    msg = {"hasCode": True, "content": "Some code"}
    assert detect_content_type(msg) == "code"
    
    msg = {"isCode": True, "content": "More code"}
    assert detect_content_type(msg) == "code"


def test_parse_timestamp_iso_format():
    """Test parse_timestamp with ISO format."""
    timestamp = "2024-01-01T12:00:00Z"
    result = parse_timestamp(timestamp)
    
    assert isinstance(result, datetime)
    assert result.year == 2024


def test_parse_timestamp_unix_seconds():
    """Test parse_timestamp with Unix timestamp in seconds."""
    timestamp = 1704110400  # 2024-01-01 12:00:00
    result = parse_timestamp(timestamp)
    
    assert isinstance(result, datetime)
    assert result.year == 2024


def test_parse_timestamp_unix_milliseconds():
    """Test parse_timestamp with Unix timestamp in milliseconds."""
    timestamp = 1704110400000  # 2024-01-01 12:00:00
    result = parse_timestamp(timestamp)
    
    assert isinstance(result, datetime)
    assert result.year == 2024


def test_parse_timestamp_none():
    """Test parse_timestamp with None."""
    result = parse_timestamp(None)
    assert result is None


def test_generate_title_from_messages():
    """Test generate_title_from_messages."""
    messages = [
        {"role": "user", "content": "This is a long user message that should be truncated because it exceeds sixty characters"},
        {"role": "assistant", "content": "Response"}
    ]
    
    title = generate_title_from_messages(messages)
    assert len(title) <= 63  # 60 chars + "..."
    assert "This is a long user message" in title


def test_generate_title_from_messages_multiline():
    """Test generate_title_from_messages with multiline content."""
    messages = [
        {"role": "user", "content": "First line\nSecond line\nThird line"},
        {"role": "assistant", "content": "Response"}
    ]
    
    title = generate_title_from_messages(messages)
    assert title == "First line"


def test_generate_title_from_messages_no_user():
    """Test generate_title_from_messages with no user messages."""
    messages = [
        {"role": "assistant", "content": "Only assistant message"}
    ]
    
    title = generate_title_from_messages(messages)
    assert title == "Untitled Conversation"


def test_parse_copilot_export_empty_messages():
    """Test parsing Copilot export skips empty messages."""
    payload = [
        {
            "id": "test",
            "messages": [
                {"role": "user", "content": "Valid"},
                {"role": "assistant", "content": "   "},
                {"role": "user", "content": "Also valid"}
            ]
        }
    ]
    
    result = parse_copilot_export(payload)
    assert len(result[0]["messages"]) == 2


def test_parse_copilot_export_title_generation():
    """Test that titles are generated when missing."""
    payload = [
        {
            "id": "test",
            "messages": [
                {"role": "user", "content": "First user message should become title"},
                {"role": "assistant", "content": "Response"}
            ]
        }
    ]
    
    result = parse_copilot_export(payload)
    assert "First user message" in result[0]["title"]


def test_parse_copilot_export_invalid_format():
    """Test parsing Copilot export with invalid format."""
    payload = []  # Empty list should raise ValueError
    
    try:
        parse_copilot_export(payload)
        assert False, "Should raise ValueError for empty list"
    except ValueError as e:
        assert "Unrecognized Copilot export format" in str(e)
