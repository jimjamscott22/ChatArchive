from __future__ import annotations

from typing import Literal

from app.importers.bundle_reader import BundleReader, BundleValidationError
from app.importers.bundle_types import ParsedBundle
from app.importers.chatgpt_bundle import parse_chatgpt_bundle
from app.importers.claude_bundle import parse_claude_bundle


BundleSource = Literal["chatgpt", "claude"]


def parse_export_bundle(source: BundleSource | str, reader: BundleReader) -> ParsedBundle:
    if source == "chatgpt":
        return parse_chatgpt_bundle(reader)
    if source == "claude":
        return parse_claude_bundle(reader)
    raise BundleValidationError(
        "BUNDLE_SOURCE_UNSUPPORTED",
        f"Bundle imports are not supported for source: {source}",
    )
