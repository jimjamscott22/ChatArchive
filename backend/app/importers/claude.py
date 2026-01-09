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
            
            # Get content
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
