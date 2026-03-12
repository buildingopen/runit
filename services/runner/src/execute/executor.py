"""
ABOUTME: Core executor - Executes FastAPI endpoints in-process using httpx.AsyncClient
ABOUTME: Handles bundle extraction, dependency install, app import, and ASGI execution

SECURITY NOTE: This executor runs user code IN-PROCESS with no OS-level sandbox
(no seccomp, no apparmor, no chroot). It relies on Modal's container/VM isolation
at the infrastructure level. Never run this executor outside of Modal or an
equivalent isolation boundary.
"""

import asyncio
import base64
import importlib
import importlib.util
import io
import json
import os
import sys
import tempfile
import time
import zipfile
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


class ExecutionError(Exception):
    """Base exception for execution failures"""

    def __init__(self, error_class: str, message: str, detail: str = "", suggested_fix: str = ""):
        self.error_class = error_class
        self.message = message
        self.detail = detail
        self.suggested_fix = suggested_fix
        super().__init__(message)


# Dangerous environment variables that must never be overridden by user code
FORBIDDEN_ENV_KEYS = {
    "PATH",
    "LD_PRELOAD",
    "LD_LIBRARY_PATH",
    "PYTHONPATH",
    "PYTHONHOME",
    "HOME",
    "USER",
    "SHELL",
    "PWD",
    "LOGNAME",
    "HOSTNAME",
    "TERM",
    "LANG",
    "LC_ALL",
    "TZ",
    "IFS",
    "CDPATH",
    "ENV",
    "BASH_ENV",
    "NODE_PATH",
    "NODE_OPTIONS",
    "NODE_ENV",
    "EL_CONTEXT_DIR",
    "EL_ARTIFACTS_DIR",
    "EL_PROJECT_ID",
    "EL_RUN_ID",
    "EL_LANE",
    "EL_BASE_DIR",
    "EL_SEED",
}

FORBIDDEN_PREFIXES = (
    "LD_",
    "SUDO_",
    "SSH_",
    "PYTHON",
    "EL_",
    "MODAL_",
    "AWS_ACCESS",
    "AWS_SECRET",
    "AWS_SESSION",
)


def is_env_key_allowed(key: str) -> bool:
    """Check whether an environment variable key is safe to inject."""
    if key in FORBIDDEN_ENV_KEYS:
        return False
    if any(key.startswith(p) for p in FORBIDDEN_PREFIXES):
        return False
    if not key.replace("_", "").isalnum():
        return False
    return True


def _setup_workspace(run_id: str, log: Any) -> Tuple[Path, Path, Path, Optional[Path]]:
    """
    Create workspace, artifacts, and context directories.
    Returns (workspace, artifacts_dir, context_dir, temp_dir_to_cleanup).
    """
    base_dir = os.environ.get("EL_BASE_DIR")
    temp_dir_to_cleanup: Optional[Path] = None

    if base_dir:
        log(f"Using base dir from EL_BASE_DIR: {base_dir}")
        workspace = Path(base_dir) / "workspace"
        artifacts_dir = Path(base_dir) / "artifacts"
        context_dir = Path(base_dir) / "context"
    else:
        try:
            log("Attempting to create workspace in root...")
            workspace = Path("/workspace")
            workspace.mkdir(parents=True, exist_ok=True)
            artifacts_dir = Path("/artifacts")
            artifacts_dir.mkdir(parents=True, exist_ok=True)
            context_dir = Path("/context")
            context_dir.mkdir(parents=True, exist_ok=True)
            log(f"Created workspace: {workspace}")
            return workspace, artifacts_dir, context_dir, None
        except (PermissionError, OSError) as e:
            log(f"Cannot create root dirs ({type(e).__name__}: {e}), using temp")
            temp_base = Path(
                tempfile.mkdtemp(
                    prefix=f"el-run-{run_id}-",
                    suffix=f"-{int(time.time() * 1000000)}",
                )
            )
            temp_dir_to_cleanup = temp_base
            workspace = temp_base / "workspace"
            artifacts_dir = temp_base / "artifacts"
            context_dir = temp_base / "context"

    workspace.mkdir(parents=True, exist_ok=True)
    artifacts_dir.mkdir(parents=True, exist_ok=True)
    context_dir.mkdir(parents=True, exist_ok=True)
    log(f"Created workspace: {workspace}")
    return workspace, artifacts_dir, context_dir, temp_dir_to_cleanup


def _extract_bundle(code_bundle_b64: str, workspace: Path, log: Any) -> None:
    """Decode and extract a base64-encoded ZIP bundle with zip-slip protection."""
    log("Extracting code bundle...")
    code_bundle = base64.b64decode(code_bundle_b64)
    workspace_real = str(workspace.resolve())
    with zipfile.ZipFile(io.BytesIO(code_bundle)) as zf:
        for member in zf.namelist():
            target = os.path.realpath(os.path.join(workspace_real, member))
            if not target.startswith(workspace_real + os.sep) and target != workspace_real:
                raise ExecutionError(
                    error_class="MALICIOUS_BUNDLE",
                    message="Code bundle contains path traversal",
                    detail=f"Zip slip detected: {member}",
                    suggested_fix="Remove files with '../' in their paths from your ZIP",
                )
        zf.extractall(workspace)


def _inject_env_vars(payload: dict, log: Any) -> Tuple[Dict[str, str], List[str]]:
    """
    Inject user secrets into the environment.
    Returns (env_vars_dict, list_of_injected_keys).
    """
    env_vars: Dict[str, str] = {}
    injected_keys: List[str] = []

    if "env" in payload and payload["env"]:
        env_vars = payload["env"]
        log(f"Injecting {len(env_vars)} environment variables (direct)")
        for key, value in env_vars.items():
            if not is_env_key_allowed(key):
                log(f"WARNING: Skipping forbidden env var: {key}")
                continue
            os.environ[key] = value
            injected_keys.append(key)

    elif "secrets_ref" in payload and payload["secrets_ref"]:
        secrets_ref = payload["secrets_ref"]
        log("Decrypting secrets bundle...")
        try:
            from security.kms_client import decrypt_secrets_bundle

            env_vars = decrypt_secrets_bundle(secrets_ref)
            log(f"Injecting {len(env_vars)} secrets (encrypted)")
            for key, value in env_vars.items():
                if not is_env_key_allowed(key):
                    log(f"WARNING: Skipping forbidden env var: {key}")
                    continue
                os.environ[key] = value
                injected_keys.append(key)
        except Exception as e:
            log(f"WARNING: Failed to decrypt secrets: {e}")
            raise ExecutionError(
                error_class="SECRETS_DECRYPTION_FAILED",
                message="Failed to decrypt secrets",
                detail=str(e),
                suggested_fix="Check that secrets are properly configured in the project",
            )

    return env_vars, injected_keys


def _read_runit_yaml(workspace: Path, log: Any) -> Optional[dict]:
    """Read and parse runit.yaml from the workspace if present."""
    for name in ("runit.yaml", "runit.yml"):
        yaml_path = workspace / name
        if yaml_path.exists():
            try:
                import yaml as yaml_lib
            except ImportError:
                # PyYAML not installed, try simple parsing
                try:
                    content = yaml_path.read_text(encoding="utf-8")
                    # Fallback: JSON is valid YAML, try that
                    return json.loads(content)
                except Exception:
                    log("runit.yaml found but cannot parse (PyYAML not installed)")
                    return None

            try:
                content = yaml_path.read_text(encoding="utf-8")
                config = yaml_lib.safe_load(content)
                if isinstance(config, dict):
                    log(f"Loaded runit.yaml: {list(config.keys())}")
                    return config
            except Exception as e:
                log(f"Failed to parse runit.yaml: {e}")
    return None


def _get_endpoint_overrides(config: dict, method: str, path: str) -> Dict[str, Any]:
    """Get per-endpoint resource overrides from runit.yaml."""
    endpoints = config.get("endpoints", {})
    if not endpoints:
        return {}

    for key, value in endpoints.items():
        if not isinstance(value, dict):
            continue
        # Normalize key: "POST /foo", "/foo", "foo"
        key = key.strip()
        # "POST /foo" - match method + path
        parts = key.split(None, 1)
        if len(parts) == 2:
            k_method, k_path = parts
            if k_method.upper() == method.upper() and k_path == path:
                return value
        elif key.startswith("/"):
            if key == path:
                return value
        else:
            if f"/{key}" == path:
                return value
    return {}


def _validate_runit_secrets(config: dict, injected_keys: List[str], log: Any) -> None:
    """Validate that required secrets from runit.yaml are present."""
    secrets = config.get("secrets")
    if not secrets:
        return

    required: List[str] = []
    if isinstance(secrets, list):
        required = secrets
    elif isinstance(secrets, dict):
        for key, val in secrets.items():
            if isinstance(val, dict) and val.get("required") is False:
                continue
            required.append(key)

    missing = [k for k in required if k not in injected_keys and k not in os.environ]
    if missing:
        log(f"WARNING: Missing required secrets from runit.yaml: {', '.join(missing)}")


def _import_app(workspace: Path, entrypoint: str, run_id: str, log: Any) -> Any:
    """Import the FastAPI app from the workspace."""
    log("Importing FastAPI app...")
    sys.path.insert(0, str(workspace))

    try:
        workspace_files = list(workspace.iterdir())
        log(f"Workspace contents: {[f.name for f in workspace_files]}")
    except Exception as ws_err:
        log(f"Could not list workspace: {ws_err}")

    if ":" not in entrypoint:
        raise ExecutionError(
            error_class="INVALID_ENTRYPOINT",
            message=f"Invalid entrypoint format: {entrypoint}",
            detail="Entrypoint must be in 'module:app' format",
            suggested_fix="Use format like 'main:app' or 'src.main:app'",
        )

    module_name, app_name = entrypoint.split(":", 1)

    # Validate module name: only allow Python identifiers separated by dots
    if not all(part.isidentifier() for part in module_name.split(".")):
        raise ExecutionError(
            error_class="INVALID_ENTRYPOINT",
            message=f"Invalid module name in entrypoint: {module_name}",
            detail="Module name contains invalid characters",
            suggested_fix="Use a valid Python module path like 'main' or 'src.main'",
        )

    # Verify resolved path stays within workspace (path traversal protection)
    resolved_module_path = workspace.joinpath(*module_name.split(".")).resolve()
    if not str(resolved_module_path).startswith(str(workspace.resolve())):
        raise ExecutionError(
            error_class="MALICIOUS_ENTRYPOINT",
            message="Entrypoint attempts path traversal outside workspace",
            detail=f"Module path resolves outside workspace: {module_name}",
            suggested_fix="Use a simple module name like 'main' or 'src.main'",
        )

    log(f"Attempting to import: {module_name}:{app_name}")

    try:
        module_path = workspace.joinpath(*module_name.split("."))
        module_file = module_path.with_suffix(".py")
        package_init_file = module_path / "__init__.py"

        if module_file.exists():
            unique_module_name = f"_el_run_{run_id}_{module_name.replace('.', '_')}"
            spec = importlib.util.spec_from_file_location(unique_module_name, module_file)
            if spec is None or spec.loader is None:
                raise ImportError(f"Cannot load module from {module_file}")
            module = importlib.util.module_from_spec(spec)
            sys.modules[unique_module_name] = module
            spec.loader.exec_module(module)
        elif package_init_file.exists():
            unique_module_name = f"_el_run_{run_id}_{module_name.replace('.', '_')}"
            spec = importlib.util.spec_from_file_location(
                unique_module_name,
                package_init_file,
                submodule_search_locations=[str(module_path)],
            )
            if spec is None or spec.loader is None:
                raise ImportError(f"Cannot load package from {package_init_file}")
            module = importlib.util.module_from_spec(spec)
            sys.modules[unique_module_name] = module
            spec.loader.exec_module(module)
        else:
            importlib.invalidate_caches()
            if module_name in sys.modules:
                del sys.modules[module_name]
            module = importlib.import_module(module_name)

        app = getattr(module, app_name)
    except (ImportError, AttributeError) as e:
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
    return app


def _build_response(
    run_id: str,
    status: str,
    http_status: int,
    duration_ms: int,
    logs: str,
    *,
    http_headers: Optional[dict] = None,
    response_body: Any = None,
    artifacts: Optional[list] = None,
    error_class: Optional[str] = None,
    error_detail: Optional[str] = None,
    error_message: Optional[str] = None,
    suggested_fix: Optional[str] = None,
    redactions_applied: bool = False,
) -> dict:
    """Build a standardized RunEndpointResponse dict."""
    return {
        "run_id": run_id,
        "status": status,
        "http_status": http_status,
        "http_headers": http_headers or {},
        "response_body": response_body,
        "duration_ms": duration_ms,
        "base_image_version": os.environ.get("BASE_IMAGE_VERSION", "unknown"),
        "artifacts": artifacts or [],
        "logs": logs,
        "redactions_applied": redactions_applied,
        "error_class": error_class,
        "error_detail": error_detail,
        "error_message": error_message,
        "suggested_fix": suggested_fix,
    }


def execute_endpoint(payload: dict, max_timeout: int, max_memory_mb: int, lane: str) -> dict:
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
    injected_env_keys: list[str] = []
    baseline_env = dict(os.environ)  # Save before injection
    temp_dir_to_cleanup: Optional[Path] = None

    def log(msg: str):
        logs.append(f"[{time.time() - start_time:.2f}s] {msg}")

    try:
        log(f"Starting run {run_id} on {lane} lane")
        log(f"Timeout: {max_timeout}s, Memory: {max_memory_mb}MB")

        # 1. Setup workspace
        workspace, artifacts_dir, context_dir, temp_dir_to_cleanup = _setup_workspace(run_id, log)

        # 2. Extract code bundle
        _extract_bundle(payload["code_bundle"], workspace, log)

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

        # 4. Read runit.yaml if present
        runit_config = _read_runit_yaml(workspace, log)

        # 5. Inject secrets
        env_vars, injected_env_keys = _inject_env_vars(payload, log)

        # 6. Validate required secrets from runit.yaml
        if runit_config:
            _validate_runit_secrets(runit_config, injected_env_keys, log)

        # 7. Write context files
        context_data = payload.get("context", {})
        if context_data:
            log(f"Writing {len(context_data)} context files")
            for filename, content in context_data.items():
                context_file = context_dir / f"{filename}.json"
                context_file.write_text(json.dumps(content, indent=2))

        # 8. Set platform environment variables
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

            random.seed(0)
            try:
                import numpy as np

                np.random.seed(0)
            except ImportError:
                pass
            try:
                import torch

                torch.manual_seed(0)
            except ImportError:
                pass

        # 9. Import FastAPI app (runit.yaml entrypoint takes precedence)
        entrypoint = payload.get("entrypoint", "main:app")
        if runit_config and runit_config.get("entrypoint"):
            entrypoint = runit_config["entrypoint"]
        app = _import_app(workspace, entrypoint, run_id, log)

        # 10. Parse endpoint
        endpoint_str = payload["endpoint"]  # e.g., "POST /extract_company"
        method, path = endpoint_str.split(" ", 1)
        method = method.upper()

        # 10b. Apply per-endpoint resource overrides from runit.yaml
        if runit_config:
            ep_overrides = _get_endpoint_overrides(runit_config, method, path)
            if ep_overrides.get("timeout_seconds"):
                override_timeout = int(ep_overrides["timeout_seconds"])
                if override_timeout < max_timeout:
                    log(
                        f"runit.yaml: timeout override {max_timeout}s -> "
                        f"{override_timeout}s for {method} {path}"
                    )
                    max_timeout = override_timeout
            if ep_overrides.get("lane") and ep_overrides["lane"] != lane:
                log(f"runit.yaml: lane preference is '{ep_overrides['lane']}' (current: {lane})")

        # 11. Prepare request data
        request_data = payload.get("request_data", {})
        params = request_data.get("params", {})
        json_data = request_data.get("json")
        headers = request_data.get("headers", {})
        files_data = request_data.get("files", [])

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

        # 12. Execute endpoint in-process using httpx.AsyncClient
        log(f"Executing {method} {path}")

        async def execute_request():
            from httpx import ASGITransport, AsyncClient

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://testserver"
            ) as client:
                return await client.request(
                    method=method,
                    url=path,
                    params=params,
                    json=json_data,
                    headers=headers,
                    files=files,
                    timeout=max_timeout,
                )

        response = asyncio.run(asyncio.wait_for(execute_request(), timeout=max_timeout))

        duration_ms = int((time.time() - start_time) * 1000)
        log(f"Endpoint completed: {response.status_code} in {duration_ms}ms")

        # 13. Collect artifacts
        from artifacts.collector import collect_artifacts

        artifacts = collect_artifacts(artifacts_dir, logs)

        # 14. Redact secrets from logs
        from security.redaction import redact_secrets

        redacted_logs = redact_secrets("\n".join(logs), env_vars)

        # 15. Parse response body
        response_body: Any = None
        content_type = response.headers.get("content-type", "")
        if "application/json" in content_type:
            try:
                response_body = response.json()
            except Exception:
                response_body = response.text
        else:
            response_body = response.text

        # 16. Redact secrets from output
        from security.redaction import redact_output

        redacted_response_body, output_was_redacted = redact_output(response_body, env_vars)
        if output_was_redacted:
            log("WARNING: Sensitive values were redacted from output")

        # 17. Return success response
        return _build_response(
            run_id=run_id,
            status="success",
            http_status=response.status_code,
            duration_ms=duration_ms,
            logs=redacted_logs,
            http_headers=dict(response.headers),
            response_body=redacted_response_body,
            artifacts=artifacts,
            redactions_applied=output_was_redacted,
        )

    except asyncio.TimeoutError:
        duration_ms = int((time.time() - start_time) * 1000)
        return _build_response(
            run_id=run_id,
            status="timeout",
            http_status=408,
            duration_ms=duration_ms,
            logs="\n".join(logs),
            error_class="TIMEOUT",
            error_detail=f"Exceeded {max_timeout}s timeout",
            error_message=f"This run timed out after {max_timeout} seconds.",
            suggested_fix=(
                f"Try reducing the workload, optimizing your code, or using the "
                f"{'CPU' if lane == 'gpu' else 'GPU'} lane for heavy tasks."
            ),
        )

    except ExecutionError as e:
        duration_ms = int((time.time() - start_time) * 1000)
        return _build_response(
            run_id=run_id,
            status="error",
            http_status=500,
            duration_ms=duration_ms,
            logs="\n".join(logs),
            error_class=e.error_class,
            error_detail=e.detail,
            error_message=e.message,
            suggested_fix=e.suggested_fix,
        )

    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        from errors.taxonomy import classify_error

        error_info = classify_error(e)
        return _build_response(
            run_id=run_id,
            status="error",
            http_status=500,
            duration_ms=duration_ms,
            logs="\n".join(logs),
            error_class=error_info["error_class"],
            error_detail=str(e),
            error_message=error_info["message"],
            suggested_fix=error_info["suggested_fix"],
        )

    finally:
        # Restore baseline environment (removes any leaked secrets)
        os.environ.clear()
        os.environ.update(baseline_env)
        if temp_dir_to_cleanup and temp_dir_to_cleanup.exists():
            import shutil

            try:
                shutil.rmtree(temp_dir_to_cleanup)
            except Exception as cleanup_error:
                print(f"[WARN] Failed to clean up temp directory: {cleanup_error}", file=sys.stderr)
