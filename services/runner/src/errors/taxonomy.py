"""
ABOUTME: Error taxonomy - Classifies exceptions into user-friendly error classes
ABOUTME: Provides error messages and suggested fixes for common failure modes
"""

from typing import Dict

# Error class definitions with messages and fixes
ERROR_TAXONOMY = {
    "DEPS_INSTALL_FAILED": {
        "message": "Dependency installation failed.",
        "suggested_fix": (
            "Check that all package names are correct and available on PyPI. "
            "Try installing locally first to verify."
        ),
    },
    "DEPS_INSTALL_TIMEOUT": {
        "message": "Dependency installation took too long.",
        "suggested_fix": (
            "Try reducing the number of dependencies or using pre-built wheels. "
            "Large ML libraries may exceed our timeout."
        ),
    },
    "ENTRYPOINT_NOT_FOUND": {
        "message": "Couldn't find your FastAPI app.",
        "suggested_fix": (
            "Rename your file to main.py and export app = FastAPI(), "
            "or create executionlayer.toml with: entrypoint = 'your_module:app'"
        ),
    },
    "IMPORT_ERROR": {
        "message": "Failed to import a required module.",
        "suggested_fix": (
            "Check that all required packages are in requirements.txt. "
            "Try importing the module locally to verify it works."
        ),
    },
    "IMPORT_TIMEOUT": {
        "message": "Import took too long (>30s).",
        "suggested_fix": (
            "Your app does heavy work at import/startup. "
            "Try moving initialization to a lazy-loaded function or endpoint."
        ),
    },
    "CIRCULAR_IMPORT": {
        "message": "Circular import detected.",
        "suggested_fix": ("Refactor your code to remove circular dependencies between modules."),
    },
    "OPENAPI_GENERATION_FAILED": {
        "message": "Couldn't generate OpenAPI schema from your app.",
        "suggested_fix": (
            "Check that your FastAPI app is properly configured. "
            "Try accessing app.openapi() locally."
        ),
    },
    "ENDPOINT_NOT_FOUND": {
        "message": "The requested endpoint doesn't exist in your app.",
        "suggested_fix": (
            "Check that the endpoint path and method match your FastAPI routes. "
            "Try accessing the /docs page locally."
        ),
    },
    "REQUEST_VALIDATION_FAILED": {
        "message": "Invalid input for this endpoint.",
        "suggested_fix": (
            "Check that your inputs match the endpoint's schema. "
            "See the OpenAPI docs for required fields and types."
        ),
    },
    "TIMEOUT": {
        "message": "Run exceeded the timeout limit.",
        "suggested_fix": (
            "Try reducing the workload, optimizing your code, or using the GPU lane "
            "for heavy tasks."
        ),
    },
    "OUT_OF_MEMORY": {
        "message": "Run exceeded memory limits and was killed.",
        "suggested_fix": (
            "Reduce batch size, use streaming, or request the GPU lane with more memory."
        ),
    },
    "NETWORK_POLICY_VIOLATION": {
        "message": "Attempted to access a blocked IP address.",
        "suggested_fix": (
            "Private IPs, localhost, and cloud metadata endpoints are blocked for security. "
            "Use public URLs only."
        ),
    },
    "NETWORK_FAILED": {
        "message": "Outbound network request failed.",
        "suggested_fix": (
            "Check that the URL is correct and the remote server is accessible. "
            "Rate limits may apply (200 requests per run)."
        ),
    },
    "RUNTIME_CRASH": {
        "message": "Uncaught exception in your code.",
        "suggested_fix": (
            "Check the logs for the full stack trace and fix the error in your code."
        ),
    },
    "LIFESPAN_FAILED": {
        "message": "FastAPI startup event crashed.",
        "suggested_fix": (
            "Check your @app.on_event('startup') handlers. " "They should not raise exceptions."
        ),
    },
    "PYTHON_VERSION_MISMATCH": {
        "message": "Your code requires a different Python version.",
        "suggested_fix": ("We support Python 3.11 only. Update your code to be compatible."),
    },
    "MISSING_SYSTEM_LIBRARY": {
        "message": "Required system library not found in base image.",
        "suggested_fix": (
            "The base image includes common libraries. "
            "If you need additional system packages, contact support."
        ),
    },
    "FILE_SYSTEM_FULL": {
        "message": "Exceeded disk space limits.",
        "suggested_fix": (
            "Reduce the amount of data written to /tmp or /artifacts. "
            "Limits: 2GB (CPU), 5GB (GPU)."
        ),
    },
    "ARTIFACT_UPLOAD_FAILED": {
        "message": "Failed to upload artifacts to storage.",
        "suggested_fix": (
            "This is a platform issue. Please try again. "
            "If it persists, contact support with the run ID."
        ),
    },
    "SECRETS_DECRYPTION_FAILED": {
        "message": "Failed to decrypt secrets.",
        "suggested_fix": (
            "This is a platform issue. Please try again. "
            "If it persists, contact support with the run ID."
        ),
    },
}


def classify_error(exception: Exception) -> Dict[str, str]:
    """
    Classify an exception into an error class with message and fix.

    Args:
        exception: The exception to classify

    Returns:
        {
            "error_class": str,
            "message": str,
            "suggested_fix": str
        }
    """
    error_str = str(exception).lower()
    exception_type = type(exception).__name__

    # Check for specific patterns
    if isinstance(exception, ImportError) or exception_type == "ModuleNotFoundError":
        if "circular" in error_str:
            return {
                "error_class": "CIRCULAR_IMPORT",
                **ERROR_TAXONOMY["CIRCULAR_IMPORT"],
            }
        else:
            return {"error_class": "IMPORT_ERROR", **ERROR_TAXONOMY["IMPORT_ERROR"]}

    if isinstance(exception, TimeoutError) or "timeout" in error_str:
        if "import" in error_str or "startup" in error_str:
            return {
                "error_class": "IMPORT_TIMEOUT",
                **ERROR_TAXONOMY["IMPORT_TIMEOUT"],
            }
        else:
            return {"error_class": "TIMEOUT", **ERROR_TAXONOMY["TIMEOUT"]}

    if isinstance(exception, MemoryError) or "memory" in error_str:
        return {"error_class": "OUT_OF_MEMORY", **ERROR_TAXONOMY["OUT_OF_MEMORY"]}

    if "validation" in error_str or "pydantic" in error_str:
        return {
            "error_class": "REQUEST_VALIDATION_FAILED",
            **ERROR_TAXONOMY["REQUEST_VALIDATION_FAILED"],
        }

    if "network" in error_str or "connection" in error_str:
        if "blocked" in error_str or "policy" in error_str:
            return {
                "error_class": "NETWORK_POLICY_VIOLATION",
                **ERROR_TAXONOMY["NETWORK_POLICY_VIOLATION"],
            }
        else:
            return {
                "error_class": "NETWORK_FAILED",
                **ERROR_TAXONOMY["NETWORK_FAILED"],
            }

    if "lifespan" in error_str or "startup" in error_str:
        return {
            "error_class": "LIFESPAN_FAILED",
            **ERROR_TAXONOMY["LIFESPAN_FAILED"],
        }

    if "python" in error_str and "version" in error_str:
        return {
            "error_class": "PYTHON_VERSION_MISMATCH",
            **ERROR_TAXONOMY["PYTHON_VERSION_MISMATCH"],
        }

    if "library" in error_str or ".so" in error_str:
        return {
            "error_class": "MISSING_SYSTEM_LIBRARY",
            **ERROR_TAXONOMY["MISSING_SYSTEM_LIBRARY"],
        }

    if "disk" in error_str or "space" in error_str or "quota" in error_str:
        return {
            "error_class": "FILE_SYSTEM_FULL",
            **ERROR_TAXONOMY["FILE_SYSTEM_FULL"],
        }

    # Default to runtime crash
    return {"error_class": "RUNTIME_CRASH", **ERROR_TAXONOMY["RUNTIME_CRASH"]}
