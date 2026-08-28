"""Unit tests for import settings policy helpers (no database)."""
from __future__ import annotations

from app.import_policy import (
    filename_extension,
    import_filename_rejection,
    is_import_filename_allowed,
    is_json_import,
    parse_allowed_formats,
    should_auto_merge,
)


def test_parse_allowed_formats_splits_and_normalizes():
    assert parse_allowed_formats("json, CSV, .xml") == {"json", "csv", "xml"}
    assert parse_allowed_formats("  json  ") == {"json"}
    assert parse_allowed_formats("") == set()
    assert parse_allowed_formats(None) == set()


def test_filename_extension():
    assert filename_extension("conversations.json") == "json"
    assert filename_extension("export.JSON") == "json"
    assert filename_extension("noext") is None
    assert filename_extension(None) is None


def test_is_json_import():
    assert is_json_import("data.json") is True
    assert is_json_import("data.JSON") is True
    assert is_json_import("data.csv") is False
    assert is_json_import(None) is False


def test_is_import_filename_allowed():
    assert is_import_filename_allowed("chat.json", "json") is True
    assert is_import_filename_allowed("chat.json", "json,csv,xml") is True
    assert is_import_filename_allowed("chat.json", "csv") is False
    assert is_import_filename_allowed("chat.csv", "json,csv") is True
    assert is_import_filename_allowed("chat.csv", "json") is False


def test_import_filename_rejection_json_only_parser():
    assert import_filename_rejection("chat.json", "json") is None
    assert import_filename_rejection("chat.JSON", "json,csv") is None
    assert import_filename_rejection("chat.csv", "csv") == "Expected a .json export"
    assert import_filename_rejection("chat.xml", "json,xml") == "Expected a .json export"
    assert import_filename_rejection("chat.json", "csv") == "File format is not in allowed formats"
    assert import_filename_rejection("chat.json", "") == "File format is not in allowed formats"


def test_should_auto_merge_keep_separate_wins():
    assert should_auto_merge(True, False) is True
    assert should_auto_merge(True, True) is False
    assert should_auto_merge(False, True) is False
    assert should_auto_merge(False, False) is False
