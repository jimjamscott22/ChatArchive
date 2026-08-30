from __future__ import annotations


SUPPORTED_IMPORT_FORMATS = frozenset({"json"})


def parse_allowed_formats(value: str | None) -> set[str]:
    """Split a comma-separated allowlist into lowercase extensions."""
    if not value:
        return set()
    formats: set[str] = set()
    for token in value.split(","):
        cleaned = token.strip().lower().lstrip(".")
        if cleaned:
            formats.add(cleaned)
    return formats


def filename_extension(filename: str | None) -> str | None:
    if not filename or "." not in filename:
        return None
    ext = filename.rsplit(".", 1)[-1].strip().lower()
    return ext or None


def is_json_import(filename: str | None) -> bool:
    return filename_extension(filename) == "json"


def is_import_filename_allowed(filename: str | None, allowed_formats: str | None) -> bool:
    ext = filename_extension(filename)
    if not ext:
        return False
    return ext in parse_allowed_formats(allowed_formats)


def import_filename_rejection(
    filename: str | None,
    allowed_formats: str | None,
) -> str | None:
    """Return a 400 detail if the upload should be rejected, else None.

    JSON is the only implemented parser. ``allowed_formats`` still gates
    whether a ``.json`` file is accepted.
    """
    if not is_json_import(filename):
        return "Expected a .json export"
    if not is_import_filename_allowed(filename, allowed_formats):
        return "File format is not in allowed formats"
    return None


def should_auto_merge(auto_merge_duplicates: bool, keep_separate: bool) -> bool:
    """Merge only when auto-merge is on and keep-separate is off."""
    return bool(auto_merge_duplicates) and not bool(keep_separate)
