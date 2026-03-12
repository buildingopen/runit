"""Tests for storage module."""

import json

import pytest

from runit import _storage as storage_module
from runit._storage import (
    DEFAULT_MAX_PROJECT_SIZE,
    MAX_KEY_LENGTH,
    MAX_VALUE_SIZE,
    StorageClient,
    forget,
    remember,
)


@pytest.fixture
def storage_client(monkeypatch, temp_dir):
    """Create an isolated storage client for tests."""
    monkeypatch.setenv("RUNIT_STORAGE_DIR", str(temp_dir / "storage"))
    monkeypatch.setenv(
        "RUNIT_STORAGE_MAX_PROJECT_SIZE",
        str(DEFAULT_MAX_PROJECT_SIZE),
    )
    return StorageClient()


def test_set_get_exists_list_and_delete(storage_client):
    """StorageClient should support the full CRUD lifecycle."""
    storage_client.set("profile", {"name": "Federico", "visits": 1})

    assert storage_client.exists("profile") is True
    assert storage_client.get("profile") == {"name": "Federico", "visits": 1}
    assert storage_client.list() == ["profile"]
    assert storage_client.delete("profile") is True
    assert storage_client.exists("profile") is False
    assert storage_client.get("profile") is None


def test_get_returns_default_for_missing_key(storage_client):
    """Missing keys should return the provided default."""
    assert storage_client.get("missing", default={"ok": False}) == {"ok": False}


@pytest.mark.parametrize(
    "key,expected",
    [
        ("", "Key is required"),
        ("." * (MAX_KEY_LENGTH + 1), "Key exceeds maximum length"),
        ("bad/key", "Key must contain only alphanumeric characters"),
        ("..bad", "Key must not start/end with dots or contain consecutive dots"),
        (".leading", "Key must not start/end with dots or contain consecutive dots"),
        ("trailing.", "Key must not start/end with dots or contain consecutive dots"),
    ],
)
def test_invalid_keys_raise_value_error(storage_client, key, expected):
    """Invalid storage keys should fail validation."""
    with pytest.raises(ValueError, match=expected):
        storage_client.set(key, "value")


def test_path_rejects_escape_attempt(storage_client):
    """Path resolution should reject traversal outside storage dir."""
    with pytest.raises(ValueError, match="outside storage directory"):
        storage_client._path("../escape")


def test_set_rejects_values_over_max_size(storage_client):
    """Oversized values should be rejected before writing."""
    oversized = "x" * MAX_VALUE_SIZE
    with pytest.raises(ValueError, match="exceeds maximum"):
        storage_client.set("huge", oversized)


def test_set_rejects_project_quota_overflow(monkeypatch, temp_dir):
    """Project quota should account for current usage and new writes."""
    monkeypatch.setenv("RUNIT_STORAGE_DIR", str(temp_dir / "quota-storage"))
    monkeypatch.setenv("RUNIT_STORAGE_MAX_PROJECT_SIZE", "20")
    client = StorageClient()

    client.set("small", "1234567890")
    with pytest.raises(ValueError, match="Project storage quota exceeded"):
        client.set("other", "abcdefghijk")


def test_overwrite_recalculates_usage(storage_client):
    """Overwriting an existing key should replace old size in usage accounting."""
    storage_client.set("counter", {"value": 1})
    usage_path = f"{storage_client._dir}/.usage"
    with open(usage_path, "r", encoding="utf-8") as handle:
        first_usage = int(handle.read())

    storage_client.set("counter", {"value": 123456})
    with open(usage_path, "r", encoding="utf-8") as handle:
        second_usage = int(handle.read())

    assert second_usage >= first_usage
    assert storage_client.get("counter") == {"value": 123456}


def test_list_ignores_usage_and_temp_files(storage_client):
    """Metadata and temporary files should not appear in list results."""
    storage_client._ensure_dir()
    storage_dir = storage_client._dir
    with open(f"{storage_dir}/visible", "w", encoding="utf-8") as handle:
        handle.write(json.dumps("ok"))
    with open(f"{storage_dir}/.usage", "w", encoding="utf-8") as handle:
        handle.write("0")
    with open(f"{storage_dir}/temp.tmp", "w", encoding="utf-8") as handle:
        handle.write("ignore")

    assert storage_client.list() == ["visible"]


def test_delete_missing_key_returns_false(storage_client):
    """Deleting a missing key should return False."""
    assert storage_client.delete("missing") is False


def test_compute_usage_returns_zero_for_missing_directory(storage_client):
    """Usage should be zero before storage directory exists."""
    assert storage_client._compute_usage() == 0


def test_remember_and_forget_use_singleton_storage(monkeypatch, temp_dir):
    """remember()/forget() should proxy through the module singleton."""
    monkeypatch.setenv("RUNIT_STORAGE_DIR", str(temp_dir / "remember-storage"))
    client = StorageClient()
    monkeypatch.setattr(storage_module, "storage", client)

    assert remember("greeting", {"message": "hello"}) == {"message": "hello"}
    assert remember("greeting") == {"message": "hello"}

    forget("greeting")
    assert client.get("greeting") is None
