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


def get_master_key() -> bytes:
    """
    Get master key from environment (matches control-plane implementation).

    In production, this would use actual KMS (AWS KMS, Google Cloud KMS, etc).
    For v0, we use environment variable.
    """
    master_key_env = os.environ.get("MASTER_ENCRYPTION_KEY")

    if not master_key_env:
        # For development, use default key (INSECURE)
        print("WARNING: No MASTER_ENCRYPTION_KEY set, using default (INSECURE)")
        # Exactly 32 bytes for AES-256 (matches control-plane)
        return b"dev-master-key-32-bytes-long!!!!"

    # Derive key using PBKDF2 (matches TypeScript implementation)
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=b"execution-layer-salt-v1",
        iterations=100000,
        backend=default_backend()
    )
    return kdf.derive(master_key_env.encode('utf-8'))


def decrypt_dek(encrypted_dek: bytes) -> bytes:
    """
    Decrypt a data encryption key (DEK) with the master key.

    Format: iv (16) || encrypted_dek || auth_tag (16)
    """
    master_key = get_master_key()

    # Parse components
    iv = encrypted_dek[:16]
    auth_tag = encrypted_dek[-16:]
    encrypted = encrypted_dek[16:-16]

    # Decrypt with AESGCM
    aesgcm = AESGCM(master_key)
    dek = aesgcm.decrypt(iv, encrypted + auth_tag, None)

    return dek


def decrypt_secret(encrypted_blob: str) -> str:
    """
    Decrypt a secret value.

    Format (base64): dek_length (4) || encrypted_dek || iv (16) || encrypted_data || auth_tag (16)
    """
    # Decode base64
    combined = base64.b64decode(encrypted_blob)

    # Parse components
    dek_length = struct.unpack('>I', combined[:4])[0]
    offset = 4

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
