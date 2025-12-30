"""
ABOUTME: Core executor - Executes FastAPI endpoints in-process using httpx.AsyncClient
ABOUTME: Handles bundle extraction, dependency install, app import, and ASGI execution
"""

import asyncio
import base64
import io
import json
import os
import sys
import time
import zipfile
from pathlib import Path
from typing import Any, Dict

import httpx


class ExecutionError(Exception):
    """Base exception for execution failures"""

    def __init__(self, error_class: str, message: str, detail: str = "", suggested_fix: str = ""):
        self.error_class = error_class
        self.message = message
        self.detail = detail
        self.suggested_fix = suggested_fix
        super().__init__(message)


def execute_endpoint(
    payload: dict, max_timeout: int, max_memory_mb: int, lane: str
) -> dict:
    """
    Execute a single endpoint run in isolation.

    CRITICAL: This function runs IN-PROCESS (no uvicorn, no ports).
    Uses httpx.AsyncClient with ASGITransport for async compatibility.

    Args:
        payload: RunEndpointRequest dict
        max_timeout: Maximum execution time (60s CPU, 180s GPU)
        max_memory_mb: Memory limit
        lane: "cpu" or "gpu"

    Returns:
        RunEndpointResponse dict
    """
    start_time = time.time()
    run_id = payload["run_id"]
    logs: list[str] = []

    def log(msg: str):
        logs.append(f"[{time.time() - start_time:.2f}s] {msg}")

    try:
        log(f"Starting run {run_id} on {lane} lane")
        log(f"Timeout: {max_timeout}s, Memory: {max_memory_mb}MB")

        # 1. Setup workspace
        workspace = Path("/workspace")
        workspace.mkdir(parents=True, exist_ok=True)
        artifacts_dir = Path("/artifacts")
        artifacts_dir.mkdir(parents=True, exist_ok=True)
        context_dir = Path("/context")
        context_dir.mkdir(parents=True, exist_ok=True)

        # 2. Extract code bundle
        log("Extracting code bundle...")
        code_bundle = base64.b64decode(payload["code_bundle"])
        with zipfile.ZipFile(io.BytesIO(code_bundle)) as zf:
            zf.extractall(workspace)

        # 3. Install dependencies if needed
        requirements_file = workspace / "requirements.txt"
        if requirements_file.exists():
            from build.deps import install_dependencies

            log("Installing dependencies...")
            install_dependencies(
                requirements_file=requirements_file,
                deps_hash=payload.get("deps_hash", "unknown"),
                timeout=90,
                logs=logs,
            )
        else:
            log("No requirements.txt found, using base image only")

        # 4. Decrypt and inject secrets as environment variables
        env_vars = {}
        secrets_ref = payload.get("secrets_ref")
        if secrets_ref:
            log("Decrypting secrets bundle...")
            try:
                # Import decryption function
                # Note: In production, this would use the same KMS key as control-plane
                # For v0, we use environment variable for the master key
                import json as json_module
                from security.kms_client import decrypt_secrets_bundle

                env_vars = decrypt_secrets_bundle(secrets_ref)
                log(f"Injecting {len(env_vars)} secrets")

                # Inject as environment variables
                for key, value in env_vars.items():
                    os.environ[key] = value
            except Exception as e:
                log(f"WARNING: Failed to decrypt secrets: {e}")
                raise ExecutionError(
                    error_class="SECRETS_DECRYPTION_FAILED",
                    message="Failed to decrypt secrets",
                    detail=str(e),
                    suggested_fix="Check that secrets are properly configured in the project",
                )

        # 5. Write context files
        context_data = payload.get("context", {})
        if context_data:
            log(f"Writing {len(context_data)} context files")
            for filename, content in context_data.items():
                context_file = context_dir / f"{filename}.json"
                context_file.write_text(json.dumps(content, indent=2))

        # 6. Set platform environment variables
        os.environ.update(
            {
                "EL_CONTEXT_DIR": str(context_dir),
                "EL_ARTIFACTS_DIR": str(artifacts_dir),
                "EL_PROJECT_ID": payload.get("project_id", "unknown"),
                "EL_RUN_ID": run_id,
                "EL_LANE": lane,
            }
        )

        # Set deterministic seed if requested
        if payload.get("deterministic", False):
            os.environ["EL_SEED"] = "0"
            import random
            import numpy as np

            random.seed(0)
            np.random.seed(0)
            try:
                import torch

                torch.manual_seed(0)
            except ImportError:
                pass

        # 7. Import FastAPI app
        log("Importing FastAPI app...")
        sys.path.insert(0, str(workspace))

        entrypoint = payload.get("entrypoint", "main:app")
        module_name, app_name = entrypoint.split(":")

        try:
            import importlib

            module = importlib.import_module(module_name)
            app = getattr(module, app_name)
        except (ImportError, AttributeError) as e:
            raise ExecutionError(
                error_class="ENTRYPOINT_NOT_FOUND",
                message=f"Couldn't find FastAPI app at {entrypoint}",
                detail=str(e),
                suggested_fix=(
                    "Rename your file to main.py and export app = FastAPI(), "
                    "or set entrypoint in your request"
                ),
            )

        log(f"FastAPI app loaded: {type(app).__name__}")

        # 8. Parse endpoint
        endpoint_str = payload["endpoint"]  # e.g., "POST /extract_company"
        method, path = endpoint_str.split(" ", 1)
        method = method.upper()

        # 9. Prepare request data
        request_data = payload.get("request_data", {})
        params = request_data.get("params", {})
        json_data = request_data.get("json")
        headers = request_data.get("headers", {})
        files_data = request_data.get("files", [])

        # Handle file uploads
        files = None
        if files_data:
            log(f"Processing {len(files_data)} file uploads")
            files = []
            for file_upload in files_data:
                file_content = base64.b64decode(file_upload["content"])
                files.append(
                    (
                        file_upload["name"],
                        (file_upload["name"], io.BytesIO(file_content), file_upload["mime"]),
                    )
                )

        # 10. Execute endpoint in-process using httpx.AsyncClient
        log(f"Executing {method} {path}")

        async def execute_request():
            from httpx import ASGITransport, AsyncClient

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://testserver"
            ) as client:
                response = await client.request(
                    method=method,
                    url=path,
                    params=params,
                    json=json_data,
                    headers=headers,
                    files=files,
                    timeout=max_timeout,
                )
                return response

        # Run with timeout
        response = asyncio.run(
            asyncio.wait_for(execute_request(), timeout=max_timeout)
        )

        duration_ms = int((time.time() - start_time) * 1000)
        log(f"Endpoint completed: {response.status_code} in {duration_ms}ms")

        # 11. Collect artifacts
        from artifacts.collector import collect_artifacts

        artifacts = collect_artifacts(artifacts_dir, logs)

        # 12. Redact secrets from logs
        from security.redaction import redact_secrets

        redacted_logs = redact_secrets("\n".join(logs), env_vars)

        # 13. Parse response body
        response_body: Any = None
        content_type = response.headers.get("content-type", "")

        if "application/json" in content_type:
            try:
                response_body = response.json()
            except Exception:
                response_body = response.text
        else:
            response_body = response.text

        # 14. Redact secrets from output
        from security.redaction import redact_output

        redacted_response_body, output_was_redacted = redact_output(response_body, env_vars)

        if output_was_redacted:
            log("WARNING: Sensitive values were redacted from output")

        # 15. Return RunEndpointResponse
        return {
            "run_id": run_id,
            "status": "success",
            "http_status": response.status_code,
            "http_headers": dict(response.headers),
            "response_body": redacted_response_body,
            "duration_ms": duration_ms,
            "base_image_version": os.environ.get("BASE_IMAGE_VERSION", "unknown"),
            "artifacts": artifacts,
            "logs": redacted_logs,
            "redactions_applied": output_was_redacted,  # Track if secrets were redacted
            "error_class": None,
            "error_detail": None,
            "error_message": None,
            "suggested_fix": None,
        }

    except asyncio.TimeoutError:
        duration_ms = int((time.time() - start_time) * 1000)
        return {
            "run_id": run_id,
            "status": "timeout",
            "http_status": 408,
            "http_headers": {},
            "response_body": None,
            "duration_ms": duration_ms,
            "base_image_version": os.environ.get("BASE_IMAGE_VERSION", "unknown"),
            "artifacts": [],
            "logs": "\n".join(logs),
            "error_class": "TIMEOUT",
            "error_detail": f"Exceeded {max_timeout}s timeout",
            "error_message": f"This run timed out after {max_timeout} seconds.",
            "suggested_fix": (
                f"Try reducing the workload, optimizing your code, or using the "
                f"{'CPU' if lane == 'gpu' else 'GPU'} lane for heavy tasks."
            ),
        }

    except ExecutionError as e:
        duration_ms = int((time.time() - start_time) * 1000)
        return {
            "run_id": run_id,
            "status": "error",
            "http_status": 500,
            "http_headers": {},
            "response_body": None,
            "duration_ms": duration_ms,
            "base_image_version": os.environ.get("BASE_IMAGE_VERSION", "unknown"),
            "artifacts": [],
            "logs": "\n".join(logs),
            "error_class": e.error_class,
            "error_detail": e.detail,
            "error_message": e.message,
            "suggested_fix": e.suggested_fix,
        }

    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        from errors.taxonomy import classify_error

        error_info = classify_error(e)

        return {
            "run_id": run_id,
            "status": "error",
            "http_status": 500,
            "http_headers": {},
            "response_body": None,
            "duration_ms": duration_ms,
            "base_image_version": os.environ.get("BASE_IMAGE_VERSION", "unknown"),
            "artifacts": [],
            "logs": "\n".join(logs),
            "error_class": error_info["error_class"],
            "error_detail": str(e),
            "error_message": error_info["message"],
            "suggested_fix": error_info["suggested_fix"],
        }
