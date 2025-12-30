"""
ABOUTME: Modal App - Single execution factory for all runs (NEVER per-project apps)
ABOUTME: Defines CPU and GPU lanes with curated base image and executes user FastAPI code in-process
"""

import modal
import os

# Base image version (pinned, immutable)
BASE_IMAGE_VERSION = "2024-12-30"

# Curated base image with common dependencies
base_image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "fastapi==0.109.0",
        "uvicorn==0.27.0",
        "httpx==0.26.0",
        "pydantic==2.5.3",
        "python-multipart==0.0.6",
        # Common data libraries
        "pandas==2.1.4",
        "numpy==1.26.2",
        # HTTP/Scraping
        "beautifulsoup4==4.12.2",
        "lxml==4.9.3",
        "requests==2.31.0",
        # JSON/Data
        "orjson==3.9.10",
    )
    .apt_install("ca-certificates", "curl")
    .env({
        "BASE_IMAGE_VERSION": BASE_IMAGE_VERSION,
        "TZ": "UTC",
        "LANG": "C.UTF-8",
        "LC_ALL": "C.UTF-8",
        "PYTHONUNBUFFERED": "1",
        "PIP_DISABLE_PIP_VERSION_CHECK": "1",
        "PIP_NO_INPUT": "1",
    })
    # Add local execution modules to the image (LAST so they're mounted at runtime)
    .add_local_dir("execute", remote_path="/root/execute")
    .add_local_dir("build", remote_path="/root/build")
    .add_local_dir("artifacts", remote_path="/root/artifacts")
    .add_local_dir("errors", remote_path="/root/errors")
    .add_local_dir("security", remote_path="/root/security")
)

# Single Modal app (execution factory)
app = modal.App("execution-layer-runtime")


@app.function(
    image=base_image,
    cpu=2.0,
    memory=4096,  # 4GB
    timeout=300,  # 5 min for build + execution
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

    return execute_endpoint(
        payload=payload,
        max_timeout=60,  # CPU timeout
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
