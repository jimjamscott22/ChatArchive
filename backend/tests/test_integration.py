"""Integration tests for all parsers."""
from __future__ import annotations

import json
from app.importers.chatgpt import parse_chatgpt_export
from app.importers.claude import parse_claude_export
from app.importers.copilot import parse_copilot_export
from app.importers.gemini import parse_gemini_export


def test_all_parsers_return_consistent_format():
    """Test that all parsers return data in the same normalized format."""
    
    # ChatGPT data
    chatgpt_data = {
        "conversations": [{
            "id": "chatgpt-1",
            "title": "Test Chat",
            "create_time": 1704110400,
            "mapping": {
                "root": {"id": "root", "parent": None, "children": ["msg1"], "message": None},
                "msg1": {
                    "id": "msg1",
                    "parent": "root",
                    "children": [],
                    "message": {
                        "id": "msg1",
                        "author": {"role": "user"},
                        "content": {"content_type": "text", "parts": ["Test"]},
                        "metadata": {}
                    }
                }
            }
        }]
    }
    
    # Claude data
    claude_data = [{
        "uuid": "claude-1",
        "name": "Test Chat",
        "created_at": "2024-01-01T12:00:00Z",
        "chat_messages": [{
            "uuid": "msg1",
            "sender": "human",
            "text": "Test",
            "created_at": "2024-01-01T12:00:00Z"
        }]
    }]
    
    # Copilot data
    copilot_data = [{
        "id": "copilot-1",
        "title": "Test Chat",
        "createdAt": "2024-01-01T12:00:00Z",
        "messages": [{
            "id": "msg1",
            "role": "user",
            "content": "Test",
            "timestamp": "2024-01-01T12:00:00Z"
        }]
    }]
    
    # Gemini data
    gemini_data = [{
        "id": "gemini-1",
        "title": "Test Chat",
        "create_time": 1704110400,
        "messages": [{
            "id": "msg1",
            "role": "user",
            "text": "Test",
            "timestamp": 1704110400
        }]
    }]
    
    # Parse all
    chatgpt_result = parse_chatgpt_export(chatgpt_data)
    claude_result = parse_claude_export(claude_data)
    copilot_result = parse_copilot_export(copilot_data)
    gemini_result = parse_gemini_export(gemini_data)
    
    # All should return lists
    assert isinstance(chatgpt_result, list)
    assert isinstance(claude_result, list)
    assert isinstance(copilot_result, list)
    assert isinstance(gemini_result, list)
    
    # All should have one conversation
    assert len(chatgpt_result) == 1
    assert len(claude_result) == 1
    assert len(copilot_result) == 1
    assert len(gemini_result) == 1
    
    # Check required keys for all parsers
    required_keys = {"source", "source_id", "title", "message_count", "messages", "raw_json"}
    
    for result, source_name in [
        (chatgpt_result[0], "chatgpt"),
        (claude_result[0], "claude"),
        (copilot_result[0], "copilot"),
        (gemini_result[0], "gemini")
    ]:
        assert set(result.keys()).issuperset(required_keys), f"Missing keys in {source_name}"
        assert result["source"] == source_name
        assert isinstance(result["messages"], list)
        assert len(result["messages"]) > 0
        
        # Check message format
        msg = result["messages"][0]
        required_msg_keys = {"role", "content", "content_type", "order_index"}
        assert set(msg.keys()).issuperset(required_msg_keys), f"Missing message keys in {source_name}"


def test_all_parsers_handle_multiple_conversations():
    """Test that all parsers can handle multiple conversations."""
    
    # ChatGPT
    chatgpt_data = [
        {
            "id": "conv1",
            "title": "First",
            "mapping": {
                "root": {"id": "root", "parent": None, "children": ["msg1"], "message": None},
                "msg1": {
                    "id": "msg1",
                    "parent": "root",
                    "children": [],
                    "message": {
                        "author": {"role": "user"},
                        "content": {"content_type": "text", "parts": ["Test"]},
                        "metadata": {}
                    }
                }
            }
        },
        {
            "id": "conv2",
            "title": "Second",
            "mapping": {
                "root": {"id": "root", "parent": None, "children": ["msg1"], "message": None},
                "msg1": {
                    "id": "msg1",
                    "parent": "root",
                    "children": [],
                    "message": {
                        "author": {"role": "user"},
                        "content": {"content_type": "text", "parts": ["Test"]},
                        "metadata": {}
                    }
                }
            }
        }
    ]
    
    # Claude
    claude_data = [
        {
            "uuid": "conv1",
            "name": "First",
            "chat_messages": [{"sender": "human", "text": "Test"}]
        },
        {
            "uuid": "conv2",
            "name": "Second",
            "chat_messages": [{"sender": "human", "text": "Test"}]
        }
    ]
    
    # Copilot
    copilot_data = [
        {
            "id": "conv1",
            "title": "First",
            "messages": [{"role": "user", "content": "Test"}]
        },
        {
            "id": "conv2",
            "title": "Second",
            "messages": [{"role": "user", "content": "Test"}]
        }
    ]
    
    # Gemini
    gemini_data = [
        {
            "id": "conv1",
            "title": "First",
            "messages": [{"role": "user", "text": "Test"}]
        },
        {
            "id": "conv2",
            "title": "Second",
            "messages": [{"role": "user", "text": "Test"}]
        }
    ]
    
    # All should parse 2 conversations
    assert len(parse_chatgpt_export(chatgpt_data)) == 2
    assert len(parse_claude_export(claude_data)) == 2
    assert len(parse_copilot_export(copilot_data)) == 2
    assert len(parse_gemini_export(gemini_data)) == 2


def test_all_parsers_skip_empty_messages():
    """Test that all parsers skip empty messages."""
    
    # ChatGPT
    chatgpt_data = [{
        "id": "test",
        "current_node": "msg1",
        "mapping": {
            "root": {"id": "root", "parent": None, "children": ["msg1", "msg2"], "message": None},
            "msg1": {
                "id": "msg1",
                "parent": "root",
                "children": [],
                "message": {
                    "author": {"role": "user"},
                    "content": {"content_type": "text", "parts": ["Valid"]},
                    "metadata": {}
                }
            },
            "msg2": {
                "id": "msg2",
                "parent": "root",
                "children": [],
                "message": {
                    "author": {"role": "user"},
                    "content": {"content_type": "text", "parts": [""]},
                    "metadata": {}
                }
            }
        }
    }]
    
    # Claude
    claude_data = [{
        "uuid": "test",
        "chat_messages": [
            {"sender": "human", "text": "Valid"},
            {"sender": "human", "text": "   "}
        ]
    }]
    
    # Copilot
    copilot_data = [{
        "id": "test",
        "messages": [
            {"role": "user", "content": "Valid"},
            {"role": "user", "content": ""}
        ]
    }]
    
    # Gemini
    gemini_data = [{
        "id": "test",
        "messages": [
            {"role": "user", "text": "Valid"},
            {"role": "user", "text": "   "}
        ]
    }]
    
    # All should parse only 1 message
    assert len(parse_chatgpt_export(chatgpt_data)[0]["messages"]) == 1
    assert len(parse_claude_export(claude_data)[0]["messages"]) == 1
    assert len(parse_copilot_export(copilot_data)[0]["messages"]) == 1
    assert len(parse_gemini_export(gemini_data)[0]["messages"]) == 1


def test_all_parsers_handle_error_cases():
    """Test that all parsers raise appropriate errors for invalid input."""
    
    # ChatGPT should raise ValueError for truly invalid format
    try:
        parse_chatgpt_export({"invalid": "format"})
        assert False, "ChatGPT parser should raise ValueError"
    except ValueError:
        pass
    
    # Claude should raise ValueError for empty conversations list
    try:
        parse_claude_export({"conversations": []})
        assert False, "Claude parser should raise ValueError"
    except ValueError:
        pass
    
    # Copilot should raise ValueError for empty list
    try:
        parse_copilot_export([])
        assert False, "Copilot parser should raise ValueError"
    except ValueError:
        pass
    
    # Gemini should raise ValueError for empty list
    try:
        parse_gemini_export([])
        assert False, "Gemini parser should raise ValueError"
    except ValueError:
        pass


def test_raw_json_is_preserved():
    """Test that all parsers preserve raw JSON for debugging."""
    
    # Test with ChatGPT
    chatgpt_data = [{
        "id": "test",
        "custom_field": "custom_value",
        "mapping": {
            "root": {"id": "root", "parent": None, "children": ["msg1"], "message": None},
            "msg1": {
                "id": "msg1",
                "parent": "root",
                "children": [],
                "message": {
                    "author": {"role": "user"},
                    "content": {"content_type": "text", "parts": ["Test"]},
                    "metadata": {}
                }
            }
        }
    }]
    
    result = parse_chatgpt_export(chatgpt_data)
    raw_json = json.loads(result[0]["raw_json"])
    
    assert "custom_field" in raw_json
    assert raw_json["custom_field"] == "custom_value"
