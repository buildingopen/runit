"""
ABOUTME: Modal App - Single execution factory for all runs (NEVER per-project apps)
ABOUTME: Defines CPU and GPU lanes with curated base image and executes user FastAPI code in-process
"""

import modal
import os

# Base image version (pinned, immutable)
BASE_IMAGE_VERSION = "2026-01-09"

# Curated base image with common dependencies
base_image = (
    modal.Image.debian_slim(python_version="3.11")
    # System dependencies for WeasyPrint PDF generation
    .apt_install(
        "ca-certificates",
        "curl",
        # WeasyPrint system dependencies
        "libpango-1.0-0",
        "libpangocairo-1.0-0",
        "libcairo2",
        "libgdk-pixbuf2.0-0",
        "libffi-dev",
        "shared-mime-info",
        "fonts-liberation",  # Common fonts
    )
    .pip_install(
        # Core typing support (must be first to avoid conflicts)
        "typing_extensions>=4.12.0",
        # FastAPI and web framework
        "fastapi>=0.109.0",
        "uvicorn==0.27.0",
        "httpx>=0.26.0",
        "pydantic>=2.5.3",
        "python-multipart>=0.0.6",
        # Common data libraries
        "pandas>=2.1.4",
        "numpy>=1.26.2",
        # HTTP/Scraping
        "beautifulsoup4>=4.12.2",
        "lxml>=4.9.3",
        "requests>=2.31.0",
        # JSON/Data
        "orjson>=3.9.10",
        # AI Libraries (commonly needed)
        "google-genai>=1.0.0",
        "google-generativeai>=0.8.0",  # OpenDraft uses this
        "anthropic>=0.20.0",
        "openai>=1.0.0",
        "python-dotenv>=1.0.0",
        # Cryptography for secrets decryption
        "cryptography>=41.0.0",
        # Document generation (OpenDraft)
        "weasyprint>=60.0",
        "python-docx>=1.0.0",
        "markdown>=3.5.0",
        "pybtex>=0.24.0",
        "citeproc-py>=0.6.0",
        "PyYAML>=6.0.0",
        "rich>=13.0.0",
        "tenacity>=8.0.0",
        "psutil>=5.9.0",
    )
    .env({
        "BASE_IMAGE_VERSION": BASE_IMAGE_VERSION,
        "TZ": "UTC",
        "LANG": "C.UTF-8",
        "LC_ALL": "C.UTF-8",
        "PYTHONUNBUFFERED": "1",
        "PIP_DISABLE_PIP_VERSION_CHECK": "1",
        "PIP_NO_INPUT": "1",
    })
    # Add local execution modules to the image (relative to this file's directory)
    # Using pathlib to get correct absolute paths
    .add_local_python_source("execute")
    .add_local_python_source("build")
    .add_local_python_source("artifacts")
    .add_local_python_source("errors")
    .add_local_python_source("security")
)

# Single Modal app (execution factory)
app = modal.App("execution-layer-runtime")


@app.function(
    image=base_image,
    cpu=4.0,
    memory=8192,  # 8GB for paper generation
    timeout=2400,  # 40 min max for long-running tasks like paper generation
    secrets=[modal.Secret.from_name("runner-secrets")],
)
def run_endpoint_cpu(payload: dict) -> dict:
    """
    Execute endpoint in CPU lane.

    Payload structure:
        run_id: str
        build_id: str
        code_bundle: bytes (ZIP)
        deps_hash: str
        entrypoint: str (e.g., "main:app")
        endpoint: str (e.g., "POST /extract")
        request_data: dict (params, json, headers, files)
        env: dict (decrypted secrets)
        context: dict (context objects)
        timeout_seconds: int

    Returns RunEndpointResponse dict
    """
    from execute.executor import execute_endpoint

    # Use timeout from payload, capped at 1800s (30 min) for CPU lane (leave 60s buffer for Modal)
    requested_timeout = payload.get("timeout_seconds", 60)
    max_timeout = min(requested_timeout, 1800)

    return execute_endpoint(
        payload=payload,
        max_timeout=max_timeout,
        max_memory_mb=4096,
        lane="cpu"
    )


@app.function(
    image=base_image,
    gpu="A10G",
    cpu=4.0,
    memory=16384,  # 16GB
    timeout=480,  # 8 min for build + execution
    secrets=[modal.Secret.from_name("runner-secrets")],
)
def run_endpoint_gpu(payload: dict) -> dict:
    """
    Execute endpoint in GPU lane.

    Same payload structure as CPU lane.
    Returns RunEndpointResponse dict.
    """
    from execute.executor import execute_endpoint

    return execute_endpoint(
        payload=payload,
        max_timeout=180,  # GPU timeout
        max_memory_mb=16384,
        lane="gpu"
    )


@app.local_entrypoint()
def main():
    """Local testing entrypoint"""
    print(f"Execution Layer Runtime v{BASE_IMAGE_VERSION}")
    print(f"Python: {modal.Image.python_version}")
    print("Ready to execute FastAPI endpoints")
    print("")
    print("Available functions:")
    print("  - run_endpoint_cpu (2 CPU, 4GB, 60s)")
    print("  - run_endpoint_gpu (4 CPU + A10G, 16GB, 180s)")
