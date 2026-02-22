"""
Conversation parsing module for Claude exports.

Parses the nested JSON structure from Claude's official export format,
extracts individual messages, and normalizes the conversation structure.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any

from app.preprocessing.models import ProcessedConversation, ProcessedMessage

logger = logging.getLogger(__name__)


def parse_timestamp(timestamp: Any) -> datetime | None:
    """Parse various timestamp formats used by Claude exports."""
    if not timestamp:
        return None

    try:
        if isinstance(timestamp, str):
            cleaned = timestamp.replace("Z", "+00:00")
            return datetime.fromisoformat(cleaned.replace("+00:00", ""))
        elif isinstance(timestamp, (int, float)):
            return datetime.fromtimestamp(timestamp)
    except (ValueError, OSError, TypeError):
        pass

    return None


def _compute_duration(messages: list[ProcessedMessage]) -> float | None:
    """Compute duration in seconds between first and last message timestamps."""
    timestamps = [m.created_at for m in messages if m.created_at is not None]
    if len(timestamps) < 2:
        return None
    timestamps.sort()
    delta = timestamps[-1] - timestamps[0]
    return delta.total_seconds()


def parse_single_conversation(item: dict[str, Any]) -> ProcessedConversation:
    """
    Parse a single conversation object from a Claude export.

    Args:
        item: A conversation dictionary from the export JSON.

    Returns:
        A ProcessedConversation with parsed messages and metadata.
    """
    conv_id = item.get("uuid") or item.get("id")
    name = item.get("name") or item.get("title")

    created_at = parse_timestamp(item.get("created_at"))
    updated_at = parse_timestamp(item.get("updated_at"))

    chat_messages = item.get("chat_messages", [])
    messages: list[ProcessedMessage] = []

    for idx, msg in enumerate(chat_messages):
        sender = msg.get("sender", "unknown")
        role = "user" if sender == "human" else "assistant"

        content = msg.get("text", "")
        if not content.strip():
            continue

        msg_created = parse_timestamp(msg.get("created_at"))

        messages.append(
            ProcessedMessage(
                source_id=msg.get("uuid") or msg.get("id"),
                role=role,
                content=content,
                content_type="text",
                created_at=msg_created,
                order_index=idx,
                model=item.get("model") or "claude",
            )
        )

    duration = _compute_duration(messages)

    return ProcessedConversation(
        source="claude",
        source_id=conv_id,
        title=name,
        created_at=created_at,
        updated_at=updated_at,
        message_count=len(messages),
        raw_json=json.dumps(item),
        messages=messages,
        duration_seconds=duration,
    )


def parse_claude_export_to_conversations(
    payload: Any,
) -> list[ProcessedConversation]:
    """
    Parse a Claude export payload into a list of ProcessedConversation objects.

    Handles multiple export formats:
    1. Array of conversation objects
    2. Single conversation object
    3. Object with 'conversations' or 'data' key

    Args:
        payload: The parsed JSON from a Claude export file.

    Returns:
        List of ProcessedConversation objects.

    Raises:
        ValueError: If the export format is not recognized.
    """
    conversations_raw: list[dict[str, Any]] | None = None

    if isinstance(payload, list):
        conversations_raw = payload
    elif isinstance(payload, dict):
        if "uuid" in payload or "created_at" in payload:
            conversations_raw = [payload]
        else:
            conversations_raw = payload.get(
                "conversations", payload.get("data")
            )

    if not conversations_raw:
        raise ValueError("Unrecognized Claude export format")

    results: list[ProcessedConversation] = []
    for idx, item in enumerate(conversations_raw):
        try:
            conv = parse_single_conversation(item)
            results.append(conv)
        except Exception:
            logger.warning("Failed to parse conversation at index %d", idx, exc_info=True)

    return results
