"""
ABOUTME: Secrets redaction - Removes secrets from logs and outputs
ABOUTME: Uses pattern matching and exact value replacement to prevent leakage
"""

import re
from typing import Dict

# Common secret patterns to redact (as specified in CLAUDE.md section 9)
REDACT_PATTERNS = [
    r"sk-[a-zA-Z0-9]{40,}",  # OpenAI-style keys
    r"AIzaSy[a-zA-Z0-9_-]{33}",  # Google API keys
    r"eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+",  # JWT tokens (full format)
    r"ghp_[a-zA-Z0-9]{36}",  # GitHub tokens
    r"xoxb-[a-zA-Z0-9-]+",  # Slack tokens
    r"re_[a-zA-Z0-9]{20,}",  # Resend API keys
    r"ak-[a-zA-Z0-9]+",  # Modal API keys
    r"as-[a-zA-Z0-9]+",  # Modal secret keys
    r"\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+:[^:]+:[^\s]+",  # Proxy creds
    r"(?i)(api[_-]?key|secret|password|token)[\s:=]+['\"]?([^\s'\"]{8,})",  # Generic patterns
]


def redact_secrets(text: str, secret_env_vars: Dict[str, str]) -> str:
    """
    Redact secrets from text using pattern matching and exact values.

    Args:
        text: Text to redact (logs, errors, etc.)
        secret_env_vars: Dict of environment variable secrets {KEY: value}

    Returns:
        Redacted text with secrets replaced by [REDACTED] or [REDACTED:KEY_NAME]
    """
    redacted = text

    # 1. Redact common patterns FIRST (before exact values)
    # This prevents partial matches from interfering with named redaction
    for pattern in REDACT_PATTERNS[:-1]:  # All except generic pattern
        redacted = re.sub(pattern, "[REDACTED]", redacted)

    # 2. Redact exact secret values with key names
    for key, value in secret_env_vars.items():
        if value and len(value) > 0:
            # Replace exact value with [REDACTED:KEY_NAME]
            redacted = redacted.replace(value, f"[REDACTED:{key}]")

    # 3. Apply generic pattern last (as catch-all)
    # But only to values not already redacted
    redacted = re.sub(
        REDACT_PATTERNS[-1],  # Generic pattern
        lambda m: "[REDACTED]" if "REDACTED" not in m.group(0) else m.group(0),
        redacted,
    )

    return redacted


def redact_output(output: any, secret_env_vars: Dict[str, str]) -> tuple[any, bool]:
    """
    Redact secrets from output (response body).

    Args:
        output: Output to redact (can be dict, str, etc.)
        secret_env_vars: Dict of environment variable secrets

    Returns:
        Tuple of (redacted_output, was_redacted)
    """
    import json

    # Convert to string for redaction
    if isinstance(output, dict) or isinstance(output, list):
        output_str = json.dumps(output)
    else:
        output_str = str(output)

    # Redact
    redacted_str = redact_secrets(output_str, secret_env_vars)

    # Check if anything was redacted
    was_redacted = redacted_str != output_str

    # Convert back to original type
    if isinstance(output, dict) or isinstance(output, list):
        try:
            redacted_output = json.loads(redacted_str)
        except json.JSONDecodeError:
            # If redaction broke JSON, return as string
            redacted_output = redacted_str
    else:
        redacted_output = redacted_str

    return redacted_output, was_redacted


def validate_context_keys(context: Dict[str, any]) -> None:
    """
    Validate that context doesn't contain secret-like keys.

    Raises ValueError if forbidden keys found.

    Args:
        context: Context dictionary to validate
    """
    forbidden_context_patterns = [
        r".*_KEY$",
        r".*_TOKEN$",
        r".*_SECRET$",
        r"^PASSWORD",
        r"^API_KEY",
        r"^SECRET",
    ]

    for key in context.keys():
        for pattern in forbidden_context_patterns:
            if re.match(pattern, key, re.IGNORECASE):
                raise ValueError(
                    f"Context key '{key}' looks like a secret. "
                    "Use Secrets instead of Context for sensitive values."
                )
