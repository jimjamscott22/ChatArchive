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


def parse_copilot_export(payload: Any) -> list[dict[str, Any]]:
    """
    Parse a GitHub Copilot Chat export file into conversations with messages.

    Copilot exports may include:
    - VS Code chat history
    - GitHub.com chat conversations
    """
    conversations = None

    if isinstance(payload, list):
        conversations = payload
    elif isinstance(payload, dict):
        if "conversations" in payload:
            conversations = payload.get("conversations")
        elif "sessions" in payload:
            conversations = payload.get("sessions")
        elif "chats" in payload:
            conversations = payload.get("chats")
        else:
            conversations = [payload]

    if not conversations:
        raise ValueError("Unrecognized Copilot export format")

    parsed = []
    for item in conversations:
        if not isinstance(item, dict):
            continue
        conv_id = item.get("id") or item.get("sessionId") or item.get("conversationId")
        title = item.get("title") or item.get("name") or extract_title_from_first_message(item)

        created_at = parse_timestamp(
            item.get("createdAt")
            or item.get("created_at")
            or item.get("startTime")
            or item.get("timestamp")
        )
        updated_at = parse_timestamp(
            item.get("updatedAt")
            or item.get("updated_at")
            or item.get("lastMessageTime")
        )

        messages_data = _collect_copilot_messages(item)

        messages = []
        for msg in messages_data:
            if not isinstance(msg, dict):
                continue
            role = determine_role(msg)
            content = extract_content(msg, preferred_role=role)
            if not content.strip():
                continue

            msg_created = parse_timestamp(
                msg.get("timestamp") or msg.get("createdAt") or msg.get("created_at")
            )

            messages.append({
                "source_id": msg.get("id") or msg.get("messageId"),
                "role": role,
                "content": content,
                "content_type": detect_content_type(msg),
                "created_at": msg_created or created_at,
                "order_index": len(messages),
                "model": msg.get("model") or "copilot",
            })

        if not title or title == "Untitled":
            title = generate_title_from_messages(messages)

        parsed.append({
            "source": "copilot",
            "source_id": conv_id,
            "title": title,
            "created_at": created_at,
            "updated_at": updated_at,
            "message_count": len(messages),
            "raw_json": json.dumps(item),
            "messages": messages,
        })

    return parsed


def _collect_copilot_messages(item: dict[str, Any]) -> list[dict[str, Any]]:
    """Normalize VS Code `requests[]` sessions into a flat message list."""
    messages_data = _first_present(item, "messages", "exchanges", "turns")
    if isinstance(messages_data, list):
        flattened: list[dict[str, Any]] = []
        for msg in messages_data:
            if not isinstance(msg, dict):
                continue
            if (
                not msg.get("role")
                and not msg.get("author")
                and not msg.get("sender")
                and msg.get("request")
                and msg.get("response")
            ):
                flattened.append({"role": "user", "request": msg.get("request")})
                flattened.append({"role": "assistant", "response": msg.get("response")})
            else:
                flattened.append(msg)
        return flattened

    requests = item.get("requests")
    if not isinstance(requests, list):
        return []

    flattened = []
    for req in requests:
        if not isinstance(req, dict):
            continue
        user_payload = req.get("message") or req.get("request")
        if isinstance(user_payload, dict):
            user_text = user_payload.get("text") or user_payload.get("value") or ""
            if user_text:
                flattened.append({"role": "user", "content": str(user_text)})
        elif isinstance(user_payload, str) and user_payload.strip():
            flattened.append({"role": "user", "content": user_payload})

        response = req.get("response")
        if isinstance(response, list):
            parts = []
            for part in response:
                if isinstance(part, str):
                    parts.append(part)
                elif isinstance(part, dict):
                    parts.append(part.get("value") or part.get("text") or "")
            text = "\n".join(p for p in parts if p)
            if text.strip():
                flattened.append({"role": "assistant", "content": text})
        elif isinstance(response, dict):
            text = response.get("value") or response.get("text") or ""
            if text:
                flattened.append({"role": "assistant", "content": str(text)})
        elif isinstance(response, str) and response.strip():
            flattened.append({"role": "assistant", "content": response})
    return flattened


def determine_role(msg: dict[str, Any]) -> str:
    """Determine message role from Copilot message format."""
    role = msg.get("role") or msg.get("author") or msg.get("sender") or msg.get("type")

    if role:
        role_lower = str(role).lower()
        if role_lower in ("user", "human", "question"):
            return "user"
        elif role_lower in ("assistant", "copilot", "ai", "answer", "response"):
            return "assistant"
        elif role_lower in ("system", "context"):
            return "system"

    if msg.get("request") or msg.get("query") or msg.get("prompt"):
        return "user"

    return "assistant"


def extract_content(msg: dict[str, Any], preferred_role: str | None = None) -> str:
    """Extract text content from Copilot message format."""
    if preferred_role == "user":
        ordered = (
            msg.get("content"),
            msg.get("text"),
            msg.get("message"),
            msg.get("request"),
            msg.get("query"),
            msg.get("prompt"),
            msg.get("response"),
        )
    else:
        ordered = (
            msg.get("content"),
            msg.get("text"),
            msg.get("message"),
            msg.get("response"),
            msg.get("request"),
            msg.get("query"),
            msg.get("prompt"),
        )

    content: Any = ""
    for candidate in ordered:
        if candidate:
            content = candidate
            break

    if isinstance(content, dict):
        content = (
            content.get("text")
            or content.get("value")
            or content.get("content")
            or ""
        )
    elif isinstance(content, list):
        parts = []
        for part in content:
            if isinstance(part, str):
                parts.append(part)
            elif isinstance(part, dict):
                parts.append(part.get("text") or part.get("value") or "")
        content = "\n".join(parts)

    return str(content)


def detect_content_type(msg: dict[str, Any]) -> str:
    """Detect if message contains code or is plain text."""
    content = extract_content(msg)

    if "```" in content or msg.get("hasCode") or msg.get("isCode"):
        return "code"

    return "text"


def extract_title_from_first_message(item: dict[str, Any]) -> str:
    """Extract title from the first user message."""
    messages = _collect_copilot_messages(item)

    for msg in messages:
        if determine_role(msg) == "user":
            content = extract_content(msg, preferred_role="user")
            if content:
                return content[:60] + ("..." if len(content) > 60 else "")

    return "Untitled Conversation"


def generate_title_from_messages(messages: list[dict[str, Any]]) -> str:
    """Generate a title from the first user message."""
    for msg in messages:
        if msg.get("role") == "user":
            content = msg.get("content", "")
            if content:
                title = content.strip().split("\n")[0]
                return title[:60] + ("..." if len(title) > 60 else "")

    return "Untitled Conversation"


def parse_timestamp(timestamp: Any) -> datetime | None:
    """Parse various timestamp formats used by Copilot."""
    return parse_flexible_timestamp(timestamp)
