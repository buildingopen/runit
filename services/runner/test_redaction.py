#!/usr/bin/env python3
"""
Test redaction system - Verify secrets are properly redacted from logs and outputs
"""

import sys

sys.path.insert(0, "src")

from security.redaction import redact_output, redact_secrets


def test_exact_value_redaction():
    """Test that exact secret values are redacted"""
    print("Testing exact value redaction...")

    secrets = {
        "OPENAI_API_KEY": "sk-test1234567890abcdef1234567890abcdef123456",
        "DATABASE_PASSWORD": "my-secret-password-123",
    }

    # Test log redaction
    logs = """
    Starting application...
    Connecting to database with password: my-secret-password-123
    Using API key: sk-test1234567890abcdef1234567890abcdef123456
    """

    redacted = redact_secrets(logs, secrets)

    print(f"  Original: {logs[:100]}...")
    print(f"  Redacted: {redacted[:100]}...")

    assert "my-secret-password-123" not in redacted, "Password not redacted!"
    assert "sk-test1234567890abcdef1234567890abcdef123456" not in redacted, "API key not redacted!"
    # Exact values are replaced first, then patterns, so we check for the key name
    assert (
        "[REDACTED:DATABASE_PASSWORD]" in redacted or "[REDACTED]" in redacted
    ), "Missing redaction marker for password"
    assert (
        "[REDACTED:OPENAI_API_KEY]" in redacted or "[REDACTED]" in redacted
    ), "Missing redaction marker for API key"

    print("✓ Exact value redaction works")


def test_pattern_redaction():
    """Test that common patterns are redacted"""
    print("Testing pattern redaction...")

    secrets = {}  # No exact values

    # Test various patterns
    test_cases = [
        ("sk-proj1234567890abcdef1234567890abcdef123456", "OpenAI key"),
        ("AIzaSyA1234567890123456789012345678901234", "Google API key"),
        ("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc", "JWT token"),
        ("ghp_1234567890123456789012345678901234ab", "GitHub token"),
        ("xoxb-1234-5678-abcdefghij", "Slack token"),
        ("192.168.1.1:8080:username:password123", "Proxy credentials"),
    ]

    for value, description in test_cases:
        logs = f"Using credential: {value}"
        redacted = redact_secrets(logs, secrets)

        assert value not in redacted, f"{description} not redacted! Got: {redacted}"
        assert "[REDACTED" in redacted, f"Missing redaction marker for {description}"

    print("✓ Pattern redaction works")


def test_output_redaction():
    """Test output redaction (response bodies)"""
    print("Testing output redaction...")

    secrets = {
        "API_KEY": "sk-test1234567890abcdef1234567890abcdef123456",
    }

    # Test JSON output
    output = {
        "status": "success",
        "api_key": "sk-test1234567890abcdef1234567890abcdef123456",
        "data": {"nested": "sk-test1234567890abcdef1234567890abcdef123456"},
    }

    redacted, was_redacted = redact_output(output, secrets)

    assert was_redacted, "Should have been flagged as redacted"
    assert "sk-test1234567890abcdef1234567890abcdef123456" not in str(
        redacted
    ), "Secret leaked in output!"

    print("✓ Output redaction works")


def test_no_false_positives():
    """Test that normal text isn't over-redacted"""
    print("Testing for false positives...")

    secrets = {"PASSWORD": "secret123"}

    # These should NOT be redacted
    logs = """
    Application started successfully
    Processing request ID: 12345
    Response time: 2.3 seconds
    """

    redacted = redact_secrets(logs, secrets)

    # Should be unchanged (no secrets present)
    assert "Application started successfully" in redacted
    assert "Processing request ID: 12345" in redacted
    assert "[REDACTED" not in redacted

    print("✓ No false positives")


def test_multiple_occurrences():
    """Test that all occurrences are redacted"""
    print("Testing multiple occurrences...")

    secrets = {"KEY": "secret-value"}

    logs = """
    First use: secret-value
    Second use: secret-value
    Third use: secret-value
    """

    redacted = redact_secrets(logs, secrets)

    # All should be redacted
    assert "secret-value" not in redacted, "Some occurrences not redacted!"
    assert redacted.count("[REDACTED:KEY]") == 3, "Not all occurrences redacted!"

    print("✓ Multiple occurrences redacted")


def main():
    """Run all tests"""
    print("\n=== Redaction System Tests ===\n")

    try:
        test_exact_value_redaction()
        test_pattern_redaction()
        test_output_redaction()
        test_no_false_positives()
        test_multiple_occurrences()

        print("\n=== All Tests Passed ✓ ===\n")
        print("Exit Criteria:")
        print("✓ Exact secret values redacted from logs")
        print("✓ Common patterns (API keys, tokens, etc.) detected and redacted")
        print("✓ Output (response bodies) redacted")
        print("✓ No false positives")
        print("✓ Multiple occurrences handled")
        print("")
        return 0

    except AssertionError as e:
        print(f"\n✗ Test failed: {e}\n")
        return 1


if __name__ == "__main__":
    sys.exit(main())
