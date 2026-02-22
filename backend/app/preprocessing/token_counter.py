"""
Token counting module.

Provides token estimation for conversations using tiktoken (when available)
with a character-based fallback.
"""

from __future__ import annotations

import logging

from app.preprocessing.models import ProcessedConversation, TokenMetrics

logger = logging.getLogger(__name__)

_encoder = None
_tiktoken_available = False


def _get_encoder():
    """Lazily load the tiktoken encoder."""
    global _encoder, _tiktoken_available
    if _encoder is not None:
        return _encoder

    try:
        import tiktoken

        _encoder = tiktoken.get_encoding("cl100k_base")
        _tiktoken_available = True
        logger.info("Using tiktoken cl100k_base encoding for token counting")
    except (ImportError, Exception) as e:
        logger.info(
            "tiktoken not available (%s), using character-based estimation", e
        )
        _tiktoken_available = False
        _encoder = False  # Sentinel to avoid retrying

    return _encoder


def count_tokens(text: str) -> int:
    """
    Count tokens in text.

    Uses tiktoken cl100k_base if available, otherwise estimates
    ~4 characters per token as a rough approximation.
    """
    encoder = _get_encoder()
    if encoder and encoder is not False:
        return len(encoder.encode(text))

    # Fallback: ~4 chars per token is a rough heuristic for English text
    return max(1, len(text) // 4)


def count_conversation_tokens(
    conversation: ProcessedConversation,
) -> ProcessedConversation:
    """
    Count tokens for all messages in a conversation and populate token metrics.

    Updates each message's token_count and the conversation-level token_metrics.
    """
    total = 0
    user_tokens = 0
    assistant_tokens = 0

    for msg in conversation.messages:
        tokens = count_tokens(msg.content)
        msg.token_count = tokens
        total += tokens

        if msg.role == "user":
            user_tokens += tokens
        else:
            assistant_tokens += tokens

    msg_count = len(conversation.messages)
    conversation.token_metrics = TokenMetrics(
        total_tokens=total,
        user_tokens=user_tokens,
        assistant_tokens=assistant_tokens,
        avg_tokens_per_message=round(total / msg_count, 1) if msg_count else 0.0,
    )

    return conversation
