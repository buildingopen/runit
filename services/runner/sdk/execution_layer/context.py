"""
Context access utilities for Execution Layer.

Provides access to:
- Secrets (environment variables prefixed with SECRET_)
- Context data (uploaded JSON files mounted at /context/)
"""

import json
import os
from pathlib import Path
from typing import Any, Optional


class Context:
    """
    Access execution context data (secrets, uploaded context).

    Examples:
        >>> from execution_layer import context
        >>>
        >>> # Get a secret
        >>> api_key = context.get_secret("OPENAI_API_KEY")
        >>>
        >>> # Get uploaded context
        >>> company_data = context.get_context("company")
        >>>
        >>> # List all available contexts
        >>> contexts = context.list_contexts()
    """

    def __init__(self):
        self._context_dir = Path(os.getenv("EL_CONTEXT_DIR", "/context"))

    def get_secret(self, key: str) -> Optional[str]:
        """
        Get secret from environment variables.

        Secrets are injected as environment variables prefixed with SECRET_.

        Args:
            key: Secret key (without SECRET_ prefix)

        Returns:
            Secret value if exists, None otherwise

        Examples:
            >>> api_key = context.get_secret("OPENAI_API_KEY")
            >>> # Looks for SECRET_OPENAI_API_KEY env var
        """
        return os.getenv(f"SECRET_{key}")

    def get_context(self, name: str) -> Optional[dict[str, Any]]:
        """
        Get uploaded context by name.

        Context files are mounted at /context/*.json

        Args:
            name: Context name (without .json extension)

        Returns:
            Parsed JSON context if exists, None otherwise

        Examples:
            >>> company = context.get_context("company")
            >>> print(company["name"])
        """
        path = self._context_dir / f"{name}.json"
        if path.exists():
            try:
                with open(path) as f:
                    return json.load(f)
            except (json.JSONDecodeError, IOError):
                return None
        return None

    def list_contexts(self) -> list[str]:
        """
        List all available context files.

        Returns:
            List of context names (without .json extension)

        Examples:
            >>> contexts = context.list_contexts()
            >>> print(contexts)
            ['company', 'user_preferences']
        """
        if not self._context_dir.exists():
            return []

        return [f.stem for f in self._context_dir.glob("*.json")]  # Remove .json extension

    def has_context(self, name: str) -> bool:
        """
        Check if a context file exists.

        Args:
            name: Context name (without .json extension)

        Returns:
            True if context exists, False otherwise
        """
        path = self._context_dir / f"{name}.json"
        return path.exists()


# Singleton instance
context = Context()
