import base64
import json
import struct

import pytest
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

from security.kms_client import (
    decrypt_dek,
    decrypt_secret,
    decrypt_secrets_bundle,
    get_master_key,
)


def _derive_master_key(master_key_env: str) -> bytes:
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=b"execution-layer-salt-v1",
        iterations=100000,
        backend=default_backend(),
    )
    return kdf.derive(master_key_env.encode("utf-8"))


def _encrypt_dek_for_master(master_key: bytes, dek: bytes, iv: bytes) -> bytes:
    aesgcm = AESGCM(master_key)
    encrypted = aesgcm.encrypt(iv, dek, None)
    ciphertext = encrypted[:-16]
    tag = encrypted[-16:]
    return iv + ciphertext + tag


def _encrypt_secret_blob(secret: str, encrypted_dek: bytes, data_iv: bytes, dek: bytes) -> str:
    aesgcm = AESGCM(dek)
    encrypted = aesgcm.encrypt(data_iv, secret.encode("utf-8"), None)
    ciphertext = encrypted[:-16]
    tag = encrypted[-16:]
    combined = struct.pack(">I", len(encrypted_dek)) + encrypted_dek + data_iv + ciphertext + tag
    return base64.b64encode(combined).decode("utf-8")


def test_get_master_key_defaults_when_env_missing(monkeypatch):
    monkeypatch.delenv("MASTER_ENCRYPTION_KEY", raising=False)
    key = get_master_key()
    assert key == b"dev-master-key-32-bytes-long!!!!"
    assert len(key) == 32


def test_get_master_key_uses_pbkdf2_when_env_present(monkeypatch):
    monkeypatch.setenv("MASTER_ENCRYPTION_KEY", "my-master-key")
    derived = get_master_key()
    assert derived == _derive_master_key("my-master-key")
    assert derived != b"dev-master-key-32-bytes-long!!!!"
    assert len(derived) == 32


def test_decrypt_dek_round_trip(monkeypatch):
    monkeypatch.setenv("MASTER_ENCRYPTION_KEY", "secret-master")
    master_key = _derive_master_key("secret-master")
    dek = b"A" * 32
    iv = b"\x01" * 16
    encrypted_dek = _encrypt_dek_for_master(master_key, dek, iv)

    assert decrypt_dek(encrypted_dek) == dek


def test_decrypt_secret_and_bundle_round_trip(monkeypatch):
    monkeypatch.setenv("MASTER_ENCRYPTION_KEY", "secret-master")
    master_key = _derive_master_key("secret-master")
    dek = b"B" * 32
    dek_iv = b"\x02" * 16
    data_iv = b"\x03" * 16

    encrypted_dek = _encrypt_dek_for_master(master_key, dek, dek_iv)
    secret_payload = json.dumps({"API_KEY": "sk-1234567890", "REGION": "us-east-1"})
    blob = _encrypt_secret_blob(secret_payload, encrypted_dek, data_iv, dek)

    decrypted_secret = decrypt_secret(blob)
    assert json.loads(decrypted_secret) == {"API_KEY": "sk-1234567890", "REGION": "us-east-1"}

    bundle = decrypt_secrets_bundle(blob)
    assert bundle["API_KEY"] == "sk-1234567890"
    assert bundle["REGION"] == "us-east-1"


def test_decrypt_secret_rejects_invalid_blob():
    with pytest.raises(Exception):
        decrypt_secret("not-base64")
