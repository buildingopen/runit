// ABOUTME: Envelope encryption using AES-256-GCM with pluggable KMS providers (LocalKMS for dev, AWS KMS for prod).
// ABOUTME: Encrypts/decrypts individual secrets and secrets bundles; DEKs are wrapped by KMS with PBKDF2 key derivation.
/**
 * KMS Encryption - Envelope encryption for secrets
 *
 * Uses AES-256-GCM with KMS-encrypted data encryption keys (DEK)
 *
 * Envelope encryption process:
 * 1. Generate random DEK (32 bytes)
 * 2. Encrypt secret with DEK using AES-256-GCM
 * 3. Encrypt DEK with KMS master key
 * 4. Store: version || salt || encrypted_dek || encrypted_secret || iv || auth_tag
 *
 * This module provides:
 * - KMSProvider interface for pluggable key management
 * - LocalKMSProvider for development (uses env var)
 * - AWSKMSProvider for production (uses AWS KMS)
 * - Factory function to select the right provider based on environment
 */

import { createCipheriv, createDecipheriv, randomBytes, pbkdf2Sync } from 'crypto';
import { withSecretsSpan } from '../lib/tracing.js';

// ============================================================================
// Constants
// ============================================================================

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16;  // 128 bits
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const PBKDF2_ITERATIONS = 100000;

// Version byte for future format changes
const ENCRYPTION_FORMAT_VERSION = 0x01;

// ============================================================================
// KMS Provider Interface
// ============================================================================

/**
 * Interface for KMS providers
 * Implementations handle the actual key management operations
 */
export interface KMSProvider {
  /**
   * Provider name for logging/debugging
   */
  readonly name: string;

  /**
   * Whether this provider is suitable for production use
   */
  readonly isProductionReady: boolean;

  /**
   * Encrypt a Data Encryption Key (DEK)
   * @param dek - The plaintext DEK to encrypt
   * @returns Promise resolving to encrypted DEK bytes
   */
  encryptDEK(dek: Buffer): Promise<Buffer>;

  /**
   * Decrypt a Data Encryption Key (DEK)
   * @param encryptedDEK - The encrypted DEK to decrypt
   * @returns Promise resolving to plaintext DEK bytes
   */
  decryptDEK(encryptedDEK: Buffer): Promise<Buffer>;
}

// ============================================================================
// Local KMS Provider (Development)
// ============================================================================

/**
 * Local KMS provider for development environments
 * Uses MASTER_ENCRYPTION_KEY from environment variable
 *
 * WARNING: This provider is NOT suitable for production use.
 * The master key is derived from an environment variable with a random salt
 * per encryption operation for better security.
 */
export class LocalKMSProvider implements KMSProvider {
  readonly name = 'LocalKMS';
  readonly isProductionReady = false;

  private readonly masterKeyEnv: string;

  constructor() {
    const masterKeyEnv = process.env.MASTER_ENCRYPTION_KEY;

    if (!masterKeyEnv) {
      throw new Error(
        'MASTER_ENCRYPTION_KEY environment variable is required for LocalKMSProvider. ' +
        'Generate one with: openssl rand -base64 32'
      );
    }

    this.masterKeyEnv = masterKeyEnv;
  }

  /**
   * Derive a key from the master key env var using PBKDF2 with the provided salt
   */
  private deriveKey(salt: Buffer): Buffer {
    return pbkdf2Sync(this.masterKeyEnv, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
  }

  async encryptDEK(dek: Buffer): Promise<Buffer> {
    // Generate random salt for this encryption
    const salt = randomBytes(SALT_LENGTH);
    const derivedKey = this.deriveKey(salt);
    const iv = randomBytes(IV_LENGTH);

    const cipher = createCipheriv(ALGORITHM, derivedKey, iv);
    const encrypted = Buffer.concat([cipher.update(dek), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Format: salt || iv || encrypted_dek || auth_tag
    return Buffer.concat([salt, iv, encrypted, authTag]);
  }

  async decryptDEK(encryptedDEK: Buffer): Promise<Buffer> {
    // Parse: salt || iv || encrypted_dek || auth_tag
    const salt = encryptedDEK.subarray(0, SALT_LENGTH);
    const iv = encryptedDEK.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const authTag = encryptedDEK.subarray(encryptedDEK.length - AUTH_TAG_LENGTH);
    const encrypted = encryptedDEK.subarray(SALT_LENGTH + IV_LENGTH, encryptedDEK.length - AUTH_TAG_LENGTH);

    const derivedKey = this.deriveKey(salt);

    const decipher = createDecipheriv(ALGORITHM, derivedKey, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  }
}

// ============================================================================
// AWS KMS Provider (Production)
// ============================================================================

/**
 * AWS KMS provider for production environments
 * Uses AWS KMS for secure key management with hardware security modules (HSM)
 *
 * Required environment variables:
 * - AWS_KMS_KEY_ID: The KMS key ID or ARN to use for encryption
 * - AWS credentials (via standard AWS SDK configuration)
 */
export class AWSKMSProvider implements KMSProvider {
  readonly name = 'AWSKMS';
  readonly isProductionReady = true;

  private client: any;
  private readonly keyId: string;
  private initialized = false;

  constructor() {
    const keyId = process.env.AWS_KMS_KEY_ID;

    if (!keyId) {
      throw new Error(
        'AWS_KMS_KEY_ID environment variable is required for AWSKMSProvider. ' +
        'Set it to your KMS key ID or ARN.'
      );
    }

    this.keyId = keyId;
  }

  private async ensureClient(): Promise<void> {
    if (this.initialized) return;
    // Dynamic import: @aws-sdk/client-kms is optional (not needed in OSS mode)
    const { KMSClient } = await import('@aws-sdk/client-kms');
    this.client = new KMSClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
    this.initialized = true;
  }

  async encryptDEK(dek: Buffer): Promise<Buffer> {
    await this.ensureClient();
    const { EncryptCommand } = await import('@aws-sdk/client-kms');
    const command = new EncryptCommand({
      KeyId: this.keyId,
      Plaintext: dek,
    });

    const response = await this.client.send(command);

    if (!response.CiphertextBlob) {
      throw new Error('AWS KMS encryption failed: no ciphertext returned');
    }

    return Buffer.from(response.CiphertextBlob);
  }

  async decryptDEK(encryptedDEK: Buffer): Promise<Buffer> {
    await this.ensureClient();
    const { DecryptCommand } = await import('@aws-sdk/client-kms');
    const command = new DecryptCommand({
      KeyId: this.keyId,
      CiphertextBlob: encryptedDEK,
    });

    const response = await this.client.send(command);

    if (!response.Plaintext) {
      throw new Error('AWS KMS decryption failed: no plaintext returned');
    }

    return Buffer.from(response.Plaintext);
  }
}

// ============================================================================
// KMS Provider Factory
// ============================================================================

// Singleton instance
let kmsProviderInstance: KMSProvider | null = null;
let productionWarningShown = false;

/**
 * Get the appropriate KMS provider based on environment configuration
 *
 * Selection logic:
 * 1. If AWS_KMS_KEY_ID is set, use AWSKMSProvider
 * 2. Otherwise, fall back to LocalKMSProvider
 *
 * In production (NODE_ENV=production), using LocalKMSProvider will emit a warning.
 */
export function getKMSProvider(): KMSProvider {
  if (kmsProviderInstance) {
    return kmsProviderInstance;
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const hasAWSKMS = Boolean(process.env.AWS_KMS_KEY_ID);

  if (hasAWSKMS) {
    console.log('[KMS] Using AWS KMS provider for key management');
    kmsProviderInstance = new AWSKMSProvider();
  } else {
    kmsProviderInstance = new LocalKMSProvider();

    if (isProduction && !productionWarningShown) {
      productionWarningShown = true;
      console.warn('\n' + '='.repeat(80));
      console.warn('[KMS] WARNING: Using LocalKMSProvider in PRODUCTION environment!');
      console.warn('[KMS] This is NOT recommended for production use.');
      console.warn('[KMS] The master key is derived from an environment variable,');
      console.warn('[KMS] which does not provide the same security guarantees as a proper KMS.');
      console.warn('[KMS] ');
      console.warn('[KMS] To use AWS KMS, set the following environment variables:');
      console.warn('[KMS]   - AWS_KMS_KEY_ID: Your KMS key ID or ARN');
      console.warn('[KMS]   - AWS_REGION: AWS region (defaults to us-east-1)');
      console.warn('[KMS]   - AWS credentials via standard AWS SDK configuration');
      console.warn('='.repeat(80) + '\n');
    } else if (!isProduction) {
      console.log('[KMS] Using LocalKMSProvider for development');
    }
  }

  return kmsProviderInstance;
}

/**
 * Reset the KMS provider singleton (useful for testing)
 */
export function resetKMSProvider(): void {
  kmsProviderInstance = null;
  productionWarningShown = false;
}

// ============================================================================
// Encryption/Decryption Functions
// ============================================================================

/**
 * Encrypt a secret value using envelope encryption
 *
 * Returns base64-encoded blob with format:
 * version (1 byte) || encrypted_dek_length (4 bytes) || encrypted_dek || iv || encrypted_data || auth_tag
 *
 * Wrapped with OpenTelemetry tracing for observability.
 */
export async function encryptSecret(plaintext: string, secretKey?: string): Promise<string> {
  return withSecretsSpan('encrypt', secretKey, async () => {
    try {
      const kms = getKMSProvider();

      // 1. Generate random DEK
      const dek = randomBytes(KEY_LENGTH);

      // 2. Encrypt plaintext with DEK
      const iv = randomBytes(IV_LENGTH);
      const cipher = createCipheriv(ALGORITHM, dek, iv);

      const plaintextBuffer = Buffer.from(plaintext, 'utf-8');
      const encrypted = Buffer.concat([cipher.update(plaintextBuffer), cipher.final()]);
      const authTag = cipher.getAuthTag();

      // 3. Encrypt DEK with KMS
      const encryptedDEK = await kms.encryptDEK(dek);

      // 4. Combine: version (1 byte) || encrypted_dek_length (4 bytes) || encrypted_dek || iv || encrypted_data || auth_tag
      const version = Buffer.alloc(1);
      version.writeUInt8(ENCRYPTION_FORMAT_VERSION, 0);

      const dekLength = Buffer.alloc(4);
      dekLength.writeUInt32BE(encryptedDEK.length, 0);

      const combined = Buffer.concat([
        version,
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
  });
}

/**
 * Decrypt a secret value
 *
 * Takes base64-encoded blob, returns plaintext
 * Supports both versioned (v1) and legacy (v0) formats
 *
 * Wrapped with OpenTelemetry tracing for observability.
 */
export async function decryptSecret(encryptedBlob: string, secretKey?: string): Promise<string> {
  return withSecretsSpan('decrypt', secretKey, async () => {
    try {
      const kms = getKMSProvider();

      // 1. Decode base64
      const combined = Buffer.from(encryptedBlob, 'base64');

      // 2. Check version and parse accordingly
      const version = combined.readUInt8(0);

      let encryptedDEK: Buffer;
      let iv: Buffer;
      let encrypted: Buffer;
      let authTag: Buffer;

      if (version === ENCRYPTION_FORMAT_VERSION) {
        // New versioned format: version || dek_length || encrypted_dek || iv || encrypted || auth_tag
        let offset = 1;

        const dekLength = combined.readUInt32BE(offset);
        offset += 4;

        encryptedDEK = combined.subarray(offset, offset + dekLength);
        offset += dekLength;

        iv = combined.subarray(offset, offset + IV_LENGTH);
        offset += IV_LENGTH;

        authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH);
        encrypted = combined.subarray(offset, combined.length - AUTH_TAG_LENGTH);
      } else {
        // Legacy format (v0): dek_length || encrypted_dek || iv || encrypted || auth_tag
        // First byte is part of dekLength (high byte of 4-byte length)
        const dekLength = combined.readUInt32BE(0);
        let offset = 4;

        encryptedDEK = combined.subarray(offset, offset + dekLength);
        offset += dekLength;

        iv = combined.subarray(offset, offset + IV_LENGTH);
        offset += IV_LENGTH;

        authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH);
        encrypted = combined.subarray(offset, combined.length - AUTH_TAG_LENGTH);
      }

      // 3. Decrypt DEK with KMS
      const dek = await kms.decryptDEK(encryptedDEK);

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
  });
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
