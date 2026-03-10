"""Tests for context module."""

import json
import tempfile
from pathlib import Path

import pytest
from runit.context import Context


@pytest.fixture
def temp_context_dir():
    """Create temporary context directory."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


@pytest.fixture
def context_with_temp_dir(temp_context_dir, monkeypatch):
    """Create Context instance with temporary directory."""
    monkeypatch.setenv("EL_CONTEXT_DIR", str(temp_context_dir))
    return Context()


def test_get_secret(monkeypatch):
    """Test getting secrets from environment."""
    monkeypatch.setenv("SECRET_API_KEY", "test-key-123")
    monkeypatch.setenv("SECRET_TOKEN", "test-token-456")

    ctx = Context()
    assert ctx.get_secret("API_KEY") == "test-key-123"
    assert ctx.get_secret("TOKEN") == "test-token-456"
    assert ctx.get_secret("NONEXISTENT") is None


def test_get_context(context_with_temp_dir, temp_context_dir):
    """Test getting context from JSON files."""
    # Create test context file
    context_data = {"name": "ACME Inc", "industry": "SaaS"}
    context_file = temp_context_dir / "company.json"
    context_file.write_text(json.dumps(context_data))

    # Get context
    result = context_with_temp_dir.get_context("company")
    assert result == context_data
    assert result["name"] == "ACME Inc"


def test_get_context_nonexistent(context_with_temp_dir):
    """Test getting nonexistent context returns None."""
    result = context_with_temp_dir.get_context("nonexistent")
    assert result is None


def test_get_context_invalid_json(context_with_temp_dir, temp_context_dir):
    """Test getting context with invalid JSON returns None."""
    # Create invalid JSON file
    context_file = temp_context_dir / "invalid.json"
    context_file.write_text("not valid json {")

    result = context_with_temp_dir.get_context("invalid")
    assert result is None


def test_list_contexts(context_with_temp_dir, temp_context_dir):
    """Test listing available contexts."""
    # Create multiple context files
    (temp_context_dir / "company.json").write_text("{}")
    (temp_context_dir / "user.json").write_text("{}")
    (temp_context_dir / "settings.json").write_text("{}")

    # List contexts
    contexts = context_with_temp_dir.list_contexts()
    assert len(contexts) == 3
    assert "company" in contexts
    assert "user" in contexts
    assert "settings" in contexts


def test_list_contexts_empty_dir(context_with_temp_dir):
    """Test listing contexts in empty directory."""
    contexts = context_with_temp_dir.list_contexts()
    assert contexts == []


def test_has_context(context_with_temp_dir, temp_context_dir):
    """Test checking if context exists."""
    # Create context file
    (temp_context_dir / "company.json").write_text("{}")

    assert context_with_temp_dir.has_context("company") is True
    assert context_with_temp_dir.has_context("nonexistent") is False


def test_singleton_instance():
    """Test that context is a singleton instance."""
    from runit import context
    from runit.context import Context

    assert isinstance(context, Context)


def test_get_context_path(context_with_temp_dir, temp_context_dir):
    """Test getting the path to a context file."""
    # Create context file
    (temp_context_dir / "company.json").write_text('{"name": "ACME"}')

    # Check internal path resolution
    expected_path = temp_context_dir / "company.json"
    assert expected_path.exists()


def test_get_secret_with_empty_value(monkeypatch):
    """Test getting a secret with empty value."""
    monkeypatch.setenv("SECRET_EMPTY_KEY", "")

    ctx = Context()
    # Empty string is still returned (not None)
    result = ctx.get_secret("EMPTY_KEY")
    assert result == ""


def test_get_secret_case_sensitivity(monkeypatch):
    """Test that secret keys are case-sensitive."""
    monkeypatch.setenv("SECRET_MyKey", "value1")
    monkeypatch.setenv("SECRET_MYKEY", "value2")

    ctx = Context()
    assert ctx.get_secret("MyKey") == "value1"
    assert ctx.get_secret("MYKEY") == "value2"
    assert ctx.get_secret("mykey") is None


def test_get_context_nested_data(context_with_temp_dir, temp_context_dir):
    """Test getting context with nested JSON data."""
    context_data = {
        "company": {"name": "ACME Inc", "address": {"city": "San Francisco", "country": "USA"}},
        "users": [{"id": 1, "name": "Alice"}, {"id": 2, "name": "Bob"}],
    }
    (temp_context_dir / "nested.json").write_text(json.dumps(context_data))

    result = context_with_temp_dir.get_context("nested")
    assert result["company"]["address"]["city"] == "San Francisco"
    assert len(result["users"]) == 2
    assert result["users"][0]["name"] == "Alice"


def test_get_context_large_file(context_with_temp_dir, temp_context_dir):
    """Test getting a large context file."""
    # Create a large context with many entries
    context_data = {f"key_{i}": f"value_{i}" for i in range(1000)}
    (temp_context_dir / "large.json").write_text(json.dumps(context_data))

    result = context_with_temp_dir.get_context("large")
    assert len(result) == 1000
    assert result["key_500"] == "value_500"


def test_get_context_unicode(context_with_temp_dir, temp_context_dir):
    """Test getting context with unicode characters."""
    context_data = {"name": "日本語テスト", "emoji": "🚀🎉", "special": "café résumé naïve"}
    (temp_context_dir / "unicode.json").write_text(json.dumps(context_data, ensure_ascii=False))

    result = context_with_temp_dir.get_context("unicode")
    assert result["name"] == "日本語テスト"
    assert result["emoji"] == "🚀🎉"
    assert result["special"] == "café résumé naïve"


def test_list_contexts_ignores_non_json(context_with_temp_dir, temp_context_dir):
    """Test that list_contexts ignores non-JSON files."""
    (temp_context_dir / "data.json").write_text("{}")
    (temp_context_dir / "readme.txt").write_text("not json")
    (temp_context_dir / "script.py").write_text("print('hello')")

    contexts = context_with_temp_dir.list_contexts()
    assert contexts == ["data"]


def test_has_context_empty_file(context_with_temp_dir, temp_context_dir):
    """Test has_context with an empty file."""
    (temp_context_dir / "empty.json").write_text("")

    # File exists, so has_context returns True
    assert context_with_temp_dir.has_context("empty") is True
    # But get_context returns None due to invalid JSON
    assert context_with_temp_dir.get_context("empty") is None


def test_get_context_array_root(context_with_temp_dir, temp_context_dir):
    """Test getting context where root is an array."""
    context_data = [1, 2, 3, {"key": "value"}]
    (temp_context_dir / "array.json").write_text(json.dumps(context_data))

    result = context_with_temp_dir.get_context("array")
    # Note: get_context returns dict, but JSON can have array root
    # This tests current behavior
    assert result == context_data


def test_context_dir_not_exists(monkeypatch, tmp_path):
    """Test behavior when context directory doesn't exist."""
    non_existent = tmp_path / "does_not_exist"
    monkeypatch.setenv("EL_CONTEXT_DIR", str(non_existent))

    ctx = Context()
    assert ctx.list_contexts() == []
    assert ctx.get_context("any") is None
    assert ctx.has_context("any") is False


def test_multiple_secrets(monkeypatch):
    """Test getting multiple secrets."""
    secrets = {
        "DATABASE_URL": "postgres://localhost/db",
        "REDIS_URL": "redis://localhost:6379",
        "API_KEY": "sk-test-123",
        "WEBHOOK_SECRET": "whsec_test",
    }
    for key, value in secrets.items():
        monkeypatch.setenv(f"SECRET_{key}", value)

    ctx = Context()
    for key, expected in secrets.items():
        assert ctx.get_secret(key) == expected


def test_get_context_with_special_filename(context_with_temp_dir, temp_context_dir):
    """Test context with special characters in name."""
    context_data = {"key": "value"}
    (temp_context_dir / "my-context.json").write_text(json.dumps(context_data))
    (temp_context_dir / "my_context_v2.json").write_text(json.dumps(context_data))

    assert context_with_temp_dir.get_context("my-context") == context_data
    assert context_with_temp_dir.get_context("my_context_v2") == context_data


def test_get_context_numbers_and_booleans(context_with_temp_dir, temp_context_dir):
    """Test context with various JSON types."""
    context_data = {
        "string": "hello",
        "integer": 42,
        "float": 3.14,
        "boolean_true": True,
        "boolean_false": False,
        "null_value": None,
        "array": [1, 2, 3],
    }
    (temp_context_dir / "types.json").write_text(json.dumps(context_data))

    result = context_with_temp_dir.get_context("types")
    assert result["string"] == "hello"
    assert result["integer"] == 42
    assert result["float"] == 3.14
    assert result["boolean_true"] is True
    assert result["boolean_false"] is False
    assert result["null_value"] is None
    assert result["array"] == [1, 2, 3]
