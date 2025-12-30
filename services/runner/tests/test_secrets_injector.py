"""
Tests for secrets injection and redaction
"""

import os
import pytest
from src.secrets.injector import (
    inject_secrets,
    redact_secrets_from_text,
    redact_secrets_from_dict,
    validate_secret_key,
)


def test_inject_secrets():
    """Test that secrets are injected as environment variables"""
    secrets = {
        "API_KEY": "sk-1234567890",
        "DB_PASSWORD": "super-secret"
    }

    inject_secrets(secrets)

    assert os.environ.get("API_KEY") == "sk-1234567890"
    assert os.environ.get("DB_PASSWORD") == "super-secret"

    # Cleanup
    del os.environ["API_KEY"]
    del os.environ["DB_PASSWORD"]


def test_redact_exact_values():
    """Test redaction of exact secret values"""
    secrets = {
        "API_KEY": "sk-1234567890",
        "PASSWORD": "my-secret-pass"
    }

    text = "Error connecting with sk-1234567890 and password my-secret-pass"
    redacted, was_redacted = redact_secrets_from_text(text, secrets)

    assert was_redacted
    assert "[REDACTED:API_KEY]" in redacted
    assert "[REDACTED:PASSWORD]" in redacted
    assert "sk-1234567890" not in redacted
    assert "my-secret-pass" not in redacted


def test_redact_patterns():
    """Test redaction of common secret patterns"""
    text = """
    OpenAI key: sk-abcdefghijklmnopqrstuvwxyz123456789012345678
    Google key: AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ1234567
    JWT token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0
    GitHub token: ghp_abcdefghijklmnopqrstuvwxyz123456
    Slack token: xoxb-1234567890-abcdefghijklmnopqrstuvwxyz
    """

    redacted, was_redacted = redact_secrets_from_text(text, {})

    assert was_redacted
    # Pattern-based redaction uses generic [REDACTED] without key names
    assert "[REDACTED]" in redacted
    assert "sk-abcdefghijklmnopqrstuvwxyz123456789012345678" not in redacted
    assert "AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ1234567" not in redacted
    assert "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" not in redacted
    assert "ghp_abcdefghijklmnopqrstuvwxyz123456" not in redacted
    assert "xoxb-1234567890-abcdefghijklmnopqrstuvwxyz" not in redacted


def test_redact_from_dict():
    """Test redaction from nested dictionaries"""
    secrets = {
        "API_KEY": "secret-key-123"
    }

    data = {
        "status": "error",
        "message": "Failed to authenticate with secret-key-123",
        "details": {
            "headers": {
                "Authorization": "Bearer secret-key-123"
            }
        }
    }

    redacted, was_redacted = redact_secrets_from_dict(data, secrets)

    assert was_redacted
    assert "[REDACTED:API_KEY]" in redacted["message"]
    assert "[REDACTED:API_KEY]" in redacted["details"]["headers"]["Authorization"]
    assert "secret-key-123" not in str(redacted)


def test_redact_from_list():
    """Test redaction from lists"""
    secrets = {"TOKEN": "abc123"}

    data = [
        "First item",
        "Second item with abc123",
        {"key": "value with abc123"}
    ]

    redacted, was_redacted = redact_secrets_from_dict(data, secrets)

    assert was_redacted
    assert redacted[0] == "First item"
    assert "[REDACTED:TOKEN]" in redacted[1]
    assert "[REDACTED:TOKEN]" in redacted[2]["key"]


def test_no_redaction_needed():
    """Test that clean text returns unchanged"""
    secrets = {"API_KEY": "secret"}

    text = "This is clean text with no secrets"
    redacted, was_redacted = redact_secrets_from_text(text, secrets)

    assert not was_redacted
    assert redacted == text


def test_validate_secret_key_valid():
    """Test valid secret key names"""
    valid_keys = [
        "API_KEY",
        "DATABASE_URL",
        "STRIPE_API_KEY",
        "MY_SECRET_123",
        "_PRIVATE_KEY"
    ]

    for key in valid_keys:
        is_valid, error = validate_secret_key(key)
        assert is_valid, f"{key} should be valid, got error: {error}"
        assert error is None


def test_validate_secret_key_invalid_format():
    """Test invalid secret key formats"""
    invalid_keys = [
        "lowercase",           # Not uppercase
        "Mixed-Case",          # Contains dash
        "has spaces",          # Contains spaces
        "123_STARTS_NUMBER",   # Starts with number
        "KEY-WITH-DASH",       # Contains dash
    ]

    for key in invalid_keys:
        is_valid, error = validate_secret_key(key)
        assert not is_valid, f"{key} should be invalid"
        assert "UPPERCASE_SNAKE_CASE" in error


def test_validate_secret_key_reserved_prefix():
    """Test that EL_ prefix is rejected"""
    reserved_keys = [
        "EL_CONTEXT_DIR",
        "EL_PROJECT_ID",
        "EL_SEED"
    ]

    for key in reserved_keys:
        is_valid, error = validate_secret_key(key)
        assert not is_valid
        assert "reserved prefix" in error
        assert "EL_" in error


def test_empty_secrets_dict():
    """Test handling of empty secrets dictionary"""
    text = "Some text with sk-1234567890"
    redacted, was_redacted = redact_secrets_from_text(text, {})

    # Should still redact patterns
    assert was_redacted
    assert "[REDACTED:API_KEY]" in redacted


def test_empty_string_value():
    """Test handling of empty string secret values"""
    secrets = {
        "EMPTY": "",
        "API_KEY": "real-value"
    }

    text = "Text with real-value"
    redacted, was_redacted = redact_secrets_from_text(text, secrets)

    assert was_redacted
    assert "[REDACTED:API_KEY]" in redacted
