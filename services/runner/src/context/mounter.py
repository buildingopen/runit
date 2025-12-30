"""
ABOUTME: Context mounter for making context data available to runs
ABOUTME: Mounts context as read-only JSON files at /context/*.json
"""

import json
import os
from pathlib import Path
from typing import Dict, Any


CONTEXT_DIR = Path("/context")
MAX_CONTEXT_SIZE = 1024 * 1024  # 1MB


class ContextMountError(Exception):
    """Raised when context mounting fails"""
    pass


def validate_context_size(context_data: Dict[str, Any]) -> None:
    """
    Validate that context data doesn't exceed size limits

    Args:
        context_data: Dictionary of context name -> context data

    Raises:
        ContextMountError: If context exceeds size limits
    """
    total_size = 0

    for name, data in context_data.items():
        json_str = json.dumps(data)
        size = len(json_str.encode('utf-8'))
        total_size += size

        if total_size > MAX_CONTEXT_SIZE:
            raise ContextMountError(
                f"Context data exceeds {MAX_CONTEXT_SIZE} byte limit "
                f"(current: {total_size} bytes)"
            )


def write_context_files(context_data: Dict[str, Any]) -> None:
    """
    Write context data to /context/*.json files

    Args:
        context_data: Dictionary mapping context name to context data

    Example:
        context_data = {
            "company": {"name": "ACME", "industry": "SaaS"},
            "user_prefs": {"theme": "dark"}
        }

        Creates:
        - /context/company.json
        - /context/user_prefs.json

    Raises:
        ContextMountError: If validation or write fails
    """
    # Validate total size
    validate_context_size(context_data)

    # Create context directory if it doesn't exist
    CONTEXT_DIR.mkdir(parents=True, exist_ok=True)

    # Write each context as a separate JSON file
    for name, data in context_data.items():
        # Validate name (alphanumeric, hyphens, underscores only)
        if not name.replace('-', '').replace('_', '').isalnum():
            raise ContextMountError(
                f"Invalid context name '{name}'. "
                "Use only letters, numbers, hyphens, and underscores."
            )

        context_file = CONTEXT_DIR / f"{name}.json"

        try:
            # Write JSON with pretty formatting
            with open(context_file, 'w') as f:
                json.dump(data, f, indent=2)

            # Make read-only (chmod 444)
            os.chmod(context_file, 0o444)

        except Exception as e:
            raise ContextMountError(
                f"Failed to write context file '{name}.json': {str(e)}"
            )


def mount_context(context_ref: str | Dict[str, Any]) -> Dict[str, Path]:
    """
    Mount context data to /context/*.json

    Args:
        context_ref: Either a JSON string or dict of context data

    Returns:
        Dictionary mapping context name to file path

    Example:
        mounted = mount_context({"company": {"name": "ACME"}})
        # Returns: {"company": Path("/context/company.json")}

        # User code can then:
        # with open("/context/company.json") as f:
        #     data = json.load(f)
    """
    # Parse context_ref if it's a string
    if isinstance(context_ref, str):
        try:
            context_data = json.loads(context_ref)
        except json.JSONDecodeError as e:
            raise ContextMountError(f"Invalid context JSON: {str(e)}")
    else:
        context_data = context_ref

    # Write context files
    write_context_files(context_data)

    # Return mapping of name -> path
    mounted_files = {}
    for name in context_data.keys():
        mounted_files[name] = CONTEXT_DIR / f"{name}.json"

    return mounted_files


def get_context_env_var() -> str:
    """
    Get the EL_CONTEXT_DIR environment variable value
    Used by user code to discover context directory
    """
    return str(CONTEXT_DIR)


def list_available_contexts() -> list[str]:
    """
    List all available context names

    Returns:
        List of context names (without .json extension)
    """
    if not CONTEXT_DIR.exists():
        return []

    contexts = []
    for file in CONTEXT_DIR.glob("*.json"):
        contexts.append(file.stem)

    return contexts
