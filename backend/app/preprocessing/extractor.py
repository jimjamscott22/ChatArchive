"""
Content extraction and segmentation module.

Identifies and extracts code blocks, tables, and artifacts from
Claude conversation messages. Preserves original formatting while
enabling structured queries.
"""

from __future__ import annotations

import re
from typing import Any

from app.preprocessing.models import (
    CodeBlock,
    ExtractedArtifact,
    ExtractedTable,
    ProcessedConversation,
    ProcessedMessage,
)

# Fenced code block: ```lang\ncode\n```
_CODE_BLOCK_RE = re.compile(
    r"```(\w+)?\s*\n(.*?)```",
    re.DOTALL,
)

# Markdown table: lines starting with |
_TABLE_ROW_RE = re.compile(r"^\|(.+)\|$", re.MULTILINE)
_TABLE_SEP_RE = re.compile(r"^\|[\s\-:|]+\|$", re.MULTILINE)

# Claude artifact tags: <antArtifact identifier="..." type="..." title="...">content</antArtifact>
_ARTIFACT_RE = re.compile(
    r"<antArtifact\b([^>]*)>(.*?)</antArtifact>",
    re.DOTALL,
)
_ATTR_RE = re.compile(r'(\w+)="([^"]*)"')


def extract_code_blocks(text: str) -> list[CodeBlock]:
    """
    Extract fenced code blocks from markdown text.

    Preserves language tags and records line positions within the text.
    """
    blocks: list[CodeBlock] = []
    for match in _CODE_BLOCK_RE.finditer(text):
        language = match.group(1) or None
        code = match.group(2).rstrip("\n")
        start = text[:match.start()].count("\n")
        end = start + code.count("\n")
        blocks.append(
            CodeBlock(language=language, code=code, start_line=start, end_line=end)
        )
    return blocks


def extract_tables(text: str) -> list[ExtractedTable]:
    """
    Extract markdown tables from text.

    Returns parsed headers and rows along with the raw markdown.
    """
    tables: list[ExtractedTable] = []
    lines = text.split("\n")
    i = 0

    while i < len(lines):
        line = lines[i].strip()
        # Look for a line that looks like a table row
        if _TABLE_ROW_RE.match(line):
            table_lines = [line]
            j = i + 1

            # Collect consecutive table lines
            while j < len(lines):
                next_line = lines[j].strip()
                if _TABLE_ROW_RE.match(next_line) or _TABLE_SEP_RE.match(next_line):
                    table_lines.append(next_line)
                    j += 1
                else:
                    break

            # Need at least header + separator + one row
            if len(table_lines) >= 3:
                raw = "\n".join(table_lines)

                # Parse header row
                header_cells = [
                    c.strip() for c in table_lines[0].strip("|").split("|")
                ]

                # Skip separator row(s), parse data rows
                rows: list[list[str]] = []
                for tl in table_lines[2:]:
                    if _TABLE_SEP_RE.match(tl):
                        continue
                    cells = [c.strip() for c in tl.strip("|").split("|")]
                    rows.append(cells)

                if rows:
                    tables.append(
                        ExtractedTable(
                            headers=header_cells, rows=rows, raw_markdown=raw
                        )
                    )

            i = j
        else:
            i += 1

    return tables


def extract_artifacts(text: str) -> list[ExtractedArtifact]:
    """Extract Claude artifacts from message content."""
    artifacts: list[ExtractedArtifact] = []
    for match in _ARTIFACT_RE.finditer(text):
        attrs_str = match.group(1)
        content = match.group(2).strip()

        attrs: dict[str, str] = {}
        for attr_match in _ATTR_RE.finditer(attrs_str):
            attrs[attr_match.group(1)] = attr_match.group(2)

        artifacts.append(
            ExtractedArtifact(
                identifier=attrs.get("identifier"),
                artifact_type=attrs.get("type"),
                title=attrs.get("title"),
                content=content,
            )
        )
    return artifacts


def extract_message_content(message: ProcessedMessage) -> ProcessedMessage:
    """
    Extract structured content from a single message.

    Populates the message's code_blocks and tables fields.
    """
    message.code_blocks = extract_code_blocks(message.content)
    message.tables = extract_tables(message.content)

    # If the message contains code blocks, mark content_type accordingly
    if message.code_blocks and not message.tables:
        message.content_type = "code"
    elif message.tables and not message.code_blocks:
        message.content_type = "text"

    return message


def extract_conversation_content(
    conversation: ProcessedConversation,
) -> ProcessedConversation:
    """
    Extract structured content from all messages in a conversation.

    Populates conversation-level code_blocks and artifacts lists.
    """
    all_code_blocks: list[CodeBlock] = []
    all_artifacts: list[ExtractedArtifact] = []

    for msg in conversation.messages:
        extract_message_content(msg)
        all_code_blocks.extend(msg.code_blocks)

        # Only extract artifacts from assistant messages
        if msg.role == "assistant":
            msg_artifacts = extract_artifacts(msg.content)
            all_artifacts.extend(msg_artifacts)

    conversation.code_blocks = all_code_blocks
    conversation.artifacts = all_artifacts

    return conversation
