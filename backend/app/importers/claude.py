from __future__ import annotations

import json
from datetime import datetime
from typing import Any


def parse_claude_export(payload: Any) -> list[dict[str, Any]]:
    """
    Parse a Claude export file into conversations with messages.
    
    Claude exports can be in different formats:
    1. Array of conversation objects
    2. Single conversation object
    3. Object with 'conversations' key
    """
    conversations = None
    
    # Detect format
    if isinstance(payload, list):
        conversations = payload
    elif isinstance(payload, dict):
        # Check if it's a single conversation or has a conversations array
        if "uuid" in payload or "created_at" in payload:
            conversations = [payload]
        else:
            conversations = payload.get("conversations", payload.get("data", []))
    
    if not conversations:
        raise ValueError("Unrecognized Claude export format")
    
    parsed = []
    for item in conversations:
        # Extract conversation metadata
        conv_id = item.get("uuid") or item.get("id")
        name = item.get("name") or item.get("title")
        
        # Parse timestamps
        created_at = parse_timestamp(item.get("created_at"))
        updated_at = parse_timestamp(item.get("updated_at"))
        
        # Extract messages
        chat_messages = item.get("chat_messages", [])
        messages = []
        
        for idx, msg in enumerate(chat_messages):
            # Claude messages have text content and sender
            sender = msg.get("sender", "unknown")
            role = "user" if sender == "human" else "assistant"

            # Build content from structured content blocks if available,
            # otherwise fall back to the flat "text" field (which replaces
            # artifacts/tool-use blocks with "not supported" placeholders).
            content_blocks = msg.get("content", [])
            if content_blocks and isinstance(content_blocks, list):
                content = _extract_content_from_blocks(content_blocks)
            else:
                content = msg.get("text", "")

            if not content.strip():
                continue
            
            # Parse message timestamp
            msg_created = parse_timestamp(msg.get("created_at"))
            
            messages.append({
                "source_id": msg.get("uuid") or msg.get("id"),
                "role": role,
                "content": content,
                "content_type": "text",
                "created_at": msg_created,
                "order_index": idx,
                "model": item.get("model") or "claude",
            })
        
        parsed.append({
            "source": "claude",
            "source_id": conv_id,
            "title": name,
            "created_at": created_at,
            "updated_at": updated_at,
            "message_count": len(messages),
            "raw_json": json.dumps(item),
            "messages": messages,
        })
    
    return parsed


def _extract_content_from_blocks(blocks: list[dict]) -> str:
    """
    Reconstruct readable message content from Claude's structured
    content blocks, replacing the flat 'text' field which substitutes
    artifact / tool-use blocks with "not supported" placeholders.
    """
    parts: list[str] = []

    for block in blocks:
        if not isinstance(block, dict):
            continue
        block_type = block.get("type")

        if block_type == "text":
            text = block.get("text", "").strip()
            if text:
                parts.append(text)

        elif block_type == "thinking":
            # Extended-thinking blocks — include as collapsed context
            text = block.get("thinking", "").strip()
            if text:
                parts.append(f"<details><summary>Thinking</summary>\n\n{text}\n</details>")

        elif block_type == "tool_use":
            name = block.get("name", "unknown_tool")
            inp = block.get("input", {})

            if name == "artifacts":
                # Artifact blocks carry the actual generated content
                title = inp.get("title", "Artifact")
                lang = _artifact_type_to_lang(inp.get("type", ""))
                artifact_content = inp.get("content", "")
                if artifact_content:
                    parts.append(f"**{title}**\n```{lang}\n{artifact_content}\n```")
            elif name == "web_search":
                query = inp.get("query", "")
                parts.append(f"*Searched the web: \"{query}\"*")
            else:
                # Generic tool use — show a brief summary
                message = block.get("message")
                if message:
                    parts.append(f"*{message}*")

        # tool_result and token_budget blocks are skipped — they don't
        # contain user-facing content worth preserving.

    return "\n\n".join(parts)


def _artifact_type_to_lang(artifact_type: str) -> str:
    """Map Claude artifact MIME types to Markdown code-fence languages."""
    mapping = {
        "application/vnd.ant.code": "",
        "application/vnd.ant.react": "jsx",
        "text/html": "html",
        "text/css": "css",
        "text/javascript": "javascript",
        "application/json": "json",
        "text/markdown": "markdown",
        "text/x-python": "python",
        "image/svg+xml": "svg",
    }
    return mapping.get(artifact_type, "")


def parse_timestamp(timestamp: Any) -> datetime | None:
    """Parse various timestamp formats used by Claude."""
    if not timestamp:
        return None
    
    try:
        # Try ISO format first
        if isinstance(timestamp, str):
            # Remove timezone suffix if present
            timestamp = timestamp.replace("Z", "+00:00")
            return datetime.fromisoformat(timestamp.replace("+00:00", ""))
        # Try Unix timestamp
        elif isinstance(timestamp, (int, float)):
            return datetime.fromtimestamp(timestamp)
    except (ValueError, OSError, TypeError):
        pass
    
    return None
