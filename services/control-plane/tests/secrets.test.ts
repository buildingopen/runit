/**
 * Secrets management tests
 */

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { encryptSecret, decryptSecret, redactSecrets } from '../src/crypto/kms';
import { storeSecret, getProjectSecrets, deleteSecret, clearAllSecrets } from '../src/db/secrets-store';

// Ensure MASTER_ENCRYPTION_KEY is set for tests
beforeAll(() => {
  if (!process.env.MASTER_ENCRYPTION_KEY) {
    process.env.MASTER_ENCRYPTION_KEY = 'dGVzdC1tYXN0ZXIta2V5LTMyLWJ5dGVzLWxvbmch';
  }
});

describe('KMS Encryption', () => {
  it('should encrypt and decrypt a secret', async () => {
    const plaintext = 'sk-1234567890abcdefghijklmnopqrstuvwxyz123456';
    const encrypted = await encryptSecret(plaintext);

    expect(encrypted).not.toBe(plaintext);
    // Encrypted output is base64-encoded

    const decrypted = await decryptSecret(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('should produce different ciphertexts for same plaintext', async () => {
    const plaintext = 'my-secret-value';
    const encrypted1 = await encryptSecret(plaintext);
    const encrypted2 = await encryptSecret(plaintext);

    // Different due to random IVs
    expect(encrypted1).not.toBe(encrypted2);

    // But both decrypt to same value
    expect(await decryptSecret(encrypted1)).toBe(plaintext);
    expect(await decryptSecret(encrypted2)).toBe(plaintext);
  });
});

describe('Secrets Redaction', () => {
  it('should redact exact secret values', () => {
    const secrets = {
      'API_KEY': 'sk-1234567890',
      'DB_PASSWORD': 'super-secret-pass'
    };

    const text = 'Error: Connection failed with password super-secret-pass and key sk-1234567890';
    const redacted = redactSecrets(text, secrets);

    expect(redacted).toBe('Error: Connection failed with password [REDACTED:DB_PASSWORD] and key [REDACTED:API_KEY]');
  });

  it('should redact common API key patterns', () => {
    const text = 'Using API key: sk-abcdefghijklmnopqrstuvwxyz123456789012345678';
    const redacted = redactSecrets(text, {});

    expect(redacted).toContain('[REDACTED:API_KEY]');
    expect(redacted).not.toContain('sk-abcdefghij');
  });

  it('should redact Google API keys', () => {
    const text = 'Google key: AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ1234567';
    const redacted = redactSecrets(text, {});

    expect(redacted).toContain('[REDACTED:GOOGLE_API_KEY]');
  });

  it('should redact JWT tokens', () => {
    const text = 'Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0';
    const redacted = redactSecrets(text, {});

    expect(redacted).toContain('[REDACTED:JWT_TOKEN]');
  });
});

describe('Secrets Store', () => {
  beforeEach(() => {
    clearAllSecrets();
  });

  it('should store and retrieve a secret', async () => {
    const encrypted = await encryptSecret('my-secret-value');
    const secret = await storeSecret('project-123', 'API_KEY', encrypted);

    expect(secret.id).toBeDefined();
    expect(secret.key).toBe('API_KEY');
    expect(secret.project_id).toBe('project-123');
    expect(secret.encrypted_value).toBe(encrypted);
  });

  it('should list all secrets for a project', async () => {
    const enc1 = await encryptSecret('value1');
    const enc2 = await encryptSecret('value2');

    await storeSecret('project-123', 'KEY1', enc1);
    await storeSecret('project-123', 'KEY2', enc2);
    await storeSecret('project-456', 'KEY3', await encryptSecret('value3'));

    const secrets = await getProjectSecrets('project-123');

    expect(secrets).toHaveLength(2);
    expect(secrets.map(s => s.key)).toContain('KEY1');
    expect(secrets.map(s => s.key)).toContain('KEY2');
  });

  it('should update existing secret', async () => {
    const enc1 = await encryptSecret('old-value');
    const secret1 = await storeSecret('project-123', 'API_KEY', enc1);

    // Small delay to ensure different timestamp
    await new Promise(resolve => setTimeout(resolve, 10));

    const enc2 = await encryptSecret('new-value');
    const secret2 = await storeSecret('project-123', 'API_KEY', enc2);

    // Same ID, updated value
    expect(secret2.id).toBe(secret1.id);
    expect(secret2.encrypted_value).toBe(enc2);
    expect(secret2.updated_at).not.toBe(secret1.updated_at);
  });

  it('should delete a secret', async () => {
    const encrypted = await encryptSecret('value');
    await storeSecret('project-123', 'API_KEY', encrypted);

    let secrets = await getProjectSecrets('project-123');
    expect(secrets).toHaveLength(1);

    await deleteSecret('project-123', 'API_KEY');

    secrets = await getProjectSecrets('project-123');
    expect(secrets).toHaveLength(0);
  });
});

describe('Secrets Integration', () => {
  beforeEach(() => {
    clearAllSecrets();
  });

  it('should store encrypted secret and never expose plaintext', async () => {
    const plaintext = 'sk-super-secret-api-key-1234567890';

    // Encrypt
    const encrypted = await encryptSecret(plaintext);

    // Store
    const secret = await storeSecret('project-123', 'OPENAI_API_KEY', encrypted);

    // Verify plaintext is not in stored value
    expect(secret.encrypted_value).not.toContain(plaintext);
    // Encrypted output is base64-encoded

    // Retrieve and decrypt
    const secrets = await getProjectSecrets('project-123');
    const retrieved = secrets[0];
    const decrypted = await decryptSecret(retrieved.encrypted_value);

    expect(decrypted).toBe(plaintext);
  });
});
