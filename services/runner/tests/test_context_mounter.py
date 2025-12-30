"""
Integration tests for context mounter
"""

import json
import os
import tempfile
from pathlib import Path

import pytest


# Mock the CONTEXT_DIR for testing
@pytest.fixture
def temp_context_dir(monkeypatch):
    with tempfile.TemporaryDirectory() as tmpdir:
        context_dir = Path(tmpdir) / "context"
        context_dir.mkdir()

        # Patch the CONTEXT_DIR in the mounter module
        import sys

        sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

        from context import mounter

        monkeypatch.setattr(mounter, "CONTEXT_DIR", context_dir)

        yield context_dir


def test_write_context_files(temp_context_dir):
    """Test writing context data to files"""
    from context.mounter import write_context_files

    context_data = {
        "company": {"name": "ACME Inc", "industry": "SaaS"},
        "user_prefs": {"theme": "dark", "language": "en"},
    }

    write_context_files(context_data)

    # Check files exist
    assert (temp_context_dir / "company.json").exists()
    assert (temp_context_dir / "user_prefs.json").exists()

    # Check file contents
    with open(temp_context_dir / "company.json") as f:
        company_data = json.load(f)
        assert company_data["name"] == "ACME Inc"
        assert company_data["industry"] == "SaaS"

    # Check file is read-only
    stat_info = os.stat(temp_context_dir / "company.json")
    assert oct(stat_info.st_mode)[-3:] == "444"


def test_context_size_validation(temp_context_dir):
    """Test context size limit enforcement"""
    from context.mounter import write_context_files, ContextMountError

    # Create context data exceeding 1MB
    large_data = {"data": "x" * (1024 * 1024 + 1)}

    with pytest.raises(ContextMountError, match="exceeds.*byte limit"):
        write_context_files({"large": large_data})


def test_invalid_context_name(temp_context_dir):
    """Test validation of context names"""
    from context.mounter import write_context_files, ContextMountError

    invalid_context = {"invalid name!": {"data": "test"}}

    with pytest.raises(ContextMountError, match="Invalid context name"):
        write_context_files(invalid_context)


def test_mount_context_from_dict(temp_context_dir):
    """Test mounting context from dictionary"""
    from context.mounter import mount_context

    context_data = {"company": {"name": "ACME Inc"}}

    mounted = mount_context(context_data)

    assert "company" in mounted
    assert mounted["company"].exists()
    assert mounted["company"].name == "company.json"


def test_mount_context_from_json_string(temp_context_dir):
    """Test mounting context from JSON string"""
    from context.mounter import mount_context

    context_json = json.dumps({"company": {"name": "ACME Inc"}})

    mounted = mount_context(context_json)

    assert "company" in mounted
    assert mounted["company"].exists()


def test_list_available_contexts(temp_context_dir):
    """Test listing available contexts"""
    from context.mounter import write_context_files, list_available_contexts

    context_data = {
        "company": {"name": "ACME"},
        "prefs": {"theme": "dark"},
    }

    write_context_files(context_data)

    contexts = list_available_contexts()

    assert "company" in contexts
    assert "prefs" in contexts
    assert len(contexts) == 2


def test_get_context_env_var():
    """Test getting context directory env var"""
    from context.mounter import get_context_env_var

    env_var = get_context_env_var()
    assert env_var == "/context"
