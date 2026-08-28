"""Unit tests for Gemini parser."""
from __future__ import annotations

import json
from datetime import datetime
from app.importers.gemini import (
    parse_gemini_export,
    determine_role,
    extract_content,
    parse_timestamp,
)


def test_parse_gemini_export_list_format():
    """Test parsing Gemini export as a list."""
    payload = [
        {
            "id": "gemini-123",
            "title": "Gemini Conversation",
            "create_time": 1704110400,  # Unix timestamp
            "update_time": 1704196800,
            "messages": [
                {
                    "id": "msg1",
                    "role": "user",
                    "text": "What is machine learning?",
                    "timestamp": 1704110400
                },
                {
                    "id": "msg2",
                    "role": "model",
                    "text": "Machine learning is a branch of AI...",
                    "timestamp": 1704110405,
                    "model": "gemini-pro"
                }
            ]
        }
    ]
    
    result = parse_gemini_export(payload)
    
    assert len(result) == 1
    conv = result[0]
    assert conv["source"] == "gemini"
    assert conv["source_id"] == "gemini-123"
    assert conv["title"] == "Gemini Conversation"
    assert conv["message_count"] == 2
    assert len(conv["messages"]) == 2
    
    # Verify messages
    msg1 = conv["messages"][0]
    assert msg1["role"] == "user"
    assert msg1["content"] == "What is machine learning?"
    assert msg1["order_index"] == 0
    
    msg2 = conv["messages"][1]
    assert msg2["role"] == "assistant"
    assert "Machine learning" in msg2["content"]
    assert msg2["order_index"] == 1
    assert msg2["model"] == "gemini-pro"


def test_parse_gemini_export_dict_with_conversations():
    """Test parsing Gemini export as dict with conversations key."""
    payload = {
        "conversations": [
            {
                "conversation_id": "conv-456",
                "name": "Bard Chat",
                "created_at": "2024-01-01T12:00:00.000",
                "turns": [
                    {
                        "message_id": "msg1",
                        "author": "user",
                        "prompt": "Explain quantum computing",
                        "create_time": 1704110400
                    },
                    {
                        "message_id": "msg2",
                        "author": "bard",
                        "response": "Quantum computing uses quantum bits...",
                        "create_time": 1704110405
                    }
                ]
            }
        ]
    }
    
    result = parse_gemini_export(payload)
    
    assert len(result) == 1
    assert result[0]["source_id"] == "conv-456"
    assert result[0]["title"] == "Bard Chat"
    assert len(result[0]["messages"]) == 2


def test_parse_gemini_export_single_conversation():
    """Test parsing Gemini export with single conversation."""
    payload = {
        "id": "single-789",
        "title": "Single Chat",
        "create_time": 1704110400,
        "messages": [
            {
                "id": "msg1",
                "role": "user",
                "text": "Test message"
            }
        ]
    }
    
    result = parse_gemini_export(payload)
    
    assert len(result) == 1
    assert result[0]["source_id"] == "single-789"


def test_parse_gemini_export_history_key():
    """Test parsing Gemini export with history key."""
    payload = {
        "history": [
            {
                "id": "hist-001",
                "name": "History Chat",
                "timestamp": 1704110400,
                "content": [
                    {
                        "sender": "human",
                        "message": "Message from history"
                    }
                ]
            }
        ]
    }
    
    result = parse_gemini_export(payload)
    
    assert len(result) == 1
    assert result[0]["source_id"] == "hist-001"


def test_determine_role_user():
    """Test determine_role with user indicators."""
    assert determine_role({"role": "user"}) == "user"
    assert determine_role({"author": "human"}) == "user"
    assert determine_role({"sender": "USER"}) == "user"


def test_determine_role_assistant():
    """Test determine_role with assistant indicators."""
    assert determine_role({"role": "model"}) == "assistant"
    assert determine_role({"author": "assistant"}) == "assistant"
    assert determine_role({"sender": "ai"}) == "assistant"
    assert determine_role({"author": "gemini"}) == "assistant"
    assert determine_role({"author": "bard"}) == "assistant"


def test_determine_role_with_user_input():
    """Test determine_role with user_input field."""
    assert determine_role({"user_input": "some text"}) == "user"
    assert determine_role({"prompt": "some prompt"}) == "user"


def test_determine_role_default():
    """Test determine_role defaults to assistant."""
    assert determine_role({"unknown": "field"}) == "assistant"


def test_extract_content_text():
    """Test extract_content with text field."""
    assert extract_content({"text": "Hello"}) == "Hello"


def test_extract_content_content():
    """Test extract_content with content field."""
    assert extract_content({"content": "World"}) == "World"


def test_extract_content_message():
    """Test extract_content with message field."""
    assert extract_content({"message": "Test"}) == "Test"


def test_extract_content_prompt_response():
    """Test extract_content with prompt/response fields."""
    assert extract_content({"prompt": "Question"}) == "Question"
    assert extract_content({"response": "Answer"}) == "Answer"


def test_extract_content_nested_dict():
    """Test extract_content with nested dict structure."""
    msg = {"content": {"text": "Nested text"}}
    assert extract_content(msg) == "Nested text"
    
    msg = {"content": {"parts": ["Part 1"]}}
    assert extract_content(msg) == "Part 1"


def test_extract_content_list():
    """Test extract_content with list of parts."""
    msg = {"text": ["Part 1", "Part 2", "Part 3"]}
    assert extract_content(msg) == "Part 1\nPart 2\nPart 3"
    
    msg = {"content": [None, "Valid", "", "Also valid"]}
    assert extract_content(msg) == "Valid\nAlso valid"


def test_parse_timestamp_iso_with_milliseconds():
    """Test parse_timestamp with ISO format including milliseconds."""
    timestamp = "2024-01-01T12:00:00.000"
    result = parse_timestamp(timestamp)
    
    assert isinstance(result, datetime)
    assert result.year == 2024


def test_parse_timestamp_iso_basic():
    """Test parse_timestamp with basic ISO format."""
    timestamp = "2024-01-01T12:00:00"
    result = parse_timestamp(timestamp)
    
    assert isinstance(result, datetime)
    assert result.year == 2024


def test_parse_timestamp_with_z():
    """Test parse_timestamp with Z timezone indicator."""
    timestamp = "2024-01-01T12:00:00.000Z"
    result = parse_timestamp(timestamp)
    
    assert isinstance(result, datetime)
    assert result.year == 2024


def test_parse_timestamp_unix_seconds():
    """Test parse_timestamp with Unix timestamp in seconds."""
    timestamp = 1704110400
    result = parse_timestamp(timestamp)
    
    assert isinstance(result, datetime)
    assert result.year == 2024


def test_parse_timestamp_unix_milliseconds():
    """Test parse_timestamp with Unix timestamp in milliseconds."""
    timestamp = 1704110400000
    result = parse_timestamp(timestamp)
    
    assert isinstance(result, datetime)
    assert result.year == 2024


def test_parse_timestamp_none():
    """Test parse_timestamp with None."""
    result = parse_timestamp(None)
    assert result is None


def test_parse_timestamp_invalid():
    """Test parse_timestamp with invalid value."""
    result = parse_timestamp("not-a-date")
    assert result is None


def test_parse_gemini_export_empty_messages():
    """Test parsing Gemini export skips empty messages."""
    payload = [
        {
            "id": "test",
            "title": "Test",
            "messages": [
                {"role": "user", "text": "Valid message"},
                {"role": "model", "text": "   "},
                {"role": "user", "text": "Another valid"}
            ]
        }
    ]
    
    result = parse_gemini_export(payload)
    assert len(result[0]["messages"]) == 2


def test_parse_gemini_export_message_timestamp_fallback():
    """Test that message timestamps fall back to conversation timestamp."""
    payload = [
        {
            "id": "test",
            "title": "Test",
            "create_time": 1704110400,
            "messages": [
                {"role": "user", "text": "Message without timestamp"}
            ]
        }
    ]
    
    result = parse_gemini_export(payload)
    msg = result[0]["messages"][0]
    
    assert msg["created_at"] is not None
    assert isinstance(msg["created_at"], datetime)


def test_parse_gemini_export_model_fallback():
    """Test that model defaults to 'gemini' when not specified."""
    payload = [
        {
            "id": "test",
            "title": "Test",
            "messages": [
                {"role": "user", "text": "Message"}
            ]
        }
    ]
    
    result = parse_gemini_export(payload)
    assert result[0]["messages"][0]["model"] == "gemini"


def test_parse_gemini_export_model_inheritance():
    """Test that messages inherit model from conversation."""
    payload = [
        {
            "id": "test",
            "title": "Test",
            "model": "gemini-pro",
            "messages": [
                {"role": "user", "text": "Message"}
            ]
        }
    ]
    
    result = parse_gemini_export(payload)
    assert result[0]["messages"][0]["model"] == "gemini-pro"


def test_parse_gemini_export_multiple_conversations():
    """Test parsing multiple Gemini conversations."""
    payload = [
        {
            "id": "conv1",
            "title": "First",
            "messages": [{"role": "user", "text": "Msg 1"}]
        },
        {
            "id": "conv2",
            "title": "Second",
            "messages": [{"role": "user", "text": "Msg 2"}]
        }
    ]
    
    result = parse_gemini_export(payload)
    
    assert len(result) == 2
    assert result[0]["title"] == "First"
    assert result[1]["title"] == "Second"


def test_parse_gemini_export_invalid_format():
    """Test parsing Gemini export with invalid format."""
    payload = []  # Empty list should raise ValueError
    
    try:
        parse_gemini_export(payload)
        assert False, "Should raise ValueError for empty list"
    except ValueError as e:
        assert "Unrecognized Gemini export format" in str(e)


def test_parse_gemini_export_empty_conversations_key_is_empty():
    try:
        parse_gemini_export({"conversations": []})
        assert False, "Should raise ValueError for empty conversations array"
    except ValueError as e:
        assert "Unrecognized Gemini export format" in str(e)


def test_extract_content_top_level_parts():
    assert extract_content({"role": "user", "parts": [{"text": "hello"}]}) == "hello"
    assert extract_content({"content": {"parts": []}}) == ""


def test_parse_gemini_prompt_and_response_split():
    payload = [
        {
            "id": "g1",
            "title": "Turn",
            "messages": [
                {"prompt": "What is AI?", "response": "Artificial intelligence..."}
            ],
        }
    ]
    result = parse_gemini_export(payload)
    assert len(result[0]["messages"]) == 2
    assert result[0]["messages"][0]["role"] == "user"
    assert result[0]["messages"][0]["content"] == "What is AI?"
    assert result[0]["messages"][1]["role"] == "assistant"


def test_parse_timestamp_negative_offset():
    result = parse_timestamp("2024-01-01T12:00:00-05:00")
    assert result is not None
    assert result.hour == 17


def test_parse_gemini_apps_activity_details_request_response():
    payload = [
        {
            "header": "Gemini",
            "title": "Used Gemini Apps",
            "titleUrl": "https://gemini.google.com/app/c/abc123",
            "time": "2024-02-17T22:05:10.123Z",
            "products": ["Gemini Apps"],
            "details": [
                {"name": "Request", "value": "What is photosynthesis?"},
                {"name": "Response", "value": "Photosynthesis is how plants make food."},
            ],
        }
    ]

    result = parse_gemini_export(payload)
    assert len(result) == 1
    conv = result[0]
    assert conv["source"] == "gemini"
    assert conv["source_id"] == "abc123"
    assert conv["title"] == "What is photosynthesis?"
    assert len(conv["messages"]) == 2
    assert conv["messages"][0]["role"] == "user"
    assert conv["messages"][0]["content"] == "What is photosynthesis?"
    assert conv["messages"][1]["role"] == "assistant"
    assert "Photosynthesis" in conv["messages"][1]["content"]


def test_parse_gemini_apps_activity_user_interactions():
    payload = [
        {
            "header": "Gemini",
            "title": "Used Gemini Apps",
            "titleUrl": "https://gemini.google.com/app/xyz789",
            "time": "2024-03-01T10:00:00.000Z",
            "products": ["Gemini Apps"],
            "userInteractions": [
                {
                    "userInteraction": json.dumps({
                        "request": "Summarize this article",
                        "response": "The article argues that...",
                    })
                }
            ],
        }
    ]

    result = parse_gemini_export(payload)
    assert len(result) == 1
    assert result[0]["source_id"] == "xyz789"
    assert [msg["content"] for msg in result[0]["messages"]] == [
        "Summarize this article",
        "The article argues that...",
    ]


def test_parse_gemini_apps_activity_title_only():
    payload = [
        {
            "header": "Gemini",
            "title": "Prompted Gemini Apps to write a haiku about rain",
            "time": "2024-04-01T08:00:00.000Z",
            "products": ["Gemini Apps"],
        }
    ]

    result = parse_gemini_export(payload)
    assert len(result) == 1
    conv = result[0]
    assert conv["source_id"] is None
    assert conv["title"] == "write a haiku about rain"
    assert len(conv["messages"]) == 1
    assert conv["messages"][0]["role"] == "user"
    assert conv["messages"][0]["content"] == "write a haiku about rain"


def test_parse_gemini_apps_activity_empty_details_has_no_messages():
    payload = [
        {
            "header": "Gemini",
            "title": "Used Gemini Apps",
            "time": "2024-06-01T00:00:00.000Z",
            "products": ["Gemini Apps"],
        }
    ]
    result = parse_gemini_export(payload)
    assert len(result) == 1
    assert result[0]["messages"] == []
    assert result[0]["message_count"] == 0


def test_parse_gemini_apps_activity_groups_by_title_url():
    payload = [
        {
            "header": "Gemini",
            "title": "Used Gemini Apps",
            "titleUrl": "https://gemini.google.com/app/c/thread1",
            "time": "2024-05-01T12:00:02.000Z",
            "products": ["Gemini Apps"],
            "details": [
                {"name": "Request", "value": "Follow up question"},
                {"name": "Response", "value": "Follow up answer"},
            ],
        },
        {
            "header": "Gemini",
            "title": "Used Gemini Apps",
            "titleUrl": "https://gemini.google.com/app/c/thread1",
            "time": "2024-05-01T12:00:00.000Z",
            "products": ["Gemini Apps"],
            "details": [
                {"name": "Request", "value": "First question"},
                {"name": "Response", "value": "First answer"},
            ],
        },
        {
            "header": "Gemini",
            "title": "Used Gemini Apps",
            "titleUrl": "https://gemini.google.com/u/0/app/other-thread",
            "time": "2024-05-01T13:00:00.000Z",
            "products": ["Gemini Apps"],
            "details": [
                {"name": "Prompt", "value": "Separate chat"},
            ],
        },
    ]

    result = parse_gemini_export(payload)
    by_id = {conv["source_id"]: conv for conv in result}
    assert set(by_id) == {"thread1", "other-thread"}

    thread = by_id["thread1"]
    assert [msg["content"] for msg in thread["messages"]] == [
        "First question",
        "First answer",
        "Follow up question",
        "Follow up answer",
    ]
    assert thread["title"] == "First question"

    other = by_id["other-thread"]
    assert [msg["content"] for msg in other["messages"]] == ["Separate chat"]

