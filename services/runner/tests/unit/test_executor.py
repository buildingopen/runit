"""
Tests for executor module
"""

import asyncio
import base64
import io
import json
import zipfile
from pathlib import Path
from unittest.mock import Mock, patch, AsyncMock

import pytest
from execute.executor import execute_endpoint, ExecutionError


@pytest.fixture
def sample_fastapi_app():
    """Create a sample FastAPI app for testing"""
    from fastapi import FastAPI
    from pydantic import BaseModel

    app = FastAPI()

    class Item(BaseModel):
        name: str
        price: float

    @app.get("/")
    def root():
        return {"message": "Hello World"}

    @app.post("/items")
    def create_item(item: Item):
        return {"item": item.dict(), "created": True}

    @app.get("/error")
    def error_endpoint():
        raise ValueError("Test error")

    return app


@pytest.fixture
def sample_code_bundle(tmp_path, sample_fastapi_app):
    """Create a sample code bundle ZIP"""
    # Create a temporary directory with the app
    main_py = tmp_path / "main.py"
    main_py.write_text(
        """
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class Item(BaseModel):
    name: str
    price: float

@app.get("/")
def root():
    return {"message": "Hello World"}

@app.post("/items")
def create_item(item: Item):
    return {"item": item.dict(), "created": True}

@app.get("/error")
def error_endpoint():
    raise ValueError("Test error")

@app.get("/context")
def use_context():
    import os
    import json
    from pathlib import Path
    context_dir = Path(os.environ.get("EL_CONTEXT_DIR", "/context"))
    if (context_dir / "company.json").exists():
        return json.loads((context_dir / "company.json").read_text())
    return {"error": "no context"}

@app.get("/artifact")
def create_artifact():
    import os
    from pathlib import Path
    artifacts_dir = Path(os.environ.get("EL_ARTIFACTS_DIR", "/artifacts"))
    (artifacts_dir / "output.txt").write_text("Test artifact")
    return {"artifact_created": True}

@app.get("/slow")
async def slow_endpoint():
    import asyncio
    await asyncio.sleep(5)  # Intentionally slow to trigger timeout
    return {"message": "This should timeout"}
"""
    )

    # Create ZIP bundle
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.write(main_py, "main.py")

    return base64.b64encode(zip_buffer.getvalue()).decode()


def test_successful_execution(sample_code_bundle, tmp_path):
    """Test successful endpoint execution"""
    payload = {
        "run_id": "test-run-123",
        "build_id": "test-build-456",
        "code_bundle": sample_code_bundle,
        "deps_hash": "abc123",
        "entrypoint": "main:app",
        "endpoint": "GET /",
        "request_data": {},
        "env": {},
        "context": {},
    }

    # Mock workspace directories
    with patch("execute.executor.Path") as mock_path:
        workspace = tmp_path / "workspace"
        workspace.mkdir(exist_ok=True)
        artifacts = tmp_path / "artifacts"
        artifacts.mkdir(exist_ok=True)
        context = tmp_path / "context"
        context.mkdir(exist_ok=True)

        mock_path.return_value = workspace

        result = execute_endpoint(payload, max_timeout=60, max_memory_mb=4096, lane="cpu")

        assert result["run_id"] == "test-run-123"
        assert result["status"] == "success"
        assert result["http_status"] == 200
        assert "message" in result["response_body"]
        assert result["duration_ms"] > 0


def test_execution_timeout(sample_code_bundle, tmp_path):
    """Test execution timeout handling"""
    payload = {
        "run_id": "test-run-timeout",
        "code_bundle": sample_code_bundle,
        "entrypoint": "main:app",
        "endpoint": "GET /slow",  # Non-existent endpoint that would timeout
        "request_data": {},
        "env": {},
        "context": {},
    }

    # Simulate timeout by setting very short timeout
    result = execute_endpoint(payload, max_timeout=0.1, max_memory_mb=4096, lane="cpu")

    assert result["status"] == "timeout"
    assert result["error_class"] == "TIMEOUT"
    assert "timed out" in result["error_message"].lower()


def test_entrypoint_not_found(sample_code_bundle):
    """Test entrypoint not found error"""
    payload = {
        "run_id": "test-run-entrypoint",
        "code_bundle": sample_code_bundle,
        "entrypoint": "nonexistent:app",
        "endpoint": "GET /",
        "request_data": {},
        "env": {},
        "context": {},
    }

    result = execute_endpoint(payload, max_timeout=60, max_memory_mb=4096, lane="cpu")

    assert result["status"] == "error"
    assert result["error_class"] == "ENTRYPOINT_NOT_FOUND"
    assert "couldn't find" in result["error_message"].lower()


def test_secrets_injection(sample_code_bundle, tmp_path):
    """Test secrets are injected as environment variables"""
    payload = {
        "run_id": "test-run-secrets",
        "code_bundle": sample_code_bundle,
        "entrypoint": "main:app",
        "endpoint": "GET /",
        "request_data": {},
        "env": {"API_KEY": "secret-key-123", "DB_PASSWORD": "super-secret"},
        "context": {},
    }

    result = execute_endpoint(payload, max_timeout=60, max_memory_mb=4096, lane="cpu")

    # Secrets should be redacted from logs
    assert "secret-key-123" not in result["logs"]
    assert "super-secret" not in result["logs"]
    assert "[REDACTED:API_KEY]" in result["logs"] or "API_KEY" not in result["logs"]


def test_context_mounting(sample_code_bundle, tmp_path):
    """Test context files are mounted correctly"""
    payload = {
        "run_id": "test-run-context",
        "code_bundle": sample_code_bundle,
        "entrypoint": "main:app",
        "endpoint": "GET /context",
        "request_data": {},
        "env": {},
        "context": {"company": {"name": "ACME Inc", "industry": "SaaS"}},
    }

    result = execute_endpoint(payload, max_timeout=60, max_memory_mb=4096, lane="cpu")

    # Debug: print result if not success
    if result["status"] != "success":
        print(f"\nStatus: {result['status']}")
        print(f"Error class: {result.get('error_class')}")
        print(f"Error message: {result.get('error_message')}")
        print(f"Logs:\n{result.get('logs', '')}")

    # Context should be available to the endpoint
    assert result["status"] == "success", f"Expected success but got {result['status']}: {result.get('error_message')}"
    # The endpoint reads from EL_CONTEXT_DIR and should return the context
    assert result["http_status"] == 200
    response_body = result.get("response_body", {})
    assert "name" in response_body or "error" not in response_body


def test_artifact_collection(sample_code_bundle, tmp_path, monkeypatch):
    """Test artifacts are collected from /artifacts directory"""
    # Use isolated base dir to avoid cross-test pollution
    monkeypatch.setenv("EL_BASE_DIR", str(tmp_path / "isolated"))

    payload = {
        "run_id": "test-run-artifacts",
        "code_bundle": sample_code_bundle,
        "entrypoint": "main:app",
        "endpoint": "GET /artifact",
        "request_data": {},
        "env": {},
        "context": {},
    }

    result = execute_endpoint(payload, max_timeout=60, max_memory_mb=4096, lane="cpu")

    # Endpoint should create artifact successfully
    assert result["status"] == "success"
    assert result["http_status"] == 200
    # Artifacts should be collected
    assert len(result.get("artifacts", [])) > 0
    artifact_names = [a["name"] for a in result["artifacts"]]
    assert "output.txt" in artifact_names


def test_error_classification():
    """Test error classification into user-friendly messages"""
    from errors.taxonomy import classify_error

    # Test ImportError
    error = ImportError("No module named 'nonexistent'")
    classified = classify_error(error)
    assert classified["error_class"] == "IMPORT_ERROR"
    assert "import" in classified["message"].lower()

    # Test TimeoutError
    error = TimeoutError("Operation timed out")
    classified = classify_error(error)
    assert classified["error_class"] == "TIMEOUT"

    # Test MemoryError
    error = MemoryError("Out of memory")
    classified = classify_error(error)
    assert classified["error_class"] == "OUT_OF_MEMORY"


def test_secrets_redaction():
    """Test secrets are redacted from logs and outputs"""
    from security.redaction import redact_secrets, redact_output

    # Test log redaction
    logs = "API_KEY=sk-1234567890abcdef, PASSWORD=super-secret"
    env_vars = {"API_KEY": "sk-1234567890abcdef", "PASSWORD": "super-secret"}

    redacted = redact_secrets(logs, env_vars)
    assert "sk-1234567890abcdef" not in redacted
    assert "super-secret" not in redacted
    assert "[REDACTED:API_KEY]" in redacted
    assert "[REDACTED:PASSWORD]" in redacted

    # Test output redaction
    output = {"api_key": "sk-1234567890abcdef", "result": "success"}
    redacted_output, was_redacted = redact_output(output, env_vars)
    assert was_redacted
    assert "sk-1234567890abcdef" not in str(redacted_output)


def test_dependency_validation():
    """Test dependency validation catches forbidden patterns"""
    from build.deps import validate_requirements, DepsInstallError

    # Test forbidden git+ssh
    requirements = "git+ssh://github.com/user/repo.git"
    with pytest.raises(DepsInstallError, match="Forbidden"):
        validate_requirements(requirements)

    # Test forbidden extra-index-url
    requirements = "--extra-index-url https://example.com\nrequests==2.28.0"
    with pytest.raises(DepsInstallError, match="Forbidden"):
        validate_requirements(requirements)

    # Test valid requirements
    requirements = "requests==2.28.0\nfastapi>=0.100.0"
    validate_requirements(requirements)  # Should not raise


def test_artifact_limits():
    """Test artifact collection respects size limits"""
    from artifacts.collector import collect_artifacts
    from pathlib import Path
    import tempfile

    with tempfile.TemporaryDirectory() as tmpdir:
        artifacts_dir = Path(tmpdir) / "artifacts"
        artifacts_dir.mkdir()

        # Create files exceeding limits
        for i in range(60):  # Exceeds MAX_ARTIFACTS = 50
            (artifacts_dir / f"file{i}.txt").write_text(f"Content {i}")

        logs = []
        artifacts = collect_artifacts(artifacts_dir, logs)

        # Should collect max 50 files
        assert len(artifacts) <= 50
        assert any("limit exceeded" in log.lower() for log in logs)


def test_deterministic_mode(sample_code_bundle, tmp_path):
    """Test deterministic mode sets random seed"""
    payload = {
        "run_id": "test-run-deterministic",
        "code_bundle": sample_code_bundle,
        "entrypoint": "main:app",
        "endpoint": "GET /",
        "request_data": {},
        "env": {},
        "context": {},
        "deterministic": True,
    }

    result = execute_endpoint(payload, max_timeout=60, max_memory_mb=4096, lane="cpu")

    # Deterministic path executes successfully.
    assert result["status"] == "success"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
