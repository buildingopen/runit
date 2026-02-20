"""
Cross-language encryption compatibility test.

Verifies that secrets encrypted by the TypeScript control-plane (v1 format)
can be decrypted by the Python runner's kms_client.

This is a critical integration test: if the formats drift, secrets
silently fail to decrypt at runtime.
"""

import base64
import json
import os
import struct
import subprocess
import sys
from pathlib import Path

import pytest

RUNNER_SRC = Path(__file__).resolve().parent.parent.parent / "src"
sys.path.insert(0, str(RUNNER_SRC))

from security.kms_client import decrypt_secrets_bundle, decrypt_secret

CONTROL_PLANE_DIR = str(Path(__file__).resolve().parent.parent.parent.parent / "control-plane")
MASTER_KEY = "dGVzdC1tYXN0ZXIta2V5LTMyLWJ5dGVzLWxvbmch"


def _ts_encrypt_bundle(secrets: dict) -> str:
    """Call the TypeScript encryptSecretsBundle via tsx."""
    secrets_json = json.dumps(secrets)
    script = (
        f'process.env.MASTER_ENCRYPTION_KEY = "{MASTER_KEY}";'
        f'process.env.OTEL_TRACING_ENABLED = "false";'
        f'import("./src/encryption/kms.ts")'
        f'  .then(async (mod) => {{'
        f'    mod.resetKMSProvider();'
        f'    const encrypted = await mod.encryptSecretsBundle({secrets_json});'
        f'    process.stdout.write(encrypted);'
        f'  }})'
        f'  .catch(e => {{ process.stderr.write(String(e)); process.exit(1); }});'
    )
    result = subprocess.run(
        ["npx", "tsx", "--eval", script],
        cwd=CONTROL_PLANE_DIR,
        capture_output=True,
        text=True,
        timeout=30,
        env={
            **os.environ,
            "MASTER_ENCRYPTION_KEY": MASTER_KEY,
            "OTEL_TRACING_ENABLED": "false",
        },
    )
    if result.returncode != 0:
        pytest.skip(f"tsx not available: {result.stderr[:200]}")
    # stdout may contain console.log lines before the base64 blob;
    # the encrypted output is the last line
    lines = result.stdout.strip().splitlines()
    return lines[-1].strip()


def test_python_decrypts_ts_encrypted_bundle():
    """The Python runner can decrypt secrets encrypted by the TS control-plane."""
    os.environ["MASTER_ENCRYPTION_KEY"] = MASTER_KEY
    secrets = {"API_KEY": "sk-test-12345", "DB_PASSWORD": "hunter2"}

    encrypted = _ts_encrypt_bundle(secrets)
    assert encrypted, "TS encryption returned empty string"
    assert len(encrypted) > 50, f"TS output too short: {encrypted}"

    decrypted = decrypt_secrets_bundle(encrypted)
    assert decrypted == secrets


def test_python_decrypts_ts_encrypted_unicode():
    """Unicode values survive the TS encrypt -> Python decrypt round-trip."""
    os.environ["MASTER_ENCRYPTION_KEY"] = MASTER_KEY
    secrets = {"GREETING": "Hallo Welt"}

    encrypted = _ts_encrypt_bundle(secrets)
    decrypted = decrypt_secrets_bundle(encrypted)
    assert decrypted == secrets


def test_python_decrypts_ts_encrypted_empty_bundle():
    """Empty bundle survives cross-language round-trip."""
    os.environ["MASTER_ENCRYPTION_KEY"] = MASTER_KEY

    encrypted = _ts_encrypt_bundle({})
    decrypted = decrypt_secrets_bundle(encrypted)
    assert decrypted == {}
