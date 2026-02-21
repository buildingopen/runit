"""
ABOUTME: Secrets injection and redaction for runner environment
ABOUTME: Injects decrypted secrets as env vars, redacts from logs and outputs
"""

import os
import re
from typing import Any, Dict


def _should_redact_exact_value(value: str) -> bool:
    """Redact longer values and short token-like values, but avoid common plain words."""
    if len(value) >= 8:
        return True
    if len(value) >= 6 and (any(ch.isdigit() for ch in value) or "-" in value or "_" in value):
        return True
    return False


def inject_secrets(secrets: Dict[str, str]) -> None:
    """
    Inject decrypted secrets as environment variables.

    Args:
        secrets: Dictionary of secret key-value pairs (already decrypted)
    """
    for key, value in secrets.items():
        os.environ[key] = value


def redact_secrets_from_text(text: str, secrets: Dict[str, str]) -> tuple[str, bool]:
    """
    Redact secret values from text (logs, outputs, errors).

    Args:
        text: Text to redact from
        secrets: Dictionary of secret key-value pairs

    Returns:
        Tuple of (redacted_text, was_redacted)
    """
    redacted = text
    was_redacted = False

    # Redact exact secret values using conservative heuristics.
    for key, value in secrets.items():
        if value and _should_redact_exact_value(value):
            if value in redacted:
                redacted = redacted.replace(value, f"[REDACTED:{key}]")
                was_redacted = True

    # Redact common secret patterns
    patterns = [
        (r"sk-[a-zA-Z0-9-]{10,}", "[REDACTED]"),
        (r"AIzaSy[a-zA-Z0-9_-]{33}", "[REDACTED]"),
        (r"eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)?", "[REDACTED]"),
        (r"ghp_[a-zA-Z0-9]{30,}", "[REDACTED]"),
        (r"xoxb-[a-zA-Z0-9-]+", "[REDACTED]"),
    ]

    for pattern, replacement in patterns:
        if re.search(pattern, redacted):
            redacted = re.sub(pattern, replacement, redacted)
            was_redacted = True

    return redacted, was_redacted


def redact_secrets_from_dict(data: Any, secrets: Dict[str, str]) -> tuple[Any, bool]:
    """
    Recursively redact secrets from dictionary/list structures.

    Args:
        data: Data structure to redact from
        secrets: Dictionary of secret key-value pairs

    Returns:
        Tuple of (redacted_data, was_redacted)
    """
    was_redacted = False

    if isinstance(data, dict):
        redacted = {}
        for key, value in data.items():
            redacted_value, value_redacted = redact_secrets_from_dict(value, secrets)
            redacted[key] = redacted_value
            was_redacted = was_redacted or value_redacted
        return redacted, was_redacted

    elif isinstance(data, list):
        redacted = []
        for item in data:
            redacted_item, item_redacted = redact_secrets_from_dict(item, secrets)
            redacted.append(redacted_item)
            was_redacted = was_redacted or item_redacted
        return redacted, was_redacted

    elif isinstance(data, str):
        redacted_str, str_redacted = redact_secrets_from_text(data, secrets)
        return redacted_str, str_redacted

    else:
        return data, False


def validate_secret_key(key: str) -> tuple[bool, str | None]:
    """
    Validate secret key naming.

    Returns:
        Tuple of (is_valid, error_message)
    """
    # Must be UPPERCASE_SNAKE_CASE
    if not re.match(r"^[A-Z_][A-Z0-9_]*$", key):
        return False, "Secret key must use UPPERCASE_SNAKE_CASE (A-Z, 0-9, _)"

    # Cannot use reserved prefix
    if key.startswith("EL_"):
        return False, f"Secret key '{key}' uses reserved prefix 'EL_'. Choose a different name."

    return True, None
