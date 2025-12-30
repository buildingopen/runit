"""
Tests for SDK context helpers
"""

import json
import tempfile
from pathlib import Path

import pytest


@pytest.fixture
def temp_context_dir(monkeypatch):
    """Create temporary context directory for testing"""
    with tempfile.TemporaryDirectory() as tmpdir:
        context_dir = Path(tmpdir) / "context"
        context_dir.mkdir()

        # Patch the CONTEXT_DIR in the SDK
        import sys

        sys.path.insert(0, str(Path(__file__).parent.parent.parent / "packages" / "sdk" / "src"))

        import context as context_module

        monkeypatch.setattr(context_module, "CONTEXT_DIR", context_dir)

        # Create some test context files
        company_data = {"name": "ACME Inc", "industry": "SaaS"}
        with open(context_dir / "company.json", "w") as f:
            json.dump(company_data, f)

        prefs_data = {"theme": "dark", "language": "en"}
        with open(context_dir / "prefs.json", "w") as f:
            json.dump(prefs_data, f)

        yield context_dir


def test_get_context(temp_context_dir):
    """Test getting context data"""
    from context import get_context

    company = get_context("company")

    assert company["name"] == "ACME Inc"
    assert company["industry"] == "SaaS"


def test_get_context_not_found(temp_context_dir):
    """Test error when context not found"""
    from context import get_context, ContextNotFoundError

    with pytest.raises(ContextNotFoundError, match="not found"):
        get_context("nonexistent")


def test_list_contexts(temp_context_dir):
    """Test listing available contexts"""
    from context import list_contexts

    contexts = list_contexts()

    assert "company" in contexts
    assert "prefs" in contexts
    assert len(contexts) == 2


def test_has_context(temp_context_dir):
    """Test checking if context exists"""
    from context import has_context

    assert has_context("company") is True
    assert has_context("prefs") is True
    assert has_context("nonexistent") is False


def test_get_context_path(temp_context_dir):
    """Test getting context file path"""
    from context import get_context_path

    path = get_context_path("company")
    assert path is not None
    assert path.exists()
    assert path.name == "company.json"

    nonexistent_path = get_context_path("nonexistent")
    assert nonexistent_path is None
