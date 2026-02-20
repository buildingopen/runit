"""
Tests for SDK context helpers
"""

import importlib.util
import json
import tempfile
from pathlib import Path

import pytest


@pytest.fixture
def sdk_context_module(monkeypatch):
    """Create temporary context directory for testing"""
    with tempfile.TemporaryDirectory() as tmpdir:
        context_dir = Path(tmpdir) / "context"
        context_dir.mkdir()

        sdk_context_path = (
            Path(__file__).resolve().parents[3] / "packages" / "sdk" / "src" / "context.py"
        )
        spec = importlib.util.spec_from_file_location("runtime_ai_sdk_context_for_tests", sdk_context_path)
        if spec is None or spec.loader is None:
            raise RuntimeError(f"Cannot load SDK context module from {sdk_context_path}")
        context_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(context_module)

        monkeypatch.setattr(context_module, "CONTEXT_DIR", context_dir)

        # Create some test context files
        company_data = {"name": "ACME Inc", "industry": "SaaS"}
        with open(context_dir / "company.json", "w") as f:
            json.dump(company_data, f)

        prefs_data = {"theme": "dark", "language": "en"}
        with open(context_dir / "prefs.json", "w") as f:
            json.dump(prefs_data, f)

        yield context_module


def test_get_context(sdk_context_module):
    """Test getting context data"""
    company = sdk_context_module.get_context("company")

    assert company["name"] == "ACME Inc"
    assert company["industry"] == "SaaS"


def test_get_context_not_found(sdk_context_module):
    """Test error when context not found"""
    with pytest.raises(sdk_context_module.ContextNotFoundError, match="not found"):
        sdk_context_module.get_context("nonexistent")


def test_list_contexts(sdk_context_module):
    """Test listing available contexts"""
    contexts = sdk_context_module.list_contexts()

    assert "company" in contexts
    assert "prefs" in contexts
    assert len(contexts) == 2


def test_has_context(sdk_context_module):
    """Test checking if context exists"""
    assert sdk_context_module.has_context("company") is True
    assert sdk_context_module.has_context("prefs") is True
    assert sdk_context_module.has_context("nonexistent") is False


def test_get_context_path(sdk_context_module):
    """Test getting context file path"""
    path = sdk_context_module.get_context_path("company")
    assert path is not None
    assert path.exists()
    assert path.name == "company.json"

    nonexistent_path = sdk_context_module.get_context_path("nonexistent")
    assert nonexistent_path is None
