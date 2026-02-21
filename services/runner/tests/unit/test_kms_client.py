import base64
import json
import os
import struct

import pytest
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from security.kms_client import (
    AUTH_TAG_LENGTH,
    ENCRYPTION_FORMAT_V1,
    IV_LENGTH,
    SALT_LENGTH,
    _derive_master_key,
    decrypt_dek,
    decrypt_secret,
    decrypt_secrets_bundle,
    get_master_key_env,
)


def _make_encrypted_dek(master_key_env: str, dek: bytes) -> bytes:
    """Encrypt a DEK using the same format as TS LocalKMSProvider.encryptDEK.

    Format: salt(32) || iv(16) || encrypted_dek || auth_tag(16)
    """
    salt = os.urandom(SALT_LENGTH)
    derived = _derive_master_key(master_key_env, salt)
    iv = os.urandom(IV_LENGTH)
    aesgcm = AESGCM(derived)
    encrypted = aesgcm.encrypt(iv, dek, None)
    # encrypted = ciphertext + tag (AESGCM.encrypt appends tag)
    ciphertext = encrypted[:-AUTH_TAG_LENGTH]
    tag = encrypted[-AUTH_TAG_LENGTH:]
    return salt + iv + ciphertext + tag


def _make_v1_blob(master_key_env: str, plaintext: str) -> str:
    """Create a v1 encrypted blob matching TS encryptSecret output.

    Format: version(1) || dek_length(4) || encrypted_dek || iv(16) || encrypted_data || auth_tag(16)
    """
    dek = os.urandom(32)
    encrypted_dek = _make_encrypted_dek(master_key_env, dek)

    data_iv = os.urandom(IV_LENGTH)
    aesgcm = AESGCM(dek)
    encrypted = aesgcm.encrypt(data_iv, plaintext.encode("utf-8"), None)
    ciphertext = encrypted[:-AUTH_TAG_LENGTH]
    tag = encrypted[-AUTH_TAG_LENGTH:]

    version = bytes([ENCRYPTION_FORMAT_V1])
    dek_len = struct.pack(">I", len(encrypted_dek))
    combined = version + dek_len + encrypted_dek + data_iv + ciphertext + tag
    return base64.b64encode(combined).decode("utf-8")


def _make_v0_blob(master_key_env: str, plaintext: str) -> str:
    """Create a legacy v0 blob (no version byte).

    Format: dek_length(4) || encrypted_dek || iv(16) || encrypted_data || auth_tag(16)
    """
    dek = os.urandom(32)
    encrypted_dek = _make_encrypted_dek(master_key_env, dek)

    data_iv = os.urandom(IV_LENGTH)
    aesgcm = AESGCM(dek)
    encrypted = aesgcm.encrypt(data_iv, plaintext.encode("utf-8"), None)
    ciphertext = encrypted[:-AUTH_TAG_LENGTH]
    tag = encrypted[-AUTH_TAG_LENGTH:]

    dek_len = struct.pack(">I", len(encrypted_dek))
    combined = dek_len + encrypted_dek + data_iv + ciphertext + tag
    return base64.b64encode(combined).decode("utf-8")


def test_get_master_key_env_raises_when_missing(monkeypatch):
    monkeypatch.delenv("MASTER_ENCRYPTION_KEY", raising=False)
    with pytest.raises(ValueError, match="MASTER_ENCRYPTION_KEY"):
        get_master_key_env()


def test_get_master_key_env_returns_value(monkeypatch):
    monkeypatch.setenv("MASTER_ENCRYPTION_KEY", "test-key")
    assert get_master_key_env() == "test-key"


def test_derive_master_key_deterministic():
    salt = b"fixed-salt-for-test-32-bytes!!!!!"[:32]
    key1 = _derive_master_key("my-key", salt)
    key2 = _derive_master_key("my-key", salt)
    assert key1 == key2
    assert len(key1) == 32


def test_derive_master_key_different_salts():
    key1 = _derive_master_key("same-key", b"salt1" + b"\x00" * 27)
    key2 = _derive_master_key("same-key", b"salt2" + b"\x00" * 27)
    assert key1 != key2


def test_decrypt_dek_round_trip(monkeypatch):
    monkeypatch.setenv("MASTER_ENCRYPTION_KEY", "secret-master")
    dek = os.urandom(32)
    encrypted_dek = _make_encrypted_dek("secret-master", dek)
    assert decrypt_dek(encrypted_dek) == dek


def test_decrypt_secret_v1_format(monkeypatch):
    monkeypatch.setenv("MASTER_ENCRYPTION_KEY", "test-key-v1")
    blob = _make_v1_blob("test-key-v1", "hello world")
    assert decrypt_secret(blob) == "hello world"


def test_decrypt_secret_v0_legacy_format(monkeypatch):
    """v0 format (no version byte) is still supported for backwards compat."""
    monkeypatch.setenv("MASTER_ENCRYPTION_KEY", "test-key-v0")
    blob = _make_v0_blob("test-key-v0", "legacy secret")
    assert decrypt_secret(blob) == "legacy secret"


def test_decrypt_secrets_bundle_round_trip(monkeypatch):
    monkeypatch.setenv("MASTER_ENCRYPTION_KEY", "bundle-test")
    secrets = {"API_KEY": "sk-1234567890", "REGION": "us-east-1"}
    blob = _make_v1_blob("bundle-test", json.dumps(secrets))

    bundle = decrypt_secrets_bundle(blob)
    assert bundle == secrets


def test_decrypt_secret_rejects_invalid_blob():
    with pytest.raises(Exception):
        decrypt_secret("not-base64!!!")


def test_decrypt_secret_handles_unicode(monkeypatch):
    monkeypatch.setenv("MASTER_ENCRYPTION_KEY", "unicode-test")
    blob = _make_v1_blob("unicode-test", "Hallo Welt")
    assert decrypt_secret(blob) == "Hallo Welt"


def test_decrypt_secret_handles_empty_string(monkeypatch):
    monkeypatch.setenv("MASTER_ENCRYPTION_KEY", "empty-test")
    blob = _make_v1_blob("empty-test", "")
    assert decrypt_secret(blob) == ""
