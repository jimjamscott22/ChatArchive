from __future__ import annotations

import json
from datetime import datetime
from typing import Any


def parse_copilot_export(payload: Any) -> list[dict[str, Any]]:
    """
    Parse a GitHub Copilot Chat export file into conversations with messages.
    
    Copilot exports may include:
    - VS Code chat history
    - GitHub.com chat conversations
    """
    conversations = None
    
    # Detect format
    if isinstance(payload, list):
        conversations = payload
    elif isinstance(payload, dict):
        # Check for various Copilot export formats
        conversations = (
            payload.get("conversations") or
            payload.get("sessions") or
            payload.get("chats") or
            [payload]
        )
    
    if not conversations:
        raise ValueError("Unrecognized Copilot export format")
    
    parsed = []
    for item in conversations:
        # Extract conversation metadata
        conv_id = item.get("id") or item.get("sessionId") or item.get("conversationId")
        title = item.get("title") or item.get("name") or extract_title_from_first_message(item)
        
        # Parse timestamps
        created_at = parse_timestamp(
            item.get("createdAt") or 
            item.get("created_at") or
            item.get("startTime") or
            item.get("timestamp")
        )
        updated_at = parse_timestamp(
            item.get("updatedAt") or 
            item.get("updated_at") or
            item.get("lastMessageTime")
        )
        
        # Extract messages
        messages_data = (
            item.get("messages") or
            item.get("exchanges") or
            item.get("turns") or
            []
        )
        
        messages = []
        for idx, msg in enumerate(messages_data):
            # Determine role
            role = determine_role(msg)
            
            # Get content
            content = extract_content(msg)
            if not content.strip():
                continue
            
            # Parse message timestamp
            msg_created = parse_timestamp(
                msg.get("timestamp") or
                msg.get("createdAt") or
                msg.get("created_at")
            )
            
            messages.append({
                "source_id": msg.get("id") or msg.get("messageId"),
                "role": role,
                "content": content,
                "content_type": detect_content_type(msg),
                "created_at": msg_created or created_at,
                "order_index": idx,
                "model": msg.get("model") or "copilot",
            })
        
        # If no title, generate from first user message
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
    
    # Check if it's a request vs response
    if msg.get("request") or msg.get("query") or msg.get("prompt"):
        return "user"
    
    return "assistant"


def extract_content(msg: dict[str, Any]) -> str:
    """Extract text content from Copilot message format."""
    # Try multiple possible content fields
    content = (
        msg.get("content") or
        msg.get("text") or
        msg.get("message") or
        msg.get("response") or
        msg.get("request") or
        msg.get("query") or
        ""
    )
    
    # Handle nested content structures
    if isinstance(content, dict):
        content = (
            content.get("text") or
            content.get("value") or
            content.get("content") or
            ""
        )
    elif isinstance(content, list):
        # Join multiple content parts
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
    
    # Check for code indicators
    if "```" in content or msg.get("hasCode") or msg.get("isCode"):
        return "code"
    
    return "text"


def extract_title_from_first_message(item: dict[str, Any]) -> str:
    """Extract title from the first user message."""
    messages = item.get("messages") or item.get("exchanges") or []
    
    for msg in messages:
        if determine_role(msg) == "user":
            content = extract_content(msg)
            if content:
                # Take first 60 chars
                return content[:60] + ("..." if len(content) > 60 else "")
    
    return "Untitled Conversation"


def generate_title_from_messages(messages: list[dict[str, Any]]) -> str:
    """Generate a title from the first user message."""
    for msg in messages:
        if msg.get("role") == "user":
            content = msg.get("content", "")
            if content:
                # Clean and truncate
                title = content.strip().split("\n")[0]
                return title[:60] + ("..." if len(title) > 60 else "")
    
    return "Untitled Conversation"


def parse_timestamp(timestamp: Any) -> datetime | None:
    """Parse various timestamp formats used by Copilot."""
    if not timestamp:
        return None
    
    try:
        # Try ISO format
        if isinstance(timestamp, str):
            # Handle ISO 8601 with timezone
            timestamp = timestamp.replace("Z", "+00:00")
            try:
                return datetime.fromisoformat(timestamp.replace("+00:00", ""))
            except ValueError:
                # Try other formats
                for fmt in ["%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%d %H:%M:%S"]:
                    try:
                        return datetime.strptime(timestamp.split("+")[0].split("Z")[0], fmt)
                    except ValueError:
                        continue
        # Try Unix timestamp
        elif isinstance(timestamp, (int, float)):
            if timestamp > 1e12:  # Milliseconds
                timestamp = timestamp / 1000
            return datetime.fromtimestamp(timestamp)
    except (ValueError, OSError, TypeError):
        pass
    
    return None
