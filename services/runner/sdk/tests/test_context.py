"""Tests for context module."""

import pytest
import os
import json
import tempfile
from pathlib import Path
from execution_layer.context import Context


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
    from execution_layer import context
    from execution_layer.context import Context

    assert isinstance(context, Context)
