"""Pytest configuration and fixtures for SDK tests."""

import json
import tempfile
from pathlib import Path

import pytest


@pytest.fixture
def temp_dir():
    """Create a temporary directory for testing."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


@pytest.fixture
def temp_context_dir(temp_dir):
    """Create temporary context directory."""
    context_dir = temp_dir / "context"
    context_dir.mkdir()
    yield context_dir


@pytest.fixture
def temp_artifacts_dir(temp_dir):
    """Create temporary artifacts directory."""
    artifacts_dir = temp_dir / "artifacts"
    artifacts_dir.mkdir()
    yield artifacts_dir


@pytest.fixture
def sample_context_data():
    """Sample context data for testing."""
    return {
        "company": {"name": "ACME Inc", "industry": "SaaS", "founded": 2020},
        "contacts": [
            {"name": "Alice", "email": "alice@acme.com"},
            {"name": "Bob", "email": "bob@acme.com"},
        ],
    }


@pytest.fixture
def sample_artifact_data():
    """Sample artifact data (bytes) for testing."""
    return b"Sample artifact content for testing purposes."


@pytest.fixture
def mock_environment(monkeypatch, temp_context_dir, temp_artifacts_dir):
    """Set up mock environment variables for testing."""
    monkeypatch.setenv("EL_CONTEXT_DIR", str(temp_context_dir))
    monkeypatch.setenv("EL_ARTIFACTS_DIR", str(temp_artifacts_dir))
    monkeypatch.setenv("SECRET_API_KEY", "test-api-key-123")
    monkeypatch.setenv("SECRET_DATABASE_URL", "postgres://localhost/test")
    return {"context_dir": temp_context_dir, "artifacts_dir": temp_artifacts_dir}


def create_context_file(context_dir: Path, name: str, data: dict) -> Path:
    """Helper to create a context file."""
    path = context_dir / f"{name}.json"
    path.write_text(json.dumps(data))
    return path


def create_artifact_file(artifacts_dir: Path, name: str, data: bytes) -> Path:
    """Helper to create an artifact file."""
    path = artifacts_dir / name
    path.write_bytes(data)
    return path
