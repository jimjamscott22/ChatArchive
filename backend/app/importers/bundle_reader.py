from __future__ import annotations

import io
import re
import stat
import zipfile
from dataclasses import dataclass
from pathlib import PurePosixPath

from app.importers.bundle_types import BundleInventoryEntry, ImportWarning


_DRIVE_PATH_RE = re.compile(r"^[A-Za-z]:")
_NESTED_ARCHIVE_SUFFIXES = (".zip", ".tar", ".tgz", ".tar.gz", ".7z", ".rar")


class BundleValidationError(ValueError):
    """Raised when an export archive violates a safety constraint."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


@dataclass(frozen=True, slots=True)
class BundleLimits:
    max_compressed_bytes: int = 100 * 1024 * 1024
    max_expanded_bytes: int = 500 * 1024 * 1024
    max_entries: int = 5_000
    max_entry_bytes: int = 50 * 1024 * 1024
    max_compression_ratio: float = 100.0


def normalize_archive_path(path: str) -> str:
    if "\x00" in path:
        raise BundleValidationError("ARCHIVE_NULL_PATH", "Archive entry contains a null byte")

    normalized_slashes = path.replace("\\", "/")
    if normalized_slashes.startswith("/") or _DRIVE_PATH_RE.match(normalized_slashes):
        raise BundleValidationError(
            "ARCHIVE_ABSOLUTE_PATH",
            f"Archive entry uses an absolute path: {path!r}",
        )

    parts = PurePosixPath(normalized_slashes).parts
    if any(part == ".." for part in parts):
        raise BundleValidationError(
            "ARCHIVE_PATH_TRAVERSAL",
            f"Archive entry traverses outside the bundle: {path!r}",
        )

    clean_parts = [part for part in parts if part not in ("", ".")]
    if not clean_parts:
        raise BundleValidationError("ARCHIVE_EMPTY_PATH", "Archive entry has an empty path")
    return "/".join(clean_parts)


class BundleReader:
    """Validated, bounded access to an in-memory provider export ZIP."""

    def __init__(
        self,
        filename: str,
        content: bytes,
        limits: BundleLimits | None = None,
    ) -> None:
        self.filename = filename
        self.limits = limits or BundleLimits()
        self.warnings: list[ImportWarning] = []
        self._counted_reads: set[str] = set()
        self._actual_expanded_bytes = 0

        if not filename.lower().endswith(".zip"):
            raise BundleValidationError("ARCHIVE_EXTENSION", "Expected a .zip export bundle")
        if len(content) > self.limits.max_compressed_bytes:
            raise BundleValidationError(
                "ARCHIVE_COMPRESSED_SIZE",
                "Archive exceeds the compressed upload limit",
            )
        if not content.startswith(b"PK"):
            raise BundleValidationError("ARCHIVE_SIGNATURE", "File is not a ZIP archive")

        self._buffer = io.BytesIO(content)
        try:
            self._archive = zipfile.ZipFile(self._buffer)
            self._infos = self._archive.infolist()
        except (OSError, zipfile.BadZipFile) as exc:
            raise BundleValidationError("ARCHIVE_INVALID", "Invalid ZIP archive") from exc

        self._validate_inventory()

    def close(self) -> None:
        self._archive.close()
        self._buffer.close()

    def __enter__(self) -> BundleReader:
        return self

    def __exit__(self, *_args: object) -> None:
        self.close()

    @property
    def inventory(self) -> list[BundleInventoryEntry]:
        return list(self._inventory)

    @property
    def paths(self) -> list[str]:
        return list(self._info_by_path)

    def find_path(self, path: str) -> str | None:
        """Find an entry by full normalized path, case-insensitively."""
        normalized = normalize_archive_path(path).casefold()
        return self._casefold_paths.get(normalized)

    def find_basename(self, filename: str) -> list[str]:
        """Return every matching basename; callers must handle ambiguity."""
        basename = PurePosixPath(filename.replace("\\", "/")).name.casefold()
        return list(self._basenames.get(basename, ()))

    def read_bytes(self, path: str, max_bytes: int | None = None) -> bytes:
        normalized = self.find_path(path)
        if normalized is None:
            raise KeyError(path)
        info = self._info_by_path[normalized]
        limit = min(
            self.limits.max_entry_bytes,
            max_bytes if max_bytes is not None else self.limits.max_entry_bytes,
        )
        if info.file_size > limit:
            raise BundleValidationError(
                "ARCHIVE_ENTRY_SIZE",
                f"Archive entry exceeds the read limit: {normalized}",
            )

        chunks: list[bytes] = []
        actual_size = 0
        try:
            with self._archive.open(info, "r") as entry:
                while True:
                    chunk = entry.read(min(1024 * 1024, limit - actual_size + 1))
                    if not chunk:
                        break
                    actual_size += len(chunk)
                    if actual_size > limit:
                        raise BundleValidationError(
                            "ARCHIVE_ENTRY_SIZE",
                            f"Archive entry exceeds the read limit: {normalized}",
                        )
                    chunks.append(chunk)
        except (RuntimeError, zipfile.BadZipFile) as exc:
            raise BundleValidationError(
                "ARCHIVE_CORRUPT_ENTRY",
                f"Archive entry failed integrity validation: {normalized}",
            ) from exc

        if actual_size != info.file_size:
            raise BundleValidationError(
                "ARCHIVE_SIZE_MISMATCH",
                f"Archive entry size differs from its manifest: {normalized}",
            )
        if normalized not in self._counted_reads:
            if self._actual_expanded_bytes + actual_size > self.limits.max_expanded_bytes:
                raise BundleValidationError(
                    "ARCHIVE_EXPANDED_SIZE",
                    "Archive exceeds the expanded data limit",
                )
            self._counted_reads.add(normalized)
            self._actual_expanded_bytes += actual_size
        return b"".join(chunks)

    def read_json(self, path: str, max_bytes: int | None = None) -> object:
        import json

        raw = self.read_bytes(path, max_bytes=max_bytes)
        try:
            return json.loads(raw.decode("utf-8-sig"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise BundleValidationError(
                "ARCHIVE_INVALID_JSON",
                f"Archive entry is not valid UTF-8 JSON: {path}",
            ) from exc

    def _validate_inventory(self) -> None:
        if len(self._infos) > self.limits.max_entries:
            raise BundleValidationError(
                "ARCHIVE_ENTRY_COUNT",
                "Archive contains too many entries",
            )

        inventory: list[BundleInventoryEntry] = []
        info_by_path: dict[str, zipfile.ZipInfo] = {}
        casefold_paths: dict[str, str] = {}
        basenames: dict[str, list[str]] = {}
        declared_expanded = 0

        for info in self._infos:
            normalized = normalize_archive_path(info.filename)
            unix_mode = (info.external_attr >> 16) & 0xFFFF
            if stat.S_ISLNK(unix_mode):
                raise BundleValidationError(
                    "ARCHIVE_SYMLINK",
                    f"Archive contains a symbolic link: {normalized}",
                )
            if info.flag_bits & 0x1:
                raise BundleValidationError(
                    "ARCHIVE_ENCRYPTED",
                    f"Archive contains an encrypted entry: {normalized}",
                )
            if info.is_dir():
                continue
            if normalized in info_by_path:
                raise BundleValidationError(
                    "ARCHIVE_DUPLICATE_PATH",
                    f"Archive contains a duplicate path: {normalized}",
                )
            if normalized.casefold() in casefold_paths:
                raise BundleValidationError(
                    "ARCHIVE_DUPLICATE_PATH",
                    f"Archive contains paths that differ only by case: {normalized}",
                )
            if info.file_size > self.limits.max_entry_bytes:
                raise BundleValidationError(
                    "ARCHIVE_ENTRY_SIZE",
                    f"Archive entry exceeds the size limit: {normalized}",
                )
            declared_expanded += info.file_size
            if declared_expanded > self.limits.max_expanded_bytes:
                raise BundleValidationError(
                    "ARCHIVE_EXPANDED_SIZE",
                    "Archive exceeds the expanded data limit",
                )
            if info.file_size:
                if not info.compress_size:
                    raise BundleValidationError(
                        "ARCHIVE_COMPRESSION_RATIO",
                        f"Archive entry has an invalid compressed size: {normalized}",
                    )
                ratio = info.file_size / info.compress_size
                if ratio > self.limits.max_compression_ratio:
                    raise BundleValidationError(
                        "ARCHIVE_COMPRESSION_RATIO",
                        f"Archive entry exceeds the compression-ratio limit: {normalized}",
                    )

            nested = normalized.casefold().endswith(_NESTED_ARCHIVE_SUFFIXES)
            if nested:
                self.warnings.append(
                    ImportWarning(
                        code="NESTED_ARCHIVE_SKIPPED",
                        message="Nested archives are inventoried but are not imported.",
                        entry=normalized,
                    )
                )
            inventory.append(
                BundleInventoryEntry(
                    path=normalized,
                    byte_size=info.file_size,
                    compressed_size=info.compress_size,
                    crc32=info.CRC,
                    is_nested_archive=nested,
                )
            )
            info_by_path[normalized] = info
            casefold_paths[normalized.casefold()] = normalized
            basename = PurePosixPath(normalized).name.casefold()
            basenames.setdefault(basename, []).append(normalized)

        self._inventory = inventory
        self._info_by_path = info_by_path
        self._casefold_paths = casefold_paths
        self._basenames = basenames
