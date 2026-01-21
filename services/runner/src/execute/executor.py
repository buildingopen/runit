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

    # Track injected env vars for cleanup
    injected_env_keys: list[str] = []
    temp_dir_to_cleanup = None

    def log(msg: str):
        logs.append(f"[{time.time() - start_time:.2f}s] {msg}")

    try:
        log(f"Starting run {run_id} on {lane} lane")
        log(f"Timeout: {max_timeout}s, Memory: {max_memory_mb}MB")

        # 1. Setup workspace
        # Use /tmp for testing if /workspace doesn't exist
        import tempfile
        base_dir = os.environ.get("EL_BASE_DIR")
        if base_dir:
            log(f"Using base dir from EL_BASE_DIR: {base_dir}")
            workspace = Path(base_dir) / "workspace"
            artifacts_dir = Path(base_dir) / "artifacts"
            context_dir = Path(base_dir) / "context"
            workspace.mkdir(parents=True, exist_ok=True)
            artifacts_dir.mkdir(parents=True, exist_ok=True)
            context_dir.mkdir(parents=True, exist_ok=True)
        else:
            # Try to create in root (production Modal env)
            # Fall back to temp if permission denied
            try:
                log("Attempting to create workspace in root...")
                workspace = Path("/workspace")
                workspace.mkdir(parents=True, exist_ok=True)
                artifacts_dir = Path("/artifacts")
                artifacts_dir.mkdir(parents=True, exist_ok=True)
                context_dir = Path("/context")
                context_dir.mkdir(parents=True, exist_ok=True)
                log(f"Created workspace: {workspace}")
            except (PermissionError, OSError) as e:
                # Development/testing environment - use temp dirs
                log(f"Cannot create root dirs ({type(e).__name__}: {e}), using temp")
                # Use unique suffix to prevent collisions
                temp_base = Path(tempfile.mkdtemp(prefix=f"el-run-{run_id}-", suffix=f"-{int(time.time() * 1000000)}"))
                temp_dir_to_cleanup = temp_base  # Track for cleanup
                workspace = temp_base / "workspace"
                artifacts_dir = temp_base / "artifacts"
                context_dir = temp_base / "context"
                workspace.mkdir(parents=True, exist_ok=True)
                artifacts_dir.mkdir(parents=True, exist_ok=True)
                context_dir.mkdir(parents=True, exist_ok=True)
                log(f"Created temp workspace: {workspace}")

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

        # Dangerous environment variables that should never be overridden
        FORBIDDEN_ENV_KEYS = {
            "PATH", "LD_PRELOAD", "LD_LIBRARY_PATH", "PYTHONPATH",
            "HOME", "USER", "SHELL", "SUDO_", "SSH_", "PWD"
        }

        # Support direct env dict (for testing) or encrypted secrets_ref (for production)
        if "env" in payload and payload["env"]:
            # Direct env vars (testing)
            env_vars = payload["env"]
            log(f"Injecting {len(env_vars)} environment variables (direct)")
            for key, value in env_vars.items():
                # Validate key is not forbidden
                if key in FORBIDDEN_ENV_KEYS or any(key.startswith(prefix) for prefix in ["SUDO_", "SSH_"]):
                    log(f"WARNING: Skipping forbidden env var: {key}")
                    continue
                os.environ[key] = value
                injected_env_keys.append(key)  # Track for cleanup
        elif "secrets_ref" in payload and payload["secrets_ref"]:
            # Encrypted secrets (production)
            secrets_ref = payload["secrets_ref"]
            log("Decrypting secrets bundle...")
            try:
                # Import decryption function
                # Note: In production, this would use the same KMS key as control-plane
                # For v0, we use environment variable for the master key
                import json as json_module
                from security.kms_client import decrypt_secrets_bundle

                env_vars = decrypt_secrets_bundle(secrets_ref)
                log(f"Injecting {len(env_vars)} secrets (encrypted)")

                # Inject as environment variables
                for key, value in env_vars.items():
                    # Validate key is not forbidden
                    if key in FORBIDDEN_ENV_KEYS or any(key.startswith(prefix) for prefix in ["SUDO_", "SSH_"]):
                        log(f"WARNING: Skipping forbidden env var: {key}")
                        continue
                    os.environ[key] = value
                    injected_env_keys.append(key)  # Track for cleanup
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

        # Log workspace contents for debugging
        log(f"Workspace path: {workspace}")
        try:
            workspace_files = list(workspace.iterdir())
            log(f"Workspace contents: {[f.name for f in workspace_files]}")
        except Exception as ws_err:
            log(f"Could not list workspace: {ws_err}")

        entrypoint = payload.get("entrypoint", "main:app")
        module_name, app_name = entrypoint.split(":")
        log(f"Attempting to import: {module_name}:{app_name}")

        try:
            import importlib

            module = importlib.import_module(module_name)
            app = getattr(module, app_name)
        except (ImportError, AttributeError) as e:
            # Log the actual exception type and details
            import traceback
            log(f"Import failed: {type(e).__name__}: {e}")
            log(f"Traceback: {traceback.format_exc()}")
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

    finally:
        # CRITICAL: Clean up injected environment variables to prevent test pollution
        for key in injected_env_keys:
            os.environ.pop(key, None)

        # CRITICAL: Clean up temporary directory to prevent disk filling
        if temp_dir_to_cleanup and temp_dir_to_cleanup.exists():
            import shutil
            try:
                shutil.rmtree(temp_dir_to_cleanup)
                log(f"Cleaned up temp directory: {temp_dir_to_cleanup}")
            except Exception as cleanup_error:
                log(f"WARNING: Failed to clean up temp directory: {cleanup_error}")
