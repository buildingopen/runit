"""
ABOUTME: Context helpers for accessing mounted context data in user code
ABOUTME: Provides simple API for reading /context/*.json files
"""

import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional


# Context directory (mounted read-only by platform)
CONTEXT_DIR = Path(os.getenv("EL_CONTEXT_DIR", "/context"))


class ContextNotFoundError(Exception):
    """Raised when requested context doesn't exist"""
    pass


def get_context(name: str) -> Dict[str, Any]:
    """
    Get context data by name

    Args:
        name: Context name (without .json extension)

    Returns:
        Context data as dictionary

    Raises:
        ContextNotFoundError: If context doesn't exist
        json.JSONDecodeError: If context file is invalid JSON

    Example:
        # Platform mounts /context/company.json
        company = get_context("company")
        print(company["name"])  # "ACME Inc"
    """
    context_file = CONTEXT_DIR / f"{name}.json"

    if not context_file.exists():
        raise ContextNotFoundError(
            f"Context '{name}' not found. "
            f"Available contexts: {', '.join(list_contexts()) or 'none'}"
        )

    with open(context_file, 'r') as f:
        return json.load(f)


def list_contexts() -> List[str]:
    """
    List all available context names

    Returns:
        List of context names (without .json extension)

    Example:
        contexts = list_contexts()
        print(contexts)  # ["company", "user_prefs"]
    """
    if not CONTEXT_DIR.exists():
        return []

    contexts = []
    for file in CONTEXT_DIR.glob("*.json"):
        contexts.append(file.stem)

    return sorted(contexts)


def has_context(name: str) -> bool:
    """
    Check if a context exists

    Args:
        name: Context name (without .json extension)

    Returns:
        True if context exists, False otherwise

    Example:
        if has_context("company"):
            company = get_context("company")
    """
    context_file = CONTEXT_DIR / f"{name}.json"
    return context_file.exists()


def get_context_path(name: str) -> Optional[Path]:
    """
    Get the file path for a context

    Args:
        name: Context name (without .json extension)

    Returns:
        Path to context file, or None if it doesn't exist

    Example:
        path = get_context_path("company")
        if path:
            with open(path) as f:
                data = json.load(f)
    """
    context_file = CONTEXT_DIR / f"{name}.json"
    return context_file if context_file.exists() else None
