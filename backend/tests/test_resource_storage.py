from types import SimpleNamespace

import pytest
from storage3.exceptions import StorageApiError

from app import storage


@pytest.mark.parametrize("code,status", [
    ("Duplicate", 400), ("KeyAlreadyExists", 409),
    ("ResourceAlreadyExists", "409"), ("already_exists", 409),
])
def test_duplicate_resource_upload_reuses_content_addressed_path(monkeypatch, code, status):
    objects = {}

    def upload(*, path, file, file_options):
        if path in objects:
            raise StorageApiError("The resource already exists", code, status)
        objects[path] = file

    bucket = SimpleNamespace(upload=upload)
    client = SimpleNamespace(storage=SimpleNamespace(from_=lambda name: bucket))
    monkeypatch.setattr(storage, "is_supabase_configured", lambda: True)
    monkeypatch.setattr(storage, "get_supabase_client", lambda: client)

    first = storage.upload_resource_file(7, "content-hash", "file.txt", b"same", "text/plain")
    second = storage.upload_resource_file(7, "content-hash", "file.txt", b"same", "text/plain")

    assert first["success"] is True
    assert second == first
    assert objects[first["path"]] == b"same"
    assert len(objects) == 1


@pytest.mark.parametrize("error", [
    StorageApiError("Access denied", "AccessDenied", 403),
    StorageApiError("Conflict", "InvalidState", 409),
    RuntimeError("Network unavailable"),
])
def test_resource_upload_does_not_hide_other_failures(monkeypatch, error):
    def upload(**kwargs):
        raise error

    bucket = SimpleNamespace(upload=upload)
    client = SimpleNamespace(storage=SimpleNamespace(from_=lambda name: bucket))
    monkeypatch.setattr(storage, "is_supabase_configured", lambda: True)
    monkeypatch.setattr(storage, "get_supabase_client", lambda: client)

    result = storage.upload_resource_file(7, "hash", "file.txt", b"data", "text/plain")
    assert result["success"] is False
    assert "path" not in result
