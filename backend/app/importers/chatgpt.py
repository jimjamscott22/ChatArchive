from __future__ import annotations

import json
from typing import Any

from app.importers.timestamps import parse_unix_timestamp


_CYCLE_ERROR = "Invalid ChatGPT mapping: cycle or repeated node reference"


def extract_messages_from_mapping(
    mapping: dict[str, Any],
    current_node: str | None = None,
) -> list[dict[str, Any]]:
    """Extract messages from ChatGPT's tree-based mapping.

    When ``current_node`` is present in the mapping, only that selected
    branch is imported (parent chain from the leaf to the root). Otherwise
    the last-child path from the root is used — ChatGPT typically appends
    the latest regeneration last. Sibling branches are not flattened.
    """
    if not mapping:
        return []

    path_ids = _selected_mapping_path(mapping, current_node)
    messages: list[dict[str, Any]] = []
    order = 0
    for node_id in path_ids:
        node = mapping.get(node_id)
        if not node or not isinstance(node, dict):
            continue
        message = node.get("message")
        if message and should_include_message(message):
            msg_data = parse_message(message, order)
            if msg_data:
                messages.append(msg_data)
                order += 1
    return messages


def _find_root_id(mapping: dict[str, Any]) -> str:
    for node_id, node in mapping.items():
        if not isinstance(node, dict):
            continue
        if node.get("parent") is None:
            return node_id
    return list(mapping.keys())[0]


def _selected_mapping_path(
    mapping: dict[str, Any],
    current_node: str | None,
) -> list[str]:
    if current_node and current_node in mapping:
        return _parent_chain_path(mapping, current_node)
    return _last_child_path(mapping, _find_root_id(mapping))


def _parent_chain_path(mapping: dict[str, Any], leaf_id: str) -> list[str]:
    chain: list[str] = []
    visited: set[str] = set()
    node_id: Any = leaf_id
    while node_id:
        if node_id in visited:
            raise ValueError(_CYCLE_ERROR)
        visited.add(node_id)
        chain.append(node_id)
        node = mapping.get(node_id)
        if not node or not isinstance(node, dict):
            break
        parent = node.get("parent")
        if parent is None:
            break
        node_id = parent
    chain.reverse()
    return chain


def _last_child_path(mapping: dict[str, Any], root_id: str) -> list[str]:
    path: list[str] = []
    visited: set[str] = set()
    current_id: Any = root_id
    while current_id:
        if current_id in visited:
            raise ValueError(_CYCLE_ERROR)
        visited.add(current_id)
        path.append(current_id)
        node = mapping.get(current_id)
        if not node or not isinstance(node, dict):
            break
        children = node.get("children") or []
        if not isinstance(children, list) or not children:
            break
        current_id = children[-1]
    return path


def should_include_message(message: dict[str, Any]) -> bool:
    """Determine if a message should be included (skip hidden system messages)."""
    if not message or not isinstance(message, dict):
        return False

    metadata = message.get("metadata") or {}
    if not isinstance(metadata, dict):
        metadata = {}

    # Skip visually hidden messages
    if metadata.get("is_visually_hidden_from_conversation"):
        return False

    content = message.get("content")
    if not isinstance(content, dict):
        content = {}
    content_type = content.get("content_type", "")

    # Skip certain content types that aren't displayable
    if content_type in ("user_editable_context", "system_error"):
        return False

    author = message.get("author") or {}
    if not isinstance(author, dict):
        author = {}
    role = author.get("role", "")

    # Include user and assistant messages
    if role in ("user", "assistant"):
        return True

    # Include tool messages (for function calls)
    if role == "tool":
        return True

    return False


def _extract_text_content(content: dict[str, Any]) -> str:
    """Pull readable text from ChatGPT content.parts, dict parts, or content.text."""
    texts: list[str] = []
    parts = content.get("parts") or []
    if isinstance(parts, list):
        for part in parts:
            if isinstance(part, str):
                if part.strip():
                    texts.append(part)
            elif isinstance(part, dict):
                nested = part.get("text") or part.get("transcript") or ""
                if nested:
                    texts.append(str(nested))
    if texts:
        return "\n".join(texts)

    raw_text = content.get("text")
    if isinstance(raw_text, str):
        return raw_text
    return ""


def parse_message(message: dict[str, Any], order: int) -> dict[str, Any] | None:
    """Parse a single message into our normalized format."""
    if not message or not isinstance(message, dict):
        return None

    author = message.get("author") or {}
    if not isinstance(author, dict):
        author = {}
    role = author.get("role", "unknown")

    content = message.get("content")
    if not isinstance(content, dict):
        content = {}
    content_type = content.get("content_type", "text")

    text_content = _extract_text_content(content)
    if not text_content.strip():
        if content_type in ("image", "multimodal_text"):
            text_content = "[image]"
        else:
            return None

    created_at = None
    create_time = message.get("create_time")
    if create_time:
        created_at = parse_unix_timestamp(create_time)

    metadata = message.get("metadata") or {}
    if not isinstance(metadata, dict):
        metadata = {}
    model = metadata.get("model_slug")

    return {
        "source_id": message.get("id"),
        "role": role,
        "content": text_content,
        "content_type": content_type,
        "created_at": created_at,
        "order_index": order,
        "model": model,
    }


def parse_chatgpt_export(payload: Any) -> list[dict[str, Any]]:
    """Parse a ChatGPT export file into conversations with messages."""
    conversations = None
    if isinstance(payload, dict):
        conversations = payload.get("conversations")
    elif isinstance(payload, list):
        conversations = payload

    if conversations is None:
        raise ValueError("Unrecognized ChatGPT export format")

    parsed = []
    for item in conversations:
        if not isinstance(item, dict):
            continue
        title = item.get("title")

        created_at = parse_unix_timestamp(item["create_time"]) if item.get("create_time") is not None else None
        updated_at = parse_unix_timestamp(item["update_time"]) if item.get("update_time") is not None else None

        mapping = item.get("mapping") or {}
        if not isinstance(mapping, dict):
            mapping = {}
        messages = extract_messages_from_mapping(
            mapping,
            current_node=item.get("current_node"),
        )

        parsed.append({
            "source": "chatgpt",
            "source_id": item.get("id") or item.get("conversation_id"),
            "title": title,
            "created_at": created_at,
            "updated_at": updated_at,
            "message_count": len(messages),
            "raw_json": json.dumps(item),
            "messages": messages,
        })

    return parsed
