"""
OpenAPI Bridge Service

ABOUTME: FastAPI service that loads user apps and extracts OpenAPI schemas
ABOUTME: Runs with timeout protection and handles import errors safely
"""

import sys
import os
import json
import signal
import importlib
import traceback
from pathlib import Path
from contextlib import contextmanager
from typing import Any, Dict, Optional

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel


app = FastAPI(title="OpenAPI Bridge Service")


class ExtractRequest(BaseModel):
    """Request to extract OpenAPI schema from a user project"""

    zip_path: str
    entrypoint: str = "main:app"
    timeout_seconds: int = 30


class ExtractResponse(BaseModel):
    """OpenAPI extraction response"""

    openapi_schema: Dict[str, Any]
    entrypoint: str
    endpoints: list[Dict[str, Any]]
    success: bool
    error: Optional[str] = None
    error_type: Optional[str] = None


class TimeoutError(Exception):
    """Import timeout exceeded"""

    pass


@contextmanager
def timeout(seconds: int):
    """Context manager for timeout protection"""

    def timeout_handler(signum, frame):
        raise TimeoutError(f"Import exceeded {seconds}s timeout")

    # Set up timeout
    old_handler = signal.signal(signal.SIGALRM, timeout_handler)
    signal.alarm(seconds)

    try:
        yield
    finally:
        # Restore old handler and cancel alarm
        signal.alarm(0)
        signal.signal(signal.SIGALRM, old_handler)


def import_fastapi_app(entrypoint: str, project_path: str):
    """
    Import FastAPI app from entrypoint with timeout protection

    Args:
        entrypoint: Module:variable (e.g., "main:app")
        project_path: Path to project root

    Returns:
        FastAPI app instance

    Raises:
        TimeoutError: Import took too long
        ImportError: Module or app not found
        AttributeError: App variable doesn't exist
    """
    # Parse entrypoint
    if ":" not in entrypoint:
        raise ValueError(f"Invalid entrypoint format: {entrypoint}")

    module_name, app_var_name = entrypoint.split(":", 1)

    # Add project path to sys.path
    if project_path not in sys.path:
        sys.path.insert(0, project_path)

    try:
        # Import module with timeout
        module = importlib.import_module(module_name)

        # Get app variable
        if not hasattr(module, app_var_name):
            raise AttributeError(
                f"Module '{module_name}' has no attribute '{app_var_name}'"
            )

        app_instance = getattr(module, app_var_name)

        # Verify it's a FastAPI app
        from fastapi import FastAPI

        if not isinstance(app_instance, FastAPI):
            raise TypeError(
                f"{entrypoint} is not a FastAPI instance "
                f"(got {type(app_instance).__name__})"
            )

        return app_instance

    except ImportError as e:
        raise ImportError(f"Could not import module '{module_name}': {e}")


def extract_endpoints(openapi_schema: Dict[str, Any]) -> list[Dict[str, Any]]:
    """
    Extract endpoint list from OpenAPI schema

    Args:
        openapi_schema: Full OpenAPI 3.x schema

    Returns:
        List of endpoint metadata
    """
    endpoints = []

    paths = openapi_schema.get("paths", {})

    for path, methods in paths.items():
        for method, operation in methods.items():
            if method.lower() in ["get", "post", "put", "patch", "delete"]:
                endpoint_id = f"{method.upper()}_{path.replace('/', '_')}"

                endpoints.append(
                    {
                        "endpoint_id": endpoint_id,
                        "method": method.upper(),
                        "path": path,
                        "summary": operation.get("summary"),
                        "description": operation.get("description"),
                        "requires_gpu": detect_gpu_requirement(operation),
                    }
                )

    return endpoints


def detect_gpu_requirement(operation: Dict[str, Any]) -> bool:
    """
    Detect if endpoint likely requires GPU

    Args:
        operation: OpenAPI operation object

    Returns:
        True if GPU is likely required
    """
    # Check for GPU-related keywords in summary/description
    text = " ".join(
        [
            operation.get("summary", ""),
            operation.get("description", ""),
        ]
    ).lower()

    gpu_keywords = [
        "gpu",
        "inference",
        "predict",
        "model",
        "neural",
        "ml",
        "machine learning",
        "deep learning",
        "torch",
        "tensorflow",
    ]

    return any(keyword in text for keyword in gpu_keywords)


def classify_error(error: Exception) -> str:
    """
    Classify error type for better error messages

    Args:
        error: Exception that occurred

    Returns:
        Error type string
    """
    if isinstance(error, TimeoutError):
        return "timeout"
    elif isinstance(error, ImportError):
        return "import_error"
    elif isinstance(error, ModuleNotFoundError):
        return "dependency_missing"
    elif isinstance(error, AttributeError):
        return "no_fastapi_app"
    elif isinstance(error, SyntaxError):
        return "syntax_error"
    elif isinstance(error, TypeError):
        return "no_fastapi_app"
    else:
        return "import_error"


@app.post("/extract-openapi", response_model=ExtractResponse)
async def extract_openapi(request: ExtractRequest):
    """
    Extract OpenAPI schema from a user FastAPI app

    This endpoint:
    1. Imports the user's FastAPI app with timeout protection
    2. Calls app.openapi() to get the schema
    3. Extracts endpoint metadata
    4. Returns structured response with error classification
    """
    try:
        # Validate zip path exists
        project_path = Path(request.zip_path)
        if not project_path.exists():
            raise HTTPException(
                status_code=400, detail=f"Project path not found: {request.zip_path}"
            )

        # Import app with timeout
        with timeout(request.timeout_seconds):
            user_app = import_fastapi_app(
                request.entrypoint, str(project_path.absolute())
            )

        # Extract OpenAPI schema
        try:
            openapi_schema = user_app.openapi()
        except Exception as e:
            return ExtractResponse(
                openapi_schema={},
                entrypoint=request.entrypoint,
                endpoints=[],
                success=False,
                error=f"Failed to extract OpenAPI schema: {str(e)}",
                error_type="schema_extraction_failed",
            )

        # Extract endpoints
        endpoints = extract_endpoints(openapi_schema)

        return ExtractResponse(
            openapi_schema=openapi_schema,
            entrypoint=request.entrypoint,
            endpoints=endpoints,
            success=True,
        )

    except Exception as e:
        # Classify error
        error_type = classify_error(e)

        # Get traceback
        tb = traceback.format_exc()

        return ExtractResponse(
            openapi_schema={},
            entrypoint=request.entrypoint,
            endpoints=[],
            success=False,
            error=tb,
            error_type=error_type,
        )


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8001)
