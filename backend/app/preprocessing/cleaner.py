"""
Text cleaning and normalization module.

Normalizes whitespace, handles encoding issues, and optionally generates
truncated previews. Full conversation content is always preserved.
"""

from __future__ import annotations

import re
import unicodedata

from app.preprocessing.models import ProcessedConversation, ProcessedMessage

# Patterns for whitespace normalization
_EXCESSIVE_NEWLINES_RE = re.compile(r"\n{4,}")
_TRAILING_WHITESPACE_RE = re.compile(r"[ \t]+$", re.MULTILINE)
_LEADING_TRAILING_BLANK_RE = re.compile(r"^\s+|\s+$")

# Common encoding replacement characters
_REPLACEMENT_CHAR = "\ufffd"

# Default preview length in characters
DEFAULT_PREVIEW_LENGTH = 300


def normalize_unicode(text: str) -> str:
    """Normalize unicode to NFC form and strip replacement characters."""
    text = unicodedata.normalize("NFC", text)
    text = text.replace(_REPLACEMENT_CHAR, "")
    return text


def normalize_whitespace(text: str) -> str:
    """
    Normalize whitespace while preserving intentional formatting.

    - Collapses runs of 4+ newlines down to 3 (preserves paragraph breaks)
    - Strips trailing whitespace per line
    - Does NOT collapse spaces within lines (preserves code indentation)
    """
    text = _TRAILING_WHITESPACE_RE.sub("", text)
    text = _EXCESSIVE_NEWLINES_RE.sub("\n\n\n", text)
    return text


def clean_text(text: str) -> str:
    """Apply all non-destructive cleaning steps to text."""
    text = normalize_unicode(text)
    text = normalize_whitespace(text)
    return text


def generate_preview(text: str, max_length: int = DEFAULT_PREVIEW_LENGTH) -> str:
    """
    Generate a truncated preview of text for display purposes.

    Truncates at a word boundary and appends an ellipsis if needed.
    """
    # Strip leading/trailing whitespace for the preview
    preview = text.strip()
    if len(preview) <= max_length:
        return preview

    # Find last space before the limit
    truncated = preview[:max_length]
    last_space = truncated.rfind(" ")
    if last_space > max_length // 2:
        truncated = truncated[:last_space]

    return truncated.rstrip() + "..."


def clean_message(message: ProcessedMessage) -> ProcessedMessage:
    """Clean the text content of a single message."""
    message.content = clean_text(message.content)
    return message


def clean_conversation(
    conversation: ProcessedConversation,
    preview_length: int = DEFAULT_PREVIEW_LENGTH,
) -> ProcessedConversation:
    """
    Clean all messages in a conversation and generate a preview.

    Args:
        conversation: The conversation to clean.
        preview_length: Max character length for the preview field.

    Returns:
        The conversation with cleaned messages and a preview.
    """
    for msg in conversation.messages:
        clean_message(msg)

    if conversation.title:
        conversation.title = clean_text(conversation.title).strip()

    # Generate preview from the first user message
    for msg in conversation.messages:
        if msg.role == "user" and msg.content.strip():
            conversation.preview = generate_preview(
                msg.content, max_length=preview_length
            )
            break

    return conversation
