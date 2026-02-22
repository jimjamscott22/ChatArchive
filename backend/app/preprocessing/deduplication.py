"""
Deduplication and linking module.

Detects duplicate conversations across exports using content hashing
and source ID matching. Tracks import metadata for re-import handling.
"""

from __future__ import annotations

import hashlib
import logging
from datetime import datetime

from app.preprocessing.models import ProcessedConversation

logger = logging.getLogger(__name__)


def compute_content_hash(conversation: ProcessedConversation) -> str:
    """
    Compute a SHA-256 hash of the conversation's meaningful content.

    Hashes source_id + title + sorted message contents to detect duplicates
    even when timestamps differ between exports.
    """
    hasher = hashlib.sha256()

    if conversation.source_id:
        hasher.update(conversation.source_id.encode("utf-8"))
    if conversation.title:
        hasher.update(conversation.title.encode("utf-8"))

    for msg in conversation.messages:
        hasher.update(msg.role.encode("utf-8"))
        hasher.update(msg.content.encode("utf-8"))

    return hasher.hexdigest()


def mark_content_hash(
    conversation: ProcessedConversation,
) -> ProcessedConversation:
    """Compute and set the content_hash on a conversation."""
    conversation.content_hash = compute_content_hash(conversation)
    return conversation


def deduplicate_conversations(
    new_conversations: list[ProcessedConversation],
    existing_source_ids: set[str] | None = None,
    existing_hashes: set[str] | None = None,
) -> tuple[list[ProcessedConversation], list[ProcessedConversation]]:
    """
    Deduplicate a list of conversations against existing data and within the batch.

    Args:
        new_conversations: Newly parsed conversations to check.
        existing_source_ids: Set of source_ids already in the database.
        existing_hashes: Set of content hashes already in the database.

    Returns:
        Tuple of (unique_conversations, duplicate_conversations).
    """
    existing_source_ids = existing_source_ids or set()
    existing_hashes = existing_hashes or set()

    unique: list[ProcessedConversation] = []
    duplicates: list[ProcessedConversation] = []

    seen_source_ids: set[str] = set()
    seen_hashes: set[str] = set()

    for conv in new_conversations:
        # Ensure content hash is computed
        if not conv.content_hash:
            mark_content_hash(conv)

        is_duplicate = False

        # Check by source_id
        if conv.source_id:
            if conv.source_id in existing_source_ids or conv.source_id in seen_source_ids:
                is_duplicate = True

        # Check by content hash
        if conv.content_hash:
            if conv.content_hash in existing_hashes or conv.content_hash in seen_hashes:
                is_duplicate = True

        if is_duplicate:
            duplicates.append(conv)
            logger.debug(
                "Duplicate detected: %s (source_id=%s)",
                conv.title,
                conv.source_id,
            )
        else:
            unique.append(conv)
            if conv.source_id:
                seen_source_ids.add(conv.source_id)
            if conv.content_hash:
                seen_hashes.add(conv.content_hash)

    if duplicates:
        logger.info(
            "Deduplication: %d unique, %d duplicates skipped",
            len(unique),
            len(duplicates),
        )

    return unique, duplicates
