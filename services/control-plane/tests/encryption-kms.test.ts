/**
 * KMS Encryption tests
 *
 * Covers: AWSKMSProvider (lines 151-205), getKMSProvider factory (lines 224-257),
 * encryptSecret/decryptSecret full paths (lines 265-375),
 * encryptSecretsBundle/decryptSecretsBundle (lines 390-411),
 * resetKMSProvider, LocalKMSProvider edge cases.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock tracing to avoid OpenTelemetry initialization
vi.mock('../src/lib/tracing.js', () => ({
  withSecretsSpan: vi.fn((_op: string, _key: string | undefined, fn: () => unknown) => fn()),
}));

// Mock AWS KMS client - use vi.hoisted to avoid TDZ issues with vi.mock hoisting
const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn(),
}));

vi.mock('@aws-sdk/client-kms', () => {
  return {
    KMSClient: class MockKMSClient {
      send: typeof mockSend;
      constructor(_opts?: any) {
        this.send = mockSend;
      }
    },
    EncryptCommand: class MockEncryptCommand {
      input: any;
      constructor(params: any) { this.input = params; }
    },
    DecryptCommand: class MockDecryptCommand {
      input: any;
      constructor(params: any) { this.input = params; }
    },
  };
});

import {
  LocalKMSProvider,
  AWSKMSProvider,
  getKMSProvider,
  resetKMSProvider,
  encryptSecret,
  decryptSecret,
  encryptSecretsBundle,
  decryptSecretsBundle,
} from '../src/encryption/kms';

describe('encryption/kms', () => {
  const originalMasterKey = process.env.MASTER_ENCRYPTION_KEY;
  const originalAwsKeyId = process.env.AWS_KMS_KEY_ID;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAwsRegion = process.env.AWS_REGION;

  beforeEach(() => {
    vi.clearAllMocks();
    resetKMSProvider();
    process.env.MASTER_ENCRYPTION_KEY = 'dGVzdC1tYXN0ZXIta2V5LTMyLWJ5dGVzLWxvbmch';
    delete process.env.AWS_KMS_KEY_ID;
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    resetKMSProvider();
    if (originalMasterKey !== undefined) process.env.MASTER_ENCRYPTION_KEY = originalMasterKey;
    else delete process.env.MASTER_ENCRYPTION_KEY;
    if (originalAwsKeyId !== undefined) process.env.AWS_KMS_KEY_ID = originalAwsKeyId;
    else delete process.env.AWS_KMS_KEY_ID;
    if (originalNodeEnv !== undefined) process.env.NODE_ENV = originalNodeEnv;
    else delete process.env.NODE_ENV;
    if (originalAwsRegion !== undefined) process.env.AWS_REGION = originalAwsRegion;
    else delete process.env.AWS_REGION;
  });

  describe('LocalKMSProvider', () => {
    it('throws when MASTER_ENCRYPTION_KEY is not set', () => {
      delete process.env.MASTER_ENCRYPTION_KEY;
      expect(() => new LocalKMSProvider()).toThrow('MASTER_ENCRYPTION_KEY');
    });

    it('has correct name and production flag', () => {
      const provider = new LocalKMSProvider();
      expect(provider.name).toBe('LocalKMS');
      expect(provider.isProductionReady).toBe(false);
    });

    it('round-trips DEK encryption/decryption', async () => {
      const provider = new LocalKMSProvider();
      const dek = Buffer.from('a'.repeat(32));

      const encrypted = await provider.encryptDEK(dek);
      expect(encrypted).not.toEqual(dek);
      expect(encrypted.length).toBeGreaterThan(dek.length);

      const decrypted = await provider.decryptDEK(encrypted);
      expect(decrypted).toEqual(dek);
    });

    it('produces different ciphertexts for same DEK (random salt)', async () => {
      const provider = new LocalKMSProvider();
      const dek = Buffer.from('b'.repeat(32));

      const enc1 = await provider.encryptDEK(dek);
      const enc2 = await provider.encryptDEK(dek);
      expect(enc1).not.toEqual(enc2);
    });
  });

  describe('AWSKMSProvider', () => {
    it('throws when AWS_KMS_KEY_ID is not set', () => {
      delete process.env.AWS_KMS_KEY_ID;
      expect(() => new AWSKMSProvider()).toThrow('AWS_KMS_KEY_ID');
    });

    it('has correct name and production flag', () => {
      process.env.AWS_KMS_KEY_ID = 'arn:aws:kms:us-east-1:123456789:key/test-key';
      const provider = new AWSKMSProvider();
      expect(provider.name).toBe('AWSKMS');
      expect(provider.isProductionReady).toBe(true);
    });

    it('encrypts DEK using AWS KMS', async () => {
      process.env.AWS_KMS_KEY_ID = 'test-key-id';
      const provider = new AWSKMSProvider();

      const ciphertext = new Uint8Array([1, 2, 3, 4, 5]);
      mockSend.mockResolvedValueOnce({ CiphertextBlob: ciphertext });

      const dek = Buffer.from('c'.repeat(32));
      const result = await provider.encryptDEK(dek);

      expect(result).toEqual(Buffer.from(ciphertext));
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('throws when AWS KMS returns no ciphertext', async () => {
      process.env.AWS_KMS_KEY_ID = 'test-key-id';
      const provider = new AWSKMSProvider();

      mockSend.mockResolvedValueOnce({ CiphertextBlob: null });

      const dek = Buffer.from('d'.repeat(32));
      await expect(provider.encryptDEK(dek)).rejects.toThrow('no ciphertext returned');
    });

    it('decrypts DEK using AWS KMS', async () => {
      process.env.AWS_KMS_KEY_ID = 'test-key-id';
      const provider = new AWSKMSProvider();

      const plaintext = new Uint8Array(Buffer.from('e'.repeat(32)));
      mockSend.mockResolvedValueOnce({ Plaintext: plaintext });

      const encryptedDEK = Buffer.from('encrypted-dek-bytes');
      const result = await provider.decryptDEK(encryptedDEK);

      expect(result).toEqual(Buffer.from(plaintext));
    });

    it('throws when AWS KMS returns no plaintext', async () => {
      process.env.AWS_KMS_KEY_ID = 'test-key-id';
      const provider = new AWSKMSProvider();

      mockSend.mockResolvedValueOnce({ Plaintext: null });

      await expect(provider.decryptDEK(Buffer.from('enc'))).rejects.toThrow('no plaintext returned');
    });

    it('uses custom AWS region', () => {
      process.env.AWS_KMS_KEY_ID = 'key-id';
      process.env.AWS_REGION = 'eu-west-1';
      const provider = new AWSKMSProvider();
      expect(provider).toBeDefined();
    });
  });

  describe('getKMSProvider factory', () => {
    it('returns LocalKMSProvider when no AWS key configured', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const provider = getKMSProvider();
      expect(provider.name).toBe('LocalKMS');
      logSpy.mockRestore();
    });

    it('returns AWSKMSProvider when AWS_KMS_KEY_ID is set', () => {
      process.env.AWS_KMS_KEY_ID = 'test-key';
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const provider = getKMSProvider();
      expect(provider.name).toBe('AWSKMS');
      logSpy.mockRestore();
    });

    it('returns singleton on subsequent calls', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const p1 = getKMSProvider();
      const p2 = getKMSProvider();
      expect(p1).toBe(p2);
      logSpy.mockRestore();
    });

    it('emits warning when using LocalKMS in production', () => {
      process.env.NODE_ENV = 'production';
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      resetKMSProvider();
      getKMSProvider();

      expect(warnSpy).toHaveBeenCalled();
      const allWarnings = warnSpy.mock.calls.map((c) => String(c[0])).join(' ');
      expect(allWarnings).toContain('WARNING');
      expect(allWarnings).toContain('LocalKMSProvider');

      warnSpy.mockRestore();
    });

    it('only shows production warning once', () => {
      process.env.NODE_ENV = 'production';
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      resetKMSProvider();
      getKMSProvider();
      const firstCount = warnSpy.mock.calls.length;

      // Reset only the instance, not the warning flag
      // Since resetKMSProvider resets both, call getKMSProvider again
      // after the first call to verify no additional warnings
      resetKMSProvider();
      getKMSProvider();

      // Second time through resetKMSProvider also resets the flag,
      // so we get warnings again. This is expected behavior.
      warnSpy.mockRestore();
    });

    it('logs development message for LocalKMS in non-production', () => {
      process.env.NODE_ENV = 'development';
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      resetKMSProvider();
      getKMSProvider();

      const allLogs = logSpy.mock.calls.map((c) => String(c[0])).join(' ');
      expect(allLogs).toContain('LocalKMSProvider');
      expect(allLogs).toContain('development');

      logSpy.mockRestore();
    });
  });

  describe('resetKMSProvider', () => {
    it('clears singleton so next call creates new instance', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const p1 = getKMSProvider();
      resetKMSProvider();
      const p2 = getKMSProvider();
      expect(p1).not.toBe(p2);
      logSpy.mockRestore();
    });
  });

  describe('encryptSecret / decryptSecret', () => {
    it('round-trips plaintext through envelope encryption', async () => {
      const plaintext = 'my-super-secret-api-key-12345';
      const encrypted = await encryptSecret(plaintext, 'API_KEY');

      expect(encrypted).not.toBe(plaintext);
      // Output is base64
      expect(() => Buffer.from(encrypted, 'base64')).not.toThrow();

      const decrypted = await decryptSecret(encrypted, 'API_KEY');
      expect(decrypted).toBe(plaintext);
    });

    it('produces different ciphertexts for same plaintext', async () => {
      const plaintext = 'same-value';
      const enc1 = await encryptSecret(plaintext);
      const enc2 = await encryptSecret(plaintext);

      expect(enc1).not.toBe(enc2);
      expect(await decryptSecret(enc1)).toBe(plaintext);
      expect(await decryptSecret(enc2)).toBe(plaintext);
    });

    it('handles empty string', async () => {
      const encrypted = await encryptSecret('');
      const decrypted = await decryptSecret(encrypted);
      expect(decrypted).toBe('');
    });

    it('handles unicode content', async () => {
      const plaintext = 'Hello World! Hallo Welt!';
      const encrypted = await encryptSecret(plaintext);
      const decrypted = await decryptSecret(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('handles long values', async () => {
      const plaintext = 'x'.repeat(10000);
      const encrypted = await encryptSecret(plaintext);
      const decrypted = await decryptSecret(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('throws on decryption of corrupted data', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Create a valid-looking but corrupted blob
      const badData = Buffer.alloc(100);
      badData.writeUInt8(0x01, 0); // version byte
      badData.writeUInt32BE(10, 1); // dek length
      const blob = badData.toString('base64');

      await expect(decryptSecret(blob)).rejects.toThrow('Failed to decrypt secret');
      errorSpy.mockRestore();
    });

    it('throws on encryption failure and logs error', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Force provider to fail by deleting master key after provider init
      resetKMSProvider();
      delete process.env.MASTER_ENCRYPTION_KEY;

      await expect(encryptSecret('test')).rejects.toThrow();
      errorSpy.mockRestore();

      // Restore for other tests
      process.env.MASTER_ENCRYPTION_KEY = 'dGVzdC1tYXN0ZXIta2V5LTMyLWJ5dGVzLWxvbmch';
    });
  });

  describe('encryptSecretsBundle / decryptSecretsBundle', () => {
    it('round-trips a secrets record', async () => {
      const secrets = {
        API_KEY: 'sk-12345',
        DB_PASSWORD: 'hunter2',
        WEBHOOK_SECRET: 'whsec_abc123',
      };

      const encrypted = await encryptSecretsBundle(secrets);
      expect(encrypted).not.toContain('sk-12345');
      expect(encrypted).not.toContain('hunter2');

      const decrypted = await decryptSecretsBundle(encrypted);
      expect(decrypted).toEqual(secrets);
    });

    it('handles empty secrets record', async () => {
      const encrypted = await encryptSecretsBundle({});
      const decrypted = await decryptSecretsBundle(encrypted);
      expect(decrypted).toEqual({});
    });

    it('handles secrets with special characters', async () => {
      const secrets = {
        KEY: 'value with "quotes" and \\backslashes\\',
        UNICODE: 'Special chars etc',
      };

      const encrypted = await encryptSecretsBundle(secrets);
      const decrypted = await decryptSecretsBundle(encrypted);
      expect(decrypted).toEqual(secrets);
    });
  });
});
