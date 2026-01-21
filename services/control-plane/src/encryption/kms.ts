/**
 * KMS Encryption - Envelope encryption for secrets
 *
 * Uses AES-256-GCM with KMS-encrypted data encryption keys (DEK)
 *
 * Envelope encryption process:
 * 1. Generate random DEK (32 bytes)
 * 2. Encrypt secret with DEK using AES-256-GCM
 * 3. Encrypt DEK with KMS master key (future: use actual KMS)
 * 4. Store: encrypted_dek || encrypted_secret || iv || auth_tag
 *
 * For v0: Use environment variable as master key (mock KMS)
 * Production: Replace with actual KMS (AWS KMS, Google Cloud KMS, HashiCorp Vault)
 */

import { createCipheriv, createDecipheriv, randomBytes, pbkdf2Sync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16;  // 128 bits
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

/**
 * Get master key from environment (mock KMS for v0)
 * Production: Replace with actual KMS call
 */
function getMasterKey(): Buffer {
  const masterKeyEnv = process.env.MASTER_ENCRYPTION_KEY;

  if (!masterKeyEnv) {
    // For development, use a default key
    // WARNING: Never use this in production!
    console.warn('WARNING: No MASTER_ENCRYPTION_KEY set, using default (INSECURE)');
    // Exactly 32 bytes for AES-256
    return Buffer.from('dev-master-key-32-bytes-long!!!!', 'utf-8');
  }

  // Derive key from env var using PBKDF2
  const salt = Buffer.from('execution-layer-salt-v1');
  return pbkdf2Sync(masterKeyEnv, salt, 100000, KEY_LENGTH, 'sha256');
}

/**
 * Encrypt a DEK with the master key (mock KMS operation)
 */
function encryptDEK(dek: Buffer): Buffer {
  const masterKey = getMasterKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, masterKey, iv);
  const encrypted = Buffer.concat([cipher.update(dek), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Format: iv || encrypted_dek || auth_tag
  return Buffer.concat([iv, encrypted, authTag]);
}

/**
 * Decrypt a DEK with the master key (mock KMS operation)
 */
function decryptDEK(encryptedDEK: Buffer): Buffer {
  const masterKey = getMasterKey();

  // Parse: iv || encrypted_dek || auth_tag
  const iv = encryptedDEK.subarray(0, IV_LENGTH);
  const authTag = encryptedDEK.subarray(encryptedDEK.length - AUTH_TAG_LENGTH);
  const encrypted = encryptedDEK.subarray(IV_LENGTH, encryptedDEK.length - AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, masterKey, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

/**
 * Encrypt a secret value using envelope encryption
 *
 * Returns base64-encoded blob: encrypted_dek || iv || encrypted_data || auth_tag
 */
export async function encryptSecret(plaintext: string): Promise<string> {
  try {
    // 1. Generate random DEK
    const dek = randomBytes(KEY_LENGTH);

    // 2. Encrypt plaintext with DEK
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, dek, iv);

    const plaintextBuffer = Buffer.from(plaintext, 'utf-8');
    const encrypted = Buffer.concat([cipher.update(plaintextBuffer), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // 3. Encrypt DEK with master key (KMS)
    const encryptedDEK = encryptDEK(dek);

    // 4. Combine: encrypted_dek_length (4 bytes) || encrypted_dek || iv || encrypted_data || auth_tag
    const dekLength = Buffer.alloc(4);
    dekLength.writeUInt32BE(encryptedDEK.length, 0);

    const combined = Buffer.concat([
      dekLength,
      encryptedDEK,
      iv,
      encrypted,
      authTag,
    ]);

    // Return base64-encoded blob
    return combined.toString('base64');
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt secret');
  }
}

/**
 * Decrypt a secret value
 *
 * Takes base64-encoded blob, returns plaintext
 */
export async function decryptSecret(encryptedBlob: string): Promise<string> {
  try {
    // 1. Decode base64
    const combined = Buffer.from(encryptedBlob, 'base64');

    // 2. Parse components
    const dekLength = combined.readUInt32BE(0);
    let offset = 4;

    const encryptedDEK = combined.subarray(offset, offset + dekLength);
    offset += dekLength;

    const iv = combined.subarray(offset, offset + IV_LENGTH);
    offset += IV_LENGTH;

    const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH);
    const encrypted = combined.subarray(offset, combined.length - AUTH_TAG_LENGTH);

    // 3. Decrypt DEK with master key (KMS)
    const dek = decryptDEK(encryptedDEK);

    // 4. Decrypt data with DEK
    const decipher = createDecipheriv(ALGORITHM, dek, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

    // 5. Return plaintext
    return decrypted.toString('utf-8');
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt secret');
  }
}

/**
 * Encrypt multiple secrets into a single encrypted blob
 * Used for passing secrets to runner
 */
export async function encryptSecretsBundle(secrets: Record<string, string>): Promise<string> {
  const json = JSON.stringify(secrets);
  return encryptSecret(json);
}

/**
 * Decrypt a secrets bundle
 * Used by runner to get env vars
 */
export async function decryptSecretsBundle(encryptedBlob: string): Promise<Record<string, string>> {
  const json = await decryptSecret(encryptedBlob);
  return JSON.parse(json);
}
