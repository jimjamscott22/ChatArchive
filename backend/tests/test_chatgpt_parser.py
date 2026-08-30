"""Unit tests for ChatGPT parser."""
from __future__ import annotations

import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path

import pytest

from app.importers.chatgpt import parse_chatgpt_export, extract_messages_from_mapping, parse_message, should_include_message


def test_parse_chatgpt_export_with_conversations_key():
    """Test parsing ChatGPT export with conversations key."""
    payload = {
        "conversations": [
            {
                "id": "conv-123",
                "title": "Test Conversation",
                "create_time": 1704067200.0,  # 2024-01-01
                "update_time": 1704153600.0,  # 2024-01-02
                "mapping": {
                    "root": {
                        "id": "root",
                        "parent": None,
                        "children": ["msg1"],
                        "message": None
                    },
                    "msg1": {
                        "id": "msg1",
                        "parent": "root",
                        "children": ["msg2"],
                        "message": {
                            "id": "msg1",
                            "author": {"role": "user"},
                            "create_time": 1704067200.0,
                            "content": {
                                "content_type": "text",
                                "parts": ["Hello, how are you?"]
                            },
                            "metadata": {}
                        }
                    },
                    "msg2": {
                        "id": "msg2",
                        "parent": "msg1",
                        "children": [],
                        "message": {
                            "id": "msg2",
                            "author": {"role": "assistant"},
                            "create_time": 1704067210.0,
                            "content": {
                                "content_type": "text",
                                "parts": ["I'm doing well, thank you!"]
                            },
                            "metadata": {"model_slug": "gpt-4"}
                        }
                    }
                }
            }
        ]
    }
    
    result = parse_chatgpt_export(payload)
    
    assert len(result) == 1
    conv = result[0]
    assert conv["source"] == "chatgpt"
    assert conv["source_id"] == "conv-123"
    assert conv["title"] == "Test Conversation"
    assert conv["message_count"] == 2
    assert len(conv["messages"]) == 2
    
    # Verify messages
    msg1 = conv["messages"][0]
    assert msg1["role"] == "user"
    assert msg1["content"] == "Hello, how are you?"
    assert msg1["order_index"] == 0
    
    msg2 = conv["messages"][1]
    assert msg2["role"] == "assistant"
    assert msg2["content"] == "I'm doing well, thank you!"
    assert msg2["order_index"] == 1
    assert msg2["model"] == "gpt-4"


def test_parse_chatgpt_export_list_format():
    """Test parsing ChatGPT export as a list."""
    payload = [
        {
            "conversation_id": "conv-456",
            "title": "Another Test",
            "create_time": 1704067200.0,
            "mapping": {
                "root": {
                    "id": "root",
                    "parent": None,
                    "children": ["msg1"],
                    "message": None
                },
                "msg1": {
                    "id": "msg1",
                    "parent": "root",
                    "children": [],
                    "message": {
                        "id": "msg1",
                        "author": {"role": "user"},
                        "create_time": 1704067200.0,
                        "content": {
                            "content_type": "text",
                            "parts": ["Test message"]
                        },
                        "metadata": {}
                    }
                }
            }
        }
    ]
    
    result = parse_chatgpt_export(payload)
    
    assert len(result) == 1
    assert result[0]["source_id"] == "conv-456"
    assert result[0]["title"] == "Another Test"


def test_parse_chatgpt_export_invalid_format():
    """Test parsing ChatGPT export with invalid format."""
    payload = {"invalid": "format"}
    
    try:
        parse_chatgpt_export(payload)
        assert False, "Should raise ValueError"
    except ValueError as e:
        assert "Unrecognized ChatGPT export format" in str(e)


def test_should_include_message_user():
    """Test should_include_message for user messages."""
    message = {
        "author": {"role": "user"},
        "content": {"content_type": "text", "parts": ["Hello"]},
        "metadata": {}
    }
    assert should_include_message(message) is True


def test_should_include_message_assistant():
    """Test should_include_message for assistant messages."""
    message = {
        "author": {"role": "assistant"},
        "content": {"content_type": "text", "parts": ["Hi"]},
        "metadata": {}
    }
    assert should_include_message(message) is True


def test_should_include_message_hidden():
    """Test should_include_message for hidden messages."""
    message = {
        "author": {"role": "user"},
        "content": {"content_type": "text", "parts": ["Hidden"]},
        "metadata": {"is_visually_hidden_from_conversation": True}
    }
    assert should_include_message(message) is False


def test_should_include_message_system_error():
    """Test should_include_message for system error messages."""
    message = {
        "author": {"role": "assistant"},
        "content": {"content_type": "system_error", "parts": ["Error"]},
        "metadata": {}
    }
    assert should_include_message(message) is False


def test_parse_message_basic():
    """Test parse_message with basic message."""
    message = {
        "id": "msg1",
        "author": {"role": "user"},
        "create_time": 1704067200.0,
        "content": {
            "content_type": "text",
            "parts": ["Test content"]
        },
        "metadata": {}
    }
    
    result = parse_message(message, 0)
    
    assert result["source_id"] == "msg1"
    assert result["role"] == "user"
    assert result["content"] == "Test content"
    assert result["content_type"] == "text"
    assert result["order_index"] == 0
    assert isinstance(result["created_at"], datetime)


def test_parse_message_empty_content():
    """Test parse_message with empty content."""
    message = {
        "id": "msg1",
        "author": {"role": "user"},
        "content": {
            "content_type": "text",
            "parts": [""]
        },
        "metadata": {}
    }
    
    result = parse_message(message, 0)
    assert result is None


def test_parse_message_multiple_parts():
    """Test parse_message with multiple content parts."""
    message = {
        "id": "msg1",
        "author": {"role": "user"},
        "content": {
            "content_type": "text",
            "parts": ["Part 1", "Part 2", "Part 3"]
        },
        "metadata": {}
    }
    
    result = parse_message(message, 0)
    assert result["content"] == "Part 1\nPart 2\nPart 3"


def test_extract_messages_from_mapping_empty():
    """Test extract_messages_from_mapping with empty mapping."""
    result = extract_messages_from_mapping({})
    assert result == []


def test_extract_messages_from_mapping_tree():
    """Only the current_node branch is imported, not the full mapping tree."""
    mapping = {
        "root": {
            "id": "root",
            "parent": None,
            "children": ["msg1", "msg3"],
            "message": None
        },
        "msg1": {
            "id": "msg1",
            "parent": "root",
            "children": ["msg2"],
            "message": {
                "id": "msg1",
                "author": {"role": "user"},
                "content": {"content_type": "text", "parts": ["Message 1"]},
                "metadata": {}
            }
        },
        "msg2": {
            "id": "msg2",
            "parent": "msg1",
            "children": [],
            "message": {
                "id": "msg2",
                "author": {"role": "assistant"},
                "content": {"content_type": "text", "parts": ["Message 2"]},
                "metadata": {}
            }
        },
        "msg3": {
            "id": "msg3",
            "parent": "root",
            "children": [],
            "message": {
                "id": "msg3",
                "author": {"role": "user"},
                "content": {"content_type": "text", "parts": ["Message 3"]},
                "metadata": {}
            }
        }
    }

    selected = extract_messages_from_mapping(mapping, current_node="msg2")
    assert [msg["content"] for msg in selected] == ["Message 1", "Message 2"]

    other_branch = extract_messages_from_mapping(mapping, current_node="msg3")
    assert [msg["content"] for msg in other_branch] == ["Message 3"]


def test_extract_messages_from_mapping_last_child_without_current_node():
    """Missing current_node follows the last-child path (latest regeneration)."""
    mapping = {
        "root": {
            "id": "root",
            "parent": None,
            "children": ["msg1", "msg3"],
            "message": None,
        },
        "msg1": {
            "id": "msg1",
            "parent": "root",
            "children": ["msg2"],
            "message": {
                "author": {"role": "user"},
                "content": {"content_type": "text", "parts": ["Message 1"]},
                "metadata": {},
            },
        },
        "msg2": {
            "id": "msg2",
            "parent": "msg1",
            "children": [],
            "message": {
                "author": {"role": "assistant"},
                "content": {"content_type": "text", "parts": ["Message 2"]},
                "metadata": {},
            },
        },
        "msg3": {
            "id": "msg3",
            "parent": "root",
            "children": [],
            "message": {
                "author": {"role": "user"},
                "content": {"content_type": "text", "parts": ["Message 3"]},
                "metadata": {},
            },
        },
    }

    result = extract_messages_from_mapping(mapping)
    assert [msg["content"] for msg in result] == ["Message 3"]


def _assert_cyclic_mapping_is_rejected(mapping: dict) -> None:
    """Run potentially non-terminating parser input in a bounded subprocess."""
    script = (
        "from app.importers.chatgpt import parse_chatgpt_export; "
        f"parse_chatgpt_export([{{'id': 'test', 'mapping': {mapping!r}}}])"
    )

    try:
        completed = subprocess.run(
            [sys.executable, "-c", script],
            cwd=Path(__file__).resolve().parents[1],
            capture_output=True,
            text=True,
            timeout=2,
            check=False,
        )
    except subprocess.TimeoutExpired:
        pytest.fail("cyclic ChatGPT mapping did not terminate within two seconds")

    assert completed.returncode != 0
    assert "ValueError" in completed.stderr
    assert "cycle or repeated node reference" in completed.stderr


def test_parse_chatgpt_export_rejects_self_cycle():
    """A node that references itself must be rejected rather than revisited."""
    mapping = {
        "root": {
            "parent": None,
            "children": ["root"],
            "message": None,
        }
    }

    _assert_cyclic_mapping_is_rejected(mapping)


def test_parse_chatgpt_export_rejects_multi_node_cycle():
    """A back-edge through multiple nodes must also be rejected."""
    mapping = {
        "root": {
            "parent": None,
            "children": ["child"],
            "message": None,
        },
        "child": {
            "parent": "root",
            "children": ["root"],
            "message": None,
        },
    }

    _assert_cyclic_mapping_is_rejected(mapping)


def test_parse_chatgpt_export_rejects_parent_cycle():
    """A cycle on the parent chain from current_node must be rejected."""
    mapping = {
        "root": {
            "parent": "child",
            "children": ["child"],
            "message": None,
        },
        "child": {
            "parent": "root",
            "children": [],
            "message": None,
        },
    }

    script = (
        "from app.importers.chatgpt import parse_chatgpt_export; "
        f"parse_chatgpt_export([{{'id': 'test', 'current_node': 'child', 'mapping': {mapping!r}}}])"
    )
    try:
        completed = subprocess.run(
            [sys.executable, "-c", script],
            cwd=Path(__file__).resolve().parents[1],
            capture_output=True,
            text=True,
            timeout=2,
            check=False,
        )
    except subprocess.TimeoutExpired:
        pytest.fail("cyclic ChatGPT parent chain did not terminate within two seconds")

    assert completed.returncode != 0
    assert "ValueError" in completed.stderr
    assert "cycle or repeated node reference" in completed.stderr


def test_parse_chatgpt_export_last_child_ignores_unused_sibling():
    """Without current_node, a shared/sibling branch is not visited."""
    mapping = {
        "root": {
            "parent": None,
            "children": ["left", "right"],
            "message": None,
        },
        "left": {
            "parent": "root",
            "children": ["shared"],
            "message": {
                "author": {"role": "user"},
                "content": {"content_type": "text", "parts": ["Left"]},
                "metadata": {},
            },
        },
        "right": {
            "parent": "root",
            "children": [],
            "message": {
                "author": {"role": "user"},
                "content": {"content_type": "text", "parts": ["Right"]},
                "metadata": {},
            },
        },
        "shared": {
            "parent": "left",
            "children": [],
            "message": {
                "author": {"role": "assistant"},
                "content": {"content_type": "text", "parts": ["Shared"]},
                "metadata": {},
            },
        },
    }

    result = parse_chatgpt_export([{"id": "test", "mapping": mapping}])
    assert [msg["content"] for msg in result[0]["messages"]] == ["Right"]


def test_parse_message_null_content_is_skipped():
    message = {
        "id": "msg1",
        "author": {"role": "user"},
        "content": None,
        "metadata": {},
    }
    assert parse_message(message, 0) is None
    # Null content is skipped at parse time rather than crashing import.


def test_parse_message_uses_content_text_without_parts():
    message = {
        "id": "msg1",
        "author": {"role": "assistant"},
        "content": {"content_type": "code", "text": "print('hello')"},
        "metadata": {},
    }
    result = parse_message(message, 0)
    assert result is not None
    assert result["content"] == "print('hello')"


def test_parse_message_dict_parts_text():
    message = {
        "id": "msg1",
        "author": {"role": "user"},
        "content": {
            "content_type": "multimodal_text",
            "parts": [{"text": "voice transcript"}],
        },
        "metadata": {},
    }
    result = parse_message(message, 0)
    assert result is not None
    assert result["content"] == "voice transcript"


def test_extract_messages_null_children_does_not_crash():
    mapping = {
        "root": {"parent": None, "children": ["msg1"], "message": None},
        "msg1": {
            "parent": "root",
            "children": None,
            "message": {
                "author": {"role": "user"},
                "content": {"content_type": "text", "parts": ["Hello"]},
                "metadata": {},
            },
        },
    }
    result = extract_messages_from_mapping(mapping)
    assert len(result) == 1
    assert result[0]["content"] == "Hello"


def test_chatgpt_timestamps_are_naive_utc():
    payload = {
        "conversations": [
            {
                "id": "conv-utc",
                "title": "UTC",
                "create_time": 1704067200.0,
                "mapping": {
                    "root": {"parent": None, "children": ["msg1"], "message": None},
                    "msg1": {
                        "parent": "root",
                        "children": [],
                        "message": {
                            "author": {"role": "user"},
                            "create_time": 1704067200.0,
                            "content": {"content_type": "text", "parts": ["Hi"]},
                            "metadata": {},
                        },
                    },
                },
            }
        ]
    }
    result = parse_chatgpt_export(payload)
    created = result[0]["created_at"]
    assert created.tzinfo is None
    assert created == datetime(2024, 1, 1, 0, 0, 0)
