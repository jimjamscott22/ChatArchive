"""
Main preprocessing pipeline orchestrator.

Composes the individual preprocessing steps into a configurable pipeline
with progress tracking, error handling, and dry-run support.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Callable

from pydantic import BaseModel

from app.preprocessing.classifier import classify_conversation
from app.preprocessing.cleaner import clean_conversation
from app.preprocessing.deduplication import (
    deduplicate_conversations,
    mark_content_hash,
)
from app.preprocessing.extractor import extract_conversation_content
from app.preprocessing.models import (
    ImportResult,
    PipelineProgress,
    ProcessedConversation,
)
from app.preprocessing.parser import parse_claude_export_to_conversations
from app.preprocessing.token_counter import count_conversation_tokens

logger = logging.getLogger(__name__)


class PipelineConfig(BaseModel):
    """Configuration for the preprocessing pipeline."""

    # Toggle individual pipeline steps
    enable_cleaning: bool = True
    enable_extraction: bool = True
    enable_classification: bool = True
    enable_token_counting: bool = True
    enable_deduplication: bool = True

    # Cleaning options
    preview_length: int = 300

    # Deduplication data (source IDs and hashes from existing DB)
    existing_source_ids: set[str] = set()
    existing_hashes: set[str] = set()

    # Dry-run: process everything but return results without committing
    dry_run: bool = False

    model_config = {"arbitrary_types_allowed": True}


# Type for progress callback
ProgressCallback = Callable[[PipelineProgress], None] | None


def _process_single(
    conversation: ProcessedConversation,
    config: PipelineConfig,
) -> ProcessedConversation:
    """Run all enabled pipeline steps on a single conversation."""
    if config.enable_cleaning:
        clean_conversation(conversation, preview_length=config.preview_length)

    if config.enable_extraction:
        extract_conversation_content(conversation)

    if config.enable_classification:
        classify_conversation(conversation)

    if config.enable_token_counting:
        count_conversation_tokens(conversation)

    # Always compute content hash (needed for deduplication check)
    mark_content_hash(conversation)

    return conversation


def process_export(
    payload: Any,
    config: PipelineConfig | None = None,
    progress_callback: ProgressCallback = None,
) -> ImportResult:
    """
    Run the full preprocessing pipeline on a Claude export payload.

    Args:
        payload: Parsed JSON from a Claude export file.
        config: Pipeline configuration. Uses defaults if None.
        progress_callback: Optional callback for progress updates.

    Returns:
        ImportResult with processed conversations and statistics.
    """
    if config is None:
        config = PipelineConfig()

    result = ImportResult()

    # --- Stage 1: Parse ---
    if progress_callback:
        progress_callback(PipelineProgress(stage="parsing", message="Parsing export file..."))

    try:
        conversations = parse_claude_export_to_conversations(payload)
    except ValueError as e:
        result.errors.append(f"Parsing failed: {e}")
        return result

    result.total_conversations = len(conversations)

    if not conversations:
        return result

    # --- Stage 2: Process each conversation ---
    processed: list[ProcessedConversation] = []
    for idx, conv in enumerate(conversations):
        if progress_callback:
            progress_callback(
                PipelineProgress(
                    stage="processing",
                    current=idx + 1,
                    total=len(conversations),
                    message=f"Processing: {conv.title or 'Untitled'}",
                )
            )

        try:
            _process_single(conv, config)
            processed.append(conv)
        except Exception as e:
            logger.warning(
                "Failed to process conversation %s: %s",
                conv.source_id,
                e,
                exc_info=True,
            )
            result.errors.append(
                f"Failed to process '{conv.title or conv.source_id}': {e}"
            )
            result.failed_conversations += 1

    # --- Stage 3: Deduplicate ---
    if config.enable_deduplication:
        if progress_callback:
            progress_callback(
                PipelineProgress(stage="deduplication", message="Checking for duplicates...")
            )

        unique, duplicates = deduplicate_conversations(
            processed,
            existing_source_ids=config.existing_source_ids,
            existing_hashes=config.existing_hashes,
        )
        result.skipped_duplicates = len(duplicates)
        processed = unique

    # --- Done ---
    result.processed_conversations = len(processed)
    result.conversations = processed

    if progress_callback:
        progress_callback(
            PipelineProgress(
                stage="complete",
                current=len(processed),
                total=result.total_conversations,
                message=f"Done. {len(processed)} conversations processed.",
            )
        )

    return result


async def process_export_async(
    payload: Any,
    config: PipelineConfig | None = None,
    progress_callback: ProgressCallback = None,
) -> ImportResult:
    """
    Async wrapper for process_export.

    Runs the CPU-bound processing in a thread pool executor so it
    doesn't block the event loop during large imports.
    """
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(
        None, process_export, payload, config, progress_callback
    )


class PreprocessingPipeline:
    """
    High-level pipeline interface for use in FastAPI endpoints.

    Provides a stateful wrapper around process_export with
    convenience methods for common operations.
    """

    def __init__(self, config: PipelineConfig | None = None):
        self.config = config or PipelineConfig()
        self._progress: PipelineProgress | None = None

    def _on_progress(self, progress: PipelineProgress) -> None:
        self._progress = progress
        logger.info(
            "[%s] %s (%d/%d)",
            progress.stage,
            progress.message,
            progress.current,
            progress.total,
        )

    @property
    def progress(self) -> PipelineProgress | None:
        return self._progress

    def run(self, payload: Any) -> ImportResult:
        """Run the pipeline synchronously."""
        return process_export(
            payload, config=self.config, progress_callback=self._on_progress
        )

    async def run_async(self, payload: Any) -> ImportResult:
        """Run the pipeline asynchronously."""
        return await process_export_async(
            payload, config=self.config, progress_callback=self._on_progress
        )

    def dry_run(self, payload: Any) -> ImportResult:
        """Preview what would be imported without committing."""
        original = self.config.dry_run
        self.config.dry_run = True
        try:
            return self.run(payload)
        finally:
            self.config.dry_run = original
