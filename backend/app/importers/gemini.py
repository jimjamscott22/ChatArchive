from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from app.importers.timestamps import parse_flexible_timestamp


def _first_present(payload: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        if key in payload and payload[key] is not None:
            return payload[key]
    return None


def parse_gemini_export(payload: Any) -> list[dict[str, Any]]:
    """
    Parse a Gemini/Bard export file into conversations with messages.

    Google Takeout format typically has conversations in a structured format.
    Gemini exports may include:
    - conversations array
    - individual chat history items
    """
    conversations = None

    if isinstance(payload, list):
        conversations = payload
    elif isinstance(payload, dict):
        # Use `in` so an explicit empty array is not treated as missing.
        if "conversations" in payload:
            conversations = payload.get("conversations")
        elif "chats" in payload:
            conversations = payload.get("chats")
        elif "history" in payload:
            conversations = payload.get("history")
        else:
            conversations = [payload]

    if not conversations:
        raise ValueError("Unrecognized Gemini export format")

    parsed = []
    for item in conversations:
        if not isinstance(item, dict):
            continue
        conv_id = item.get("id") or item.get("conversation_id")
        title = item.get("title") or item.get("name") or "Untitled"

        created_at = parse_timestamp(
            item.get("create_time")
            or item.get("created_at")
            or item.get("timestamp")
            or item.get("time")
        )
        updated_at = parse_timestamp(
            item.get("update_time") or item.get("updated_at")
        )

        messages_data = _first_present(item, "messages", "turns", "content")
        if not isinstance(messages_data, list):
            messages_data = []

        messages = []
        for msg in messages_data:
            if not isinstance(msg, dict):
                continue
            for role, content, msg_created, msg_id, model in _iter_gemini_messages(msg, item, created_at):
                messages.append({
                    "source_id": msg_id,
                    "role": role,
                    "content": content,
                    "content_type": "text",
                    "created_at": msg_created,
                    "order_index": len(messages),
                    "model": model,
                })

        parsed.append({
            "source": "gemini",
            "source_id": conv_id,
            "title": title,
            "created_at": created_at,
            "updated_at": updated_at,
            "message_count": len(messages),
            "raw_json": json.dumps(item),
            "messages": messages,
        })

    return parsed


def _iter_gemini_messages(
    msg: dict[str, Any],
    item: dict[str, Any],
    fallback_created: datetime | None,
) -> list[tuple[str, str, datetime | None, Any, Any]]:
    """Yield (role, content, created_at, source_id, model) for a turn."""
    model = msg.get("model") or item.get("model") or "gemini"
    msg_created = parse_timestamp(
        msg.get("timestamp") or msg.get("created_at") or msg.get("create_time")
    ) or fallback_created
    msg_id = msg.get("id") or msg.get("message_id")

    prompt = msg.get("prompt") or msg.get("user_input")
    response = msg.get("response")
    if isinstance(prompt, str) and prompt.strip() and isinstance(response, str) and response.strip():
        return [
            ("user", prompt.strip(), msg_created, msg_id, model),
            ("assistant", response.strip(), msg_created, msg_id, model),
        ]

    role = determine_role(msg)
    content = extract_content(msg)
    if not content.strip():
        return []
    return [(role, content, msg_created, msg_id, model)]


def determine_role(msg: dict[str, Any]) -> str:
    """Determine message role from various Gemini message formats."""
    role = msg.get("role") or msg.get("author") or msg.get("sender")

    if role:
        role_lower = str(role).lower()
        if role_lower in ("user", "human"):
            return "user"
        elif role_lower in ("model", "assistant", "ai", "gemini", "bard"):
            return "assistant"

    if msg.get("user_input") or msg.get("prompt"):
        return "user"

    return "assistant"


def _join_parts(parts: Any) -> str:
    if not isinstance(parts, list) or not parts:
        return ""
    texts: list[str] = []
    for part in parts:
        if isinstance(part, str):
            if part.strip():
                texts.append(part)
        elif isinstance(part, dict):
            nested = part.get("text") or part.get("value") or ""
            if nested:
                texts.append(str(nested))
    return "\n".join(texts)


def extract_content(msg: dict[str, Any]) -> str:
    """Extract text content from various Gemini message formats."""
    if msg.get("user_input"):
        return str(msg.get("user_input") or "")
    if "parts" in msg:
        joined = _join_parts(msg.get("parts"))
        if joined:
            return joined

    content = (
        msg.get("text")
        or msg.get("content")
        or msg.get("message")
        or msg.get("prompt")
        or msg.get("response")
        or ""
    )

    if isinstance(content, dict):
        nested_text = content.get("text")
        if nested_text:
            return str(nested_text)
        return _join_parts(content.get("parts"))
    if isinstance(content, list):
        return _join_parts(content)

    return str(content)


def parse_timestamp(timestamp: Any) -> datetime | None:
    """Parse various timestamp formats used by Gemini."""
    return parse_flexible_timestamp(timestamp)
