from __future__ import annotations

import io
import stat
import struct
import zipfile

import pytest

from app.importers.bundle_reader import (
    BundleLimits,
    BundleReader,
    BundleValidationError,
    normalize_archive_path,
)


def make_zip(
    entries: list[tuple[str | zipfile.ZipInfo, bytes]],
    compression: int = zipfile.ZIP_DEFLATED,
) -> bytes:
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", compression=compression) as archive:
        for name, content in entries:
            archive.writestr(name, content)
    return output.getvalue()


def assert_rejected(content: bytes, code: str, **kwargs: object) -> None:
    with pytest.raises(BundleValidationError) as exc_info:
        BundleReader("export.zip", content, **kwargs)
    assert exc_info.value.code == code


def test_inventory_and_case_insensitive_lookup() -> None:
    content = make_zip(
        [
            ("Data/Conversations.JSON", b"[]"),
            ("one/asset.png", b"first"),
            ("two/asset.png", b"second"),
        ]
    )
    with BundleReader("export.ZIP", content) as reader:
        assert reader.find_path("data/conversations.json") == "Data/Conversations.JSON"
        assert reader.find_basename("ASSET.PNG") == ["one/asset.png", "two/asset.png"]
        assert reader.read_json("DATA/CONVERSATIONS.JSON") == []
        assert [entry.path for entry in reader.inventory] == [
            "Data/Conversations.JSON",
            "one/asset.png",
            "two/asset.png",
        ]


@pytest.mark.parametrize(
    ("path", "code"),
    [
        ("../secret.txt", "ARCHIVE_PATH_TRAVERSAL"),
        ("folder\\..\\secret.txt", "ARCHIVE_PATH_TRAVERSAL"),
        ("/etc/passwd", "ARCHIVE_ABSOLUTE_PATH"),
        ("C:\\secret.txt", "ARCHIVE_ABSOLUTE_PATH"),
        ("safe/\x00bad.txt", "ARCHIVE_NULL_PATH"),
    ],
)
def test_unsafe_paths_are_rejected(path: str, code: str) -> None:
    if "\x00" in path:
        with pytest.raises(BundleValidationError) as exc_info:
            normalize_archive_path(path)
        assert exc_info.value.code == code
        return
    assert_rejected(make_zip([(path, b"x")]), code)


def test_symbolic_link_is_rejected() -> None:
    info = zipfile.ZipInfo("link")
    info.create_system = 3
    info.external_attr = (stat.S_IFLNK | 0o777) << 16
    assert_rejected(make_zip([(info, b"target")]), "ARCHIVE_SYMLINK")


def test_encrypted_flag_is_rejected() -> None:
    content = bytearray(make_zip([("secret.txt", b"secret")]))
    local_offset = content.index(b"PK\x03\x04")
    central_offset = content.index(b"PK\x01\x02")
    local_flags = struct.unpack_from("<H", content, local_offset + 6)[0] | 0x1
    central_flags = struct.unpack_from("<H", content, central_offset + 8)[0] | 0x1
    struct.pack_into("<H", content, local_offset + 6, local_flags)
    struct.pack_into("<H", content, central_offset + 8, central_flags)
    assert_rejected(bytes(content), "ARCHIVE_ENCRYPTED")


def test_limits_are_enforced_during_inventory() -> None:
    three_entries = make_zip([("1", b"a"), ("2", b"b"), ("3", b"c")])
    assert_rejected(
        three_entries,
        "ARCHIVE_ENTRY_COUNT",
        limits=BundleLimits(max_entries=2),
    )

    large_entry = make_zip([("large.txt", b"12345")], compression=zipfile.ZIP_STORED)
    assert_rejected(
        large_entry,
        "ARCHIVE_ENTRY_SIZE",
        limits=BundleLimits(max_entry_bytes=4),
    )
    assert_rejected(
        large_entry,
        "ARCHIVE_EXPANDED_SIZE",
        limits=BundleLimits(max_entry_bytes=10, max_expanded_bytes=4),
    )


def test_compression_ratio_is_enforced() -> None:
    compressed = make_zip([("bomb.txt", b"0" * 10_000)])
    assert_rejected(
        compressed,
        "ARCHIVE_COMPRESSION_RATIO",
        limits=BundleLimits(max_compression_ratio=2),
    )


def test_bounded_read_is_enforced() -> None:
    with BundleReader("export.zip", make_zip([("file.txt", b"12345")])) as reader:
        with pytest.raises(BundleValidationError) as exc_info:
            reader.read_bytes("file.txt", max_bytes=4)
        assert exc_info.value.code == "ARCHIVE_ENTRY_SIZE"


def test_nested_archive_is_warned_and_not_opened() -> None:
    nested = make_zip([("inside.txt", b"do not inspect")])
    with BundleReader("export.zip", make_zip([("backup.zip", nested)])) as reader:
        assert reader.inventory[0].is_nested_archive is True
        assert [warning.code for warning in reader.warnings] == [
            "NESTED_ARCHIVE_SKIPPED"
        ]


def test_corrupt_entry_is_rejected_when_read() -> None:
    content = bytearray(
        make_zip([("plain.txt", b"unique-payload")], compression=zipfile.ZIP_STORED)
    )
    payload_offset = content.index(b"unique-payload")
    content[payload_offset] ^= 0xFF

    with BundleReader("export.zip", bytes(content)) as reader:
        with pytest.raises(BundleValidationError) as exc_info:
            reader.read_bytes("plain.txt")
        assert exc_info.value.code == "ARCHIVE_CORRUPT_ENTRY"


def test_invalid_extension_signature_and_json_are_rejected() -> None:
    valid_zip = make_zip([("data.json", b"{bad")])
    with pytest.raises(BundleValidationError) as extension_error:
        BundleReader("export.json", valid_zip)
    assert extension_error.value.code == "ARCHIVE_EXTENSION"

    assert_rejected(b"not a zip", "ARCHIVE_SIGNATURE")

    with BundleReader("export.zip", valid_zip) as reader:
        with pytest.raises(BundleValidationError) as json_error:
            reader.read_json("data.json")
        assert json_error.value.code == "ARCHIVE_INVALID_JSON"
