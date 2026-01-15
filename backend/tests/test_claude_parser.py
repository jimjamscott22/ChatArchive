"""Unit tests for Claude parser."""
from __future__ import annotations

from datetime import datetime
from app.importers.claude import parse_claude_export, parse_timestamp


def test_parse_claude_export_list_format():
    """Test parsing Claude export as a list."""
    payload = [
        {
            "uuid": "claude-123",
            "name": "Test Conversation",
            "created_at": "2024-01-01T12:00:00Z",
            "updated_at": "2024-01-02T12:00:00Z",
            "chat_messages": [
                {
                    "uuid": "msg1",
                    "sender": "human",
                    "text": "Hello Claude",
                    "created_at": "2024-01-01T12:00:00Z"
                },
                {
                    "uuid": "msg2",
                    "sender": "assistant",
                    "text": "Hello! How can I help you today?",
                    "created_at": "2024-01-01T12:00:05Z"
                }
            ],
            "model": "claude-3"
        }
    ]
    
    result = parse_claude_export(payload)
    
    assert len(result) == 1
    conv = result[0]
    assert conv["source"] == "claude"
    assert conv["source_id"] == "claude-123"
    assert conv["title"] == "Test Conversation"
    assert conv["message_count"] == 2
    assert len(conv["messages"]) == 2
    
    # Verify messages
    msg1 = conv["messages"][0]
    assert msg1["role"] == "user"
    assert msg1["content"] == "Hello Claude"
    assert msg1["order_index"] == 0
    
    msg2 = conv["messages"][1]
    assert msg2["role"] == "assistant"
    assert msg2["content"] == "Hello! How can I help you today?"
    assert msg2["order_index"] == 1
    assert msg2["model"] == "claude-3"


def test_parse_claude_export_single_conversation():
    """Test parsing Claude export with single conversation."""
    payload = {
        "uuid": "claude-456",
        "title": "Single Conversation",
        "created_at": "2024-01-01T12:00:00Z",
        "chat_messages": [
            {
                "uuid": "msg1",
                "sender": "human",
                "text": "Test message",
                "created_at": "2024-01-01T12:00:00Z"
            }
        ]
    }
    
    result = parse_claude_export(payload)
    
    assert len(result) == 1
    assert result[0]["source_id"] == "claude-456"
    assert result[0]["title"] == "Single Conversation"


def test_parse_claude_export_with_conversations_key():
    """Test parsing Claude export with conversations key."""
    payload = {
        "conversations": [
            {
                "id": "claude-789",
                "name": "Nested Conversation",
                "created_at": "2024-01-01T12:00:00Z",
                "chat_messages": [
                    {
                        "id": "msg1",
                        "sender": "human",
                        "text": "Nested message",
                        "created_at": "2024-01-01T12:00:00Z"
                    }
                ]
            }
        ]
    }
    
    result = parse_claude_export(payload)
    
    assert len(result) == 1
    assert result[0]["source_id"] == "claude-789"
    assert result[0]["title"] == "Nested Conversation"


def test_parse_claude_export_empty_messages():
    """Test parsing Claude export skips empty messages."""
    payload = [
        {
            "uuid": "claude-empty",
            "name": "Conversation with Empty",
            "created_at": "2024-01-01T12:00:00Z",
            "chat_messages": [
                {
                    "uuid": "msg1",
                    "sender": "human",
                    "text": "Valid message",
                    "created_at": "2024-01-01T12:00:00Z"
                },
                {
                    "uuid": "msg2",
                    "sender": "assistant",
                    "text": "   ",
                    "created_at": "2024-01-01T12:00:05Z"
                },
                {
                    "uuid": "msg3",
                    "sender": "human",
                    "text": "Another valid message",
                    "created_at": "2024-01-01T12:00:10Z"
                }
            ]
        }
    ]
    
    result = parse_claude_export(payload)
    
    assert len(result[0]["messages"]) == 2
    assert result[0]["messages"][0]["content"] == "Valid message"
    assert result[0]["messages"][1]["content"] == "Another valid message"


def test_parse_claude_export_invalid_format():
    """Test parsing Claude export with invalid format."""
    payload = {"conversations": None}
    
    try:
        parse_claude_export(payload)
        assert False, "Should raise ValueError"
    except ValueError as e:
        assert "Unrecognized Claude export format" in str(e)


def test_parse_timestamp_iso_format():
    """Test parse_timestamp with ISO format."""
    timestamp = "2024-01-01T12:00:00Z"
    result = parse_timestamp(timestamp)
    
    assert isinstance(result, datetime)
    assert result.year == 2024
    assert result.month == 1
    assert result.day == 1


def test_parse_timestamp_iso_with_timezone():
    """Test parse_timestamp with ISO format and timezone."""
    timestamp = "2024-01-01T12:00:00+00:00"
    result = parse_timestamp(timestamp)
    
    assert isinstance(result, datetime)
    assert result.year == 2024


def test_parse_timestamp_unix():
    """Test parse_timestamp with Unix timestamp."""
    timestamp = 1704110400  # 2024-01-01 12:00:00
    result = parse_timestamp(timestamp)
    
    assert isinstance(result, datetime)
    assert result.year == 2024


def test_parse_timestamp_none():
    """Test parse_timestamp with None."""
    result = parse_timestamp(None)
    assert result is None


def test_parse_timestamp_invalid():
    """Test parse_timestamp with invalid format."""
    result = parse_timestamp("invalid-date")
    assert result is None


def test_parse_claude_sender_mapping():
    """Test that sender 'human' maps to 'user' role."""
    payload = [
        {
            "uuid": "test",
            "name": "Test",
            "created_at": "2024-01-01T12:00:00Z",
            "chat_messages": [
                {
                    "uuid": "msg1",
                    "sender": "human",
                    "text": "Human message",
                    "created_at": "2024-01-01T12:00:00Z"
                },
                {
                    "uuid": "msg2",
                    "sender": "assistant",
                    "text": "Assistant message",
                    "created_at": "2024-01-01T12:00:00Z"
                },
                {
                    "uuid": "msg3",
                    "sender": "unknown",
                    "text": "Unknown message",
                    "created_at": "2024-01-01T12:00:00Z"
                }
            ]
        }
    ]
    
    result = parse_claude_export(payload)
    messages = result[0]["messages"]
    
    assert messages[0]["role"] == "user"
    assert messages[1]["role"] == "assistant"
    assert messages[2]["role"] == "assistant"  # Unknown defaults to assistant


def test_parse_claude_multiple_conversations():
    """Test parsing multiple Claude conversations."""
    payload = [
        {
            "uuid": "conv1",
            "name": "First",
            "created_at": "2024-01-01T12:00:00Z",
            "chat_messages": [
                {
                    "uuid": "msg1",
                    "sender": "human",
                    "text": "Message 1",
                    "created_at": "2024-01-01T12:00:00Z"
                }
            ]
        },
        {
            "uuid": "conv2",
            "name": "Second",
            "created_at": "2024-01-02T12:00:00Z",
            "chat_messages": [
                {
                    "uuid": "msg2",
                    "sender": "human",
                    "text": "Message 2",
                    "created_at": "2024-01-02T12:00:00Z"
                }
            ]
        }
    ]
    
    result = parse_claude_export(payload)
    
    assert len(result) == 2
    assert result[0]["title"] == "First"
    assert result[1]["title"] == "Second"
