"""Tests for security redaction module."""

from security.redaction import redact_secrets, redact_output, validate_context_keys
import pytest


def test_redact_exact_values():
    text = "Connecting with key=my-api-key-12345678 and password=mysecretpass123"
    env = {"API_KEY": "my-api-key-12345678", "PASSWORD": "mysecretpass123"}
    result = redact_secrets(text, env)
    assert "my-api-key-12345678" not in result
    assert "mysecretpass123" not in result
    assert "[REDACTED:API_KEY]" in result
    assert "[REDACTED:PASSWORD]" in result


def test_redact_openai_pattern():
    text = "Using key sk-" + "a" * 40 + " for auth"
    result = redact_secrets(text, {})
    assert "sk-" + "a" * 40 not in result
    assert "[REDACTED]" in result


def test_redact_jwt_pattern():
    jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U"
    text = f"Token: {jwt}"
    result = redact_secrets(text, {})
    assert jwt not in result


def test_redact_github_token():
    token = "ghp_" + "x" * 36
    text = f"auth: {token}"
    result = redact_secrets(text, {})
    assert token not in result


def test_redact_output_dict():
    output = {"api_key": "sk-" + "b" * 40, "result": "ok"}
    env = {}
    redacted, was_redacted = redact_output(output, env)
    assert was_redacted
    assert "sk-" + "b" * 40 not in str(redacted)


def test_redact_output_string():
    output = "plain text with no secrets"
    _, was_redacted = redact_output(output, {})
    assert not was_redacted


def test_redact_output_list():
    output = [{"key": "value"}]
    redacted, was_redacted = redact_output(output, {})
    assert not was_redacted
    assert redacted == [{"key": "value"}]


def test_validate_context_keys_ok():
    validate_context_keys({"company": "ACME", "preferences": {}})


def test_validate_context_keys_forbidden():
    with pytest.raises(ValueError, match="looks like a secret"):
        validate_context_keys({"API_KEY": "value"})

    with pytest.raises(ValueError, match="looks like a secret"):
        validate_context_keys({"auth_token": "value"})

    with pytest.raises(ValueError, match="looks like a secret"):
        validate_context_keys({"db_secret": "value"})
