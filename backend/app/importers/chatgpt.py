from __future__ import annotations

import json
from datetime import datetime
from typing import Any


def extract_messages_from_mapping(mapping: dict[str, Any]) -> list[dict[str, Any]]:
    """
    Extract messages from ChatGPT's tree-based mapping structure.
    Traverses parent->child relationships to get messages in order.
    """
    if not mapping:
        return []
    
    # Build the message chain by following parent-child relationships
    messages = []
    
    # Find root node (has no parent or parent is null)
    root_id = None
    for node_id, node in mapping.items():
        if node.get("parent") is None:
            root_id = node_id
            break
    
    if not root_id:
        # Fallback: just iterate through all nodes
        root_id = list(mapping.keys())[0]
    
    # Traverse the tree depth-first
    def traverse(node_id: str, order: int) -> int:
        node = mapping.get(node_id)
        if not node:
            return order
        
        message = node.get("message")
        if message and should_include_message(message):
            msg_data = parse_message(message, order)
            if msg_data:
                messages.append(msg_data)
                order += 1
        
        # Follow children
        for child_id in node.get("children", []):
            order = traverse(child_id, order)
        
        return order
    
    traverse(root_id, 0)
    return messages


def should_include_message(message: dict[str, Any]) -> bool:
    """Determine if a message should be included (skip hidden system messages)."""
    if not message:
        return False
    
    metadata = message.get("metadata", {})
    
    # Skip visually hidden messages
    if metadata.get("is_visually_hidden_from_conversation"):
        return False
    
    # Get content
    content = message.get("content", {})
    content_type = content.get("content_type", "")
    
    # Skip certain content types that aren't displayable
    if content_type in ("user_editable_context", "system_error"):
        return False
    
    # Get author role
    author = message.get("author", {})
    role = author.get("role", "")
    
    # Include user and assistant messages
    if role in ("user", "assistant"):
        return True
    
    # Include tool messages (for function calls)
    if role == "tool":
        return True
    
    return False


def parse_message(message: dict[str, Any], order: int) -> dict[str, Any] | None:
    """Parse a single message into our normalized format."""
    author = message.get("author", {})
    role = author.get("role", "unknown")
    
    content = message.get("content", {})
    content_type = content.get("content_type", "text")
    
    # Extract text content
    parts = content.get("parts", [])
    text_content = ""
    if parts:
        # Join all text parts
        text_parts = [p for p in parts if isinstance(p, str)]
        text_content = "\n".join(text_parts)
    
    # Skip empty messages
    if not text_content.strip():
        return None
    
    # Parse timestamp
    create_time = message.get("create_time")
    created_at = None
    if create_time:
        try:
            created_at = datetime.fromtimestamp(create_time)
        except (OSError, TypeError, ValueError):
            pass
    
    # Extract model info
    metadata = message.get("metadata", {})
    model = metadata.get("model_slug")
    
    return {
        "source_id": message.get("id"),
        "role": role,
        "content": text_content,
        "content_type": content_type if content_type == "text" else content_type,
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
        title = item.get("title")
        
        # Parse timestamps
        create_time = item.get("create_time")
        update_time = item.get("update_time")
        
        created_at = None
        if create_time is not None:
            try:
                created_at = datetime.fromtimestamp(create_time)
            except (OSError, TypeError, ValueError):
                pass
        
        updated_at = None
        if update_time is not None:
            try:
                updated_at = datetime.fromtimestamp(update_time)
            except (OSError, TypeError, ValueError):
                pass
        
        # Extract messages from mapping
        mapping = item.get("mapping", {})
        messages = extract_messages_from_mapping(mapping)
        
        parsed.append({
            "source": "chatgpt",
            "source_id": item.get("id") or item.get("conversation_id"),
            "title": title,
            "created_at": created_at,
            "updated_at": updated_at,
            "message_count": len(messages),
            "raw_json": json.dumps(item),
            "messages": messages,  # Include parsed messages
        })
    
    return parsed
