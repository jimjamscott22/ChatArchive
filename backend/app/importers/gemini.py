from __future__ import annotations

import json
import re
from datetime import datetime
from typing import Any

from app.importers.timestamps import parse_flexible_timestamp

_ACTIVITY_MARKER_KEYS = (
    "header",
    "products",
    "details",
    "userInteractions",
    "titleUrl",
    "activityControls",
)
_REQUEST_DETAIL_NAMES = frozenset({"request", "prompt", "query", "user input", "user_input"})
_RESPONSE_DETAIL_NAMES = frozenset({"response", "answer", "reply", "model"})
_GENERIC_ACTIVITY_TITLES = frozenset({
    "used gemini apps",
    "used gemini",
    "gemini",
    "gemini apps",
    "bard",
    "untitled",
})
_TITLE_PROMPT_PREFIXES = (
    "Prompted Gemini Apps to ",
    "Prompted Gemini to ",
    "Asked Gemini Apps about ",
    "Asked Gemini Apps to ",
    "Asked Gemini about ",
    "Asked Gemini to ",
    "Used Gemini Apps to ",
)
_APP_ID_RE = re.compile(r"/app/(?:c/)?([^/?#]+)", re.IGNORECASE)
_UNGROUPED_PREFIX = "_ungrouped_"


def _first_present(payload: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        if key in payload and payload[key] is not None:
            return payload[key]
    return None


def parse_gemini_export(payload: Any) -> list[dict[str, Any]]:
    """
    Parse a Gemini/Bard export file into conversations with messages.

    Supports conversation-shaped exports (messages / turns / content) and
    Google Takeout Gemini Apps Activity event logs (MyActivity.json).
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

    conversation_items: list[dict[str, Any]] = []
    activity_items: list[dict[str, Any]] = []
    for item in conversations:
        if not isinstance(item, dict):
            continue
        if _looks_like_apps_activity(item):
            activity_items.append(item)
        else:
            conversation_items.append(item)

    parsed = [_parse_conversation_item(item) for item in conversation_items]
    parsed.extend(_parse_apps_activity_items(activity_items))
    return parsed


def _looks_like_apps_activity(item: dict[str, Any]) -> bool:
    chat_list = _first_present(item, "messages", "turns", "content")
    if isinstance(chat_list, list):
        return False
    if any(key in item for key in _ACTIVITY_MARKER_KEYS):
        return True
    return _title_heuristic_prompt(item.get("title")) is not None


def _parse_conversation_item(item: dict[str, Any]) -> dict[str, Any]:
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

    return {
        "source": "gemini",
        "source_id": conv_id,
        "title": title,
        "created_at": created_at,
        "updated_at": updated_at,
        "message_count": len(messages),
        "raw_json": json.dumps(item),
        "messages": messages,
    }


def _conversation_id_from_title_url(url: Any) -> str | None:
    if not isinstance(url, str) or not url.strip():
        return None
    match = _APP_ID_RE.search(url)
    if match:
        return match.group(1)
    return None


def _parse_apps_activity_items(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    groups: dict[str, list[dict[str, Any]]] = {}
    order: list[str] = []
    ungrouped = 0

    for item in items:
        conv_id = _conversation_id_from_title_url(item.get("titleUrl"))
        if not conv_id:
            ungrouped += 1
            conv_id = f"{_UNGROUPED_PREFIX}{ungrouped}"
        if conv_id not in groups:
            groups[conv_id] = []
            order.append(conv_id)
        groups[conv_id].append(item)

    parsed: list[dict[str, Any]] = []
    for key in order:
        events = groups[key]
        events.sort(key=_activity_sort_key)
        source_id = None if key.startswith(_UNGROUPED_PREFIX) else key
        messages: list[dict[str, Any]] = []
        title = "Untitled"
        created_at: datetime | None = None
        updated_at: datetime | None = None

        for event in events:
            event_messages = _messages_from_activity(event)
            event_created = parse_timestamp(event.get("time"))
            for role, content in event_messages:
                messages.append({
                    "source_id": None,
                    "role": role,
                    "content": content,
                    "content_type": "text",
                    "created_at": event_created,
                    "order_index": len(messages),
                    "model": "gemini",
                })
            if event_created:
                if created_at is None or event_created < created_at:
                    created_at = event_created
                if updated_at is None or event_created > updated_at:
                    updated_at = event_created
            candidate = _activity_title(event, event_messages)
            if candidate and (title == "Untitled" or _is_generic_activity_title(title)):
                title = candidate

        raw_payload: Any = events[0] if len(events) == 1 else events
        parsed.append({
            "source": "gemini",
            "source_id": source_id,
            "title": title,
            "created_at": created_at,
            "updated_at": updated_at,
            "message_count": len(messages),
            "raw_json": json.dumps(raw_payload),
            "messages": messages,
        })
    return parsed


def _activity_sort_key(item: dict[str, Any]) -> datetime:
    parsed = parse_timestamp(item.get("time"))
    if parsed is None:
        return datetime.min
    return parsed.replace(tzinfo=None) if parsed.tzinfo else parsed


def _messages_from_activity(item: dict[str, Any]) -> list[tuple[str, str]]:
    details = _messages_from_details(item.get("details"))
    if details:
        return details

    interactions = _messages_from_user_interactions(item.get("userInteractions"))
    if interactions:
        return interactions

    prompt = _title_heuristic_prompt(item.get("title"))
    if prompt:
        return [("user", prompt)]
    return []


def _messages_from_details(details: Any) -> list[tuple[str, str]]:
    if not isinstance(details, list):
        return []
    extracted: list[tuple[str, str]] = []
    for entry in details:
        if not isinstance(entry, dict):
            continue
        name = str(entry.get("name") or "").strip().lower()
        value = entry.get("value")
        if not isinstance(value, str) or not value.strip():
            continue
        if name in _REQUEST_DETAIL_NAMES:
            extracted.append(("user", value.strip()))
        elif name in _RESPONSE_DETAIL_NAMES:
            extracted.append(("assistant", value.strip()))
    return extracted


def _messages_from_user_interactions(interactions: Any) -> list[tuple[str, str]]:
    if not isinstance(interactions, list):
        return []
    extracted: list[tuple[str, str]] = []
    for entry in interactions:
        payload = _coerce_interaction_payload(entry)
        if not payload:
            continue
        request = _interaction_text(payload.get("request") or payload.get("prompt"))
        response = _interaction_text(payload.get("response"))
        if request:
            extracted.append(("user", request))
        if response:
            extracted.append(("assistant", response))
    return extracted


def _coerce_interaction_payload(entry: Any) -> dict[str, Any] | None:
    payload: Any = entry
    if isinstance(payload, str):
        payload = _try_json_object(payload)
    if not isinstance(payload, dict):
        return None
    inner = payload.get("userInteraction")
    if isinstance(inner, dict):
        return inner
    if isinstance(inner, str):
        parsed = _try_json_object(inner)
        if parsed:
            return parsed
    return payload


def _try_json_object(value: str) -> dict[str, Any] | None:
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return None
    return parsed if isinstance(parsed, dict) else None


def _interaction_text(value: Any) -> str:
    if isinstance(value, str):
        stripped = value.strip()
        if stripped.startswith("{") or stripped.startswith("["):
            parsed_obj = _try_json_object(stripped)
            if parsed_obj:
                nested = _interaction_text(parsed_obj)
                if nested:
                    return nested
        return stripped
    if isinstance(value, dict):
        for key in ("text", "prompt", "value", "content", "message"):
            inner = value.get(key)
            if isinstance(inner, str) and inner.strip():
                return inner.strip()
    return ""


def _title_heuristic_prompt(title: Any) -> str | None:
    if not isinstance(title, str) or not title.strip():
        return None
    stripped = title.strip()
    lower = stripped.lower()
    for prefix in _TITLE_PROMPT_PREFIXES:
        if lower.startswith(prefix.lower()):
            rest = stripped[len(prefix):].strip()
            return rest or None
    return None


def _is_generic_activity_title(title: str) -> bool:
    return title.strip().lower() in _GENERIC_ACTIVITY_TITLES


def _activity_title(event: dict[str, Any], messages: list[tuple[str, str]]) -> str:
    raw_title = event.get("title")
    if isinstance(raw_title, str) and raw_title.strip() and not _is_generic_activity_title(raw_title):
        heuristic = _title_heuristic_prompt(raw_title)
        if heuristic:
            return heuristic[:255]
        return raw_title.strip()[:255]
    for role, content in messages:
        if role == "user" and content.strip():
            return content.strip()[:255]
    if isinstance(raw_title, str) and raw_title.strip():
        return raw_title.strip()[:255]
    return "Untitled"


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
