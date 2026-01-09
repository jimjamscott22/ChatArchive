from __future__ import annotations

import json
from datetime import datetime
from typing import Any


def parse_gemini_export(payload: Any) -> list[dict[str, Any]]:
    """
    Parse a Gemini/Bard export file into conversations with messages.
    
    Google Takeout format typically has conversations in a structured format.
    Gemini exports may include:
    - conversations array
    - individual chat history items
    """
    conversations = None
    
    # Detect format
    if isinstance(payload, list):
        conversations = payload
    elif isinstance(payload, dict):
        # Check for various Google export formats
        conversations = (
            payload.get("conversations") or 
            payload.get("chats") or
            payload.get("history") or
            [payload]
        )
    
    if not conversations:
        raise ValueError("Unrecognized Gemini export format")
    
    parsed = []
    for item in conversations:
        # Extract conversation metadata
        conv_id = item.get("id") or item.get("conversation_id")
        title = item.get("title") or item.get("name") or "Untitled"
        
        # Parse timestamps
        created_at = parse_timestamp(
            item.get("create_time") or 
            item.get("created_at") or 
            item.get("timestamp")
        )
        updated_at = parse_timestamp(
            item.get("update_time") or 
            item.get("updated_at")
        )
        
        # Extract messages - handle multiple possible structures
        messages_data = (
            item.get("messages") or 
            item.get("turns") or 
            item.get("content") or
            []
        )
        
        messages = []
        for idx, msg in enumerate(messages_data):
            # Determine role
            role = determine_role(msg)
            
            # Get content - Gemini may use different keys
            content = extract_content(msg)
            if not content.strip():
                continue
            
            # Parse message timestamp
            msg_created = parse_timestamp(
                msg.get("timestamp") or 
                msg.get("created_at") or
                msg.get("create_time")
            )
            
            messages.append({
                "source_id": msg.get("id") or msg.get("message_id"),
                "role": role,
                "content": content,
                "content_type": "text",
                "created_at": msg_created or created_at,
                "order_index": idx,
                "model": msg.get("model") or item.get("model") or "gemini",
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


def determine_role(msg: dict[str, Any]) -> str:
    """Determine message role from various Gemini message formats."""
    # Check common role fields
    role = msg.get("role") or msg.get("author") or msg.get("sender")
    
    if role:
        role_lower = str(role).lower()
        if role_lower in ("user", "human"):
            return "user"
        elif role_lower in ("model", "assistant", "ai", "gemini", "bard"):
            return "assistant"
    
    # Fallback: check if it's marked as user content
    if msg.get("user_input") or msg.get("prompt"):
        return "user"
    
    return "assistant"


def extract_content(msg: dict[str, Any]) -> str:
    """Extract text content from various Gemini message formats."""
    # Try multiple possible content fields
    content = (
        msg.get("text") or
        msg.get("content") or
        msg.get("message") or
        msg.get("prompt") or
        msg.get("response") or
        ""
    )
    
    # Handle nested content structures
    if isinstance(content, dict):
        content = content.get("text") or content.get("parts", [""])[0]
    elif isinstance(content, list):
        # Join multiple parts
        content = "\n".join(str(part) for part in content if part)
    
    return str(content)


def parse_timestamp(timestamp: Any) -> datetime | None:
    """Parse various timestamp formats used by Gemini."""
    if not timestamp:
        return None
    
    try:
        # Try ISO format
        if isinstance(timestamp, str):
            # Handle various ISO formats
            timestamp = timestamp.replace("Z", "+00:00")
            for fmt in ["%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S"]:
                try:
                    return datetime.strptime(timestamp.split("+")[0], fmt)
                except ValueError:
                    continue
        # Try Unix timestamp (seconds or milliseconds)
        elif isinstance(timestamp, (int, float)):
            if timestamp > 1e12:  # Likely milliseconds
                timestamp = timestamp / 1000
            return datetime.fromtimestamp(timestamp)
    except (ValueError, OSError, TypeError):
        pass
    
    return None
