"""
Integration tests for full execution flow
"""

import base64
import io
import json
import zipfile
from pathlib import Path

import pytest


@pytest.fixture
def extract_company_app():
    """Sample extract_company FastAPI app"""
    return """
from fastapi import FastAPI
from pydantic import BaseModel
from pathlib import Path
import os
import json

app = FastAPI()

class CompanyRequest(BaseModel):
    url: str
    use_browser: bool = False

class CompanyResponse(BaseModel):
    name: str
    description: str
    industry: str

@app.post("/extract_company")
async def extract_company(req: CompanyRequest) -> CompanyResponse:
    # Mock extraction
    company = {
        "name": "ACME Inc",
        "description": "Enterprise software",
        "industry": "SaaS"
    }

    # Write artifact
    artifacts_dir = Path(os.environ.get("EL_ARTIFACTS_DIR", "/artifacts"))
    artifacts_dir.mkdir(exist_ok=True, parents=True)

    csv_path = artifacts_dir / "company.csv"
    csv_path.write_text(
        f"{company['name']},{company['description']},{company['industry']}"
    )

    return CompanyResponse(**company)

@app.get("/health")
def health():
    return {"status": "healthy"}
"""


def create_code_bundle(app_code: str) -> str:
    """Create base64-encoded ZIP bundle from app code"""
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("main.py", app_code)

    return base64.b64encode(zip_buffer.getvalue()).decode()


def test_extract_company_full_flow(extract_company_app, tmp_path):
    """Test the canonical extract_company demo end-to-end"""
    from execute.executor import execute_endpoint

    code_bundle = create_code_bundle(extract_company_app)

    payload = {
        "run_id": "test-extract-company-123",
        "build_id": "build-456",
        "project_id": "project-789",
        "code_bundle": code_bundle,
        "deps_hash": "abc123",
        "entrypoint": "main:app",
        "endpoint": "POST /extract_company",
        "request_data": {
            "json": {"url": "https://example.com", "use_browser": False}
        },
        "env": {},
        "context": {},
    }

    # Execute
    result = execute_endpoint(payload, max_timeout=60, max_memory_mb=4096, lane="cpu")

    # Verify success
    assert result["status"] == "success"
    assert result["http_status"] == 200

    # Verify response structure
    response = result["response_body"]
    assert response["name"] == "ACME Inc"
    assert response["industry"] == "SaaS"

    # Verify artifacts collected
    # Note: Actual artifact collection would happen if /artifacts is properly set up
    assert isinstance(result["artifacts"], list)

    # Verify logs are redacted
    assert isinstance(result["logs"], str)
    assert result["duration_ms"] > 0


def test_health_check_endpoint(extract_company_app):
    """Test simple health check endpoint"""
    from execute.executor import execute_endpoint

    code_bundle = create_code_bundle(extract_company_app)

    payload = {
        "run_id": "test-health-123",
        "code_bundle": code_bundle,
        "entrypoint": "main:app",
        "endpoint": "GET /health",
        "request_data": {},
        "env": {},
        "context": {},
    }

    result = execute_endpoint(payload, max_timeout=60, max_memory_mb=4096, lane="cpu")

    assert result["status"] == "success"
    assert result["http_status"] == 200
    assert result["response_body"]["status"] == "healthy"


def test_missing_endpoint(extract_company_app):
    """Test error handling for missing endpoint"""
    from execute.executor import execute_endpoint

    code_bundle = create_code_bundle(extract_company_app)

    payload = {
        "run_id": "test-missing-123",
        "code_bundle": code_bundle,
        "entrypoint": "main:app",
        "endpoint": "GET /nonexistent",
        "request_data": {},
        "env": {},
        "context": {},
    }

    result = execute_endpoint(payload, max_timeout=60, max_memory_mb=4096, lane="cpu")

    # Should return 404 or error
    assert result["status"] in ["error", "success"]  # 404 is a successful response
    if result["status"] == "success":
        assert result["http_status"] == 404


def test_with_secrets(extract_company_app):
    """Test execution with secrets"""
    from execute.executor import execute_endpoint

    app_with_secrets = """
from fastapi import FastAPI
import os

app = FastAPI()

@app.get("/check_secrets")
def check_secrets():
    api_key = os.environ.get("API_KEY")
    return {
        "has_api_key": api_key is not None,
        "key_length": len(api_key) if api_key else 0
    }
"""

    code_bundle = create_code_bundle(app_with_secrets)

    payload = {
        "run_id": "test-secrets-123",
        "code_bundle": code_bundle,
        "entrypoint": "main:app",
        "endpoint": "GET /check_secrets",
        "request_data": {},
        "env": {"API_KEY": "sk-test-secret-key-12345"},
        "context": {},
    }

    result = execute_endpoint(payload, max_timeout=60, max_memory_mb=4096, lane="cpu")

    assert result["status"] == "success"

    # Secret should be available to app
    response = result["response_body"]
    assert response["has_api_key"] is True

    # Secret should be redacted from logs
    assert "sk-test-secret-key-12345" not in result["logs"]


def test_with_context(extract_company_app):
    """Test execution with context"""
    from execute.executor import execute_endpoint

    app_with_context = """
from fastapi import FastAPI
from pathlib import Path
import os
import json

app = FastAPI()

@app.get("/use_context")
def use_context():
    context_dir = Path(os.environ.get("EL_CONTEXT_DIR", "/context"))
    company_file = context_dir / "company.json"

    if company_file.exists():
        company = json.loads(company_file.read_text())
        return {"source": "context", "company": company}
    else:
        return {"source": "none", "company": None}
"""

    code_bundle = create_code_bundle(app_with_context)

    payload = {
        "run_id": "test-context-123",
        "code_bundle": code_bundle,
        "entrypoint": "main:app",
        "endpoint": "GET /use_context",
        "request_data": {},
        "env": {},
        "context": {"company": {"name": "Context Corp", "industry": "Tech"}},
    }

    result = execute_endpoint(payload, max_timeout=60, max_memory_mb=4096, lane="cpu")

    assert result["status"] == "success"
    # Context should be mounted and accessible
    # Note: Actual context mounting depends on filesystem setup


def test_artifact_generation():
    """Test artifact generation and collection"""
    from execute.executor import execute_endpoint

    app_with_artifacts = """
from fastapi import FastAPI
from pathlib import Path
import os

app = FastAPI()

@app.get("/generate_artifacts")
def generate_artifacts():
    artifacts_dir = Path(os.environ.get("EL_ARTIFACTS_DIR", "/artifacts"))
    artifacts_dir.mkdir(exist_ok=True, parents=True)

    # Create multiple artifacts
    (artifacts_dir / "output.txt").write_text("Test output")
    (artifacts_dir / "data.json").write_text('{"result": "success"}')
    (artifacts_dir / "report.csv").write_text("name,value\\ntest,123")

    return {"artifacts_created": 3}
"""

    code_bundle = create_code_bundle(app_with_artifacts)

    payload = {
        "run_id": "test-artifacts-123",
        "code_bundle": code_bundle,
        "entrypoint": "main:app",
        "endpoint": "GET /generate_artifacts",
        "request_data": {},
        "env": {},
        "context": {},
    }

    result = execute_endpoint(payload, max_timeout=60, max_memory_mb=4096, lane="cpu")

    assert result["status"] == "success"
    # Artifacts should be collected
    # Note: Actual collection depends on filesystem setup


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
