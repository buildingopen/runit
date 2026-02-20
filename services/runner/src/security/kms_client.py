"""
ABOUTME: KMS client for runner - Decrypts secrets bundles from control-plane
ABOUTME: Uses the same envelope encryption as control-plane (AES-256-GCM)
"""

import base64
import json
import os
import struct
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.backends import default_backend


SALT_LENGTH = 32
IV_LENGTH = 16
AUTH_TAG_LENGTH = 16
PBKDF2_ITERATIONS = 100000


def _derive_master_key(master_key_env: str, salt: bytes) -> bytes:
    """
    Derive master key using PBKDF2 with the provided salt.
    Matches the TypeScript LocalKMSProvider.deriveKey() implementation.
    """
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=PBKDF2_ITERATIONS,
        backend=default_backend()
    )
    return kdf.derive(master_key_env.encode('utf-8'))


def get_master_key_env() -> str:
    """Get the master key environment variable value."""
    master_key_env = os.environ.get("MASTER_ENCRYPTION_KEY")
    if not master_key_env:
        raise ValueError("MASTER_ENCRYPTION_KEY environment variable is required")
    return master_key_env


def decrypt_dek(encrypted_dek: bytes) -> bytes:
    """
    Decrypt a data encryption key (DEK) with the master key.

    Matches TS LocalKMSProvider format:
      salt(32) || iv(16) || encrypted_dek || auth_tag(16)

    The master key is derived from MASTER_ENCRYPTION_KEY env var using PBKDF2
    with the random salt stored in the blob.
    """
    master_key_env = get_master_key_env()

    # Parse: salt(32) || iv(16) || encrypted || auth_tag(16)
    salt = encrypted_dek[:SALT_LENGTH]
    iv = encrypted_dek[SALT_LENGTH:SALT_LENGTH + IV_LENGTH]
    auth_tag = encrypted_dek[-AUTH_TAG_LENGTH:]
    encrypted = encrypted_dek[SALT_LENGTH + IV_LENGTH:-AUTH_TAG_LENGTH]

    # Derive key using same PBKDF2 params as TS side
    derived_key = _derive_master_key(master_key_env, salt)

    # Decrypt with AESGCM
    aesgcm = AESGCM(derived_key)
    dek = aesgcm.decrypt(iv, encrypted + auth_tag, None)

    return dek


ENCRYPTION_FORMAT_V1 = 0x01


def decrypt_secret(encrypted_blob: str) -> str:
    """
    Decrypt a secret value.

    Supports two formats:
    - v1: version(1) || dek_length(4) || encrypted_dek || iv(16) || encrypted_data || auth_tag(16)
    - v0 (legacy): dek_length(4) || encrypted_dek || iv(16) || encrypted_data || auth_tag(16)
    """
    combined = base64.b64decode(encrypted_blob)

    # Detect format: v1 starts with 0x01 version byte
    version = combined[0]
    if version == ENCRYPTION_FORMAT_V1:
        # v1 format: skip version byte
        offset = 1
        dek_length = struct.unpack('>I', combined[offset:offset + 4])[0]
        offset += 4
    else:
        # Legacy v0: first 4 bytes are dek_length directly
        offset = 0
        dek_length = struct.unpack('>I', combined[offset:offset + 4])[0]
        offset += 4

    encrypted_dek = combined[offset:offset + dek_length]
    offset += dek_length

    iv = combined[offset:offset + 16]
    offset += 16

    auth_tag = combined[-16:]
    encrypted = combined[offset:-16]

    # Decrypt DEK
    dek = decrypt_dek(encrypted_dek)

    # Decrypt data with DEK
    aesgcm = AESGCM(dek)
    decrypted = aesgcm.decrypt(iv, encrypted + auth_tag, None)

    return decrypted.decode('utf-8')


def decrypt_secrets_bundle(encrypted_blob: str) -> dict:
    """
    Decrypt a secrets bundle (JSON of key-value pairs).

    Used by executor to get environment variables from control-plane.
    """
    json_str = decrypt_secret(encrypted_blob)
    return json.loads(json_str)
