/**
 * ABOUTME: KMS-based encryption for secrets at rest
 * ABOUTME: Uses envelope encryption pattern (data key encrypted with master key)
 */

import crypto from 'crypto';

// In v0, we use a simple encryption scheme
// In production, this would use AWS KMS, Google Cloud KMS, or HashiCorp Vault
const MASTER_KEY = process.env.MASTER_ENCRYPTION_KEY || 'dev-default-encryption-key-32chars!!';

if (MASTER_KEY.length < 32) {
  throw new Error('MASTER_ENCRYPTION_KEY must be at least 32 characters');
}

/**
 * Encrypt a secret value using envelope encryption
 */
export async function encryptSecret(plaintext: string): Promise<string> {
  // Generate random data key (32 bytes for AES-256)
  const dataKey = crypto.randomBytes(32);

  // Generate IV
  const iv = crypto.randomBytes(16);

  // Encrypt plaintext with data key
  const cipher = crypto.createCipheriv('aes-256-cbc', dataKey, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // Encrypt data key with master key
  const masterKeyHash = crypto.createHash('sha256').update(MASTER_KEY).digest();
  const keyIv = crypto.randomBytes(16);
  const keyCipher = crypto.createCipheriv('aes-256-cbc', masterKeyHash, keyIv);
  let encryptedDataKey = keyCipher.update(dataKey);
  encryptedDataKey = Buffer.concat([encryptedDataKey, keyCipher.final()]);

  // Return envelope: keyIv:encryptedDataKey:iv:ciphertext
  return [
    keyIv.toString('hex'),
    encryptedDataKey.toString('hex'),
    iv.toString('hex'),
    encrypted
  ].join(':');
}

/**
 * Decrypt a secret value using envelope encryption
 */
export async function decryptSecret(envelope: string): Promise<string> {
  const parts = envelope.split(':');
  if (parts.length !== 4) {
    throw new Error('Invalid encrypted envelope format');
  }

  const [keyIvHex, encryptedDataKeyHex, ivHex, encrypted] = parts;

  // Decrypt data key with master key
  const masterKeyHash = crypto.createHash('sha256').update(MASTER_KEY).digest();
  const keyIv = Buffer.from(keyIvHex, 'hex');
  const encryptedDataKey = Buffer.from(encryptedDataKeyHex, 'hex');

  const keyDecipher = crypto.createDecipheriv('aes-256-cbc', masterKeyHash, keyIv);
  let dataKey = keyDecipher.update(encryptedDataKey);
  dataKey = Buffer.concat([dataKey, keyDecipher.final()]);

  // Decrypt ciphertext with data key
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', dataKey, iv);
  let plaintext = decipher.update(encrypted, 'hex', 'utf8');
  plaintext += decipher.final('utf8');

  return plaintext;
}

/**
 * Redact secrets from text (for logs and outputs)
 */
export function redactSecrets(text: string, secrets: Record<string, string>): string {
  let redacted = text;

  // Redact exact secret values
  for (const [key, value] of Object.entries(secrets)) {
    if (value && value.length > 0) {
      const regex = new RegExp(escapeRegex(value), 'g');
      redacted = redacted.replace(regex, `[REDACTED:${key}]`);
    }
  }

  // Redact common secret patterns
  const patterns = [
    { pattern: /sk-[a-zA-Z0-9]{40,}/g, replacement: '[REDACTED:API_KEY]' },
    { pattern: /AIzaSy[a-zA-Z0-9_-]{33}/g, replacement: '[REDACTED:GOOGLE_API_KEY]' },
    { pattern: /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, replacement: '[REDACTED:JWT_TOKEN]' },
    { pattern: /ghp_[a-zA-Z0-9]{36}/g, replacement: '[REDACTED:GITHUB_TOKEN]' },
    { pattern: /xoxb-[a-zA-Z0-9-]+/g, replacement: '[REDACTED:SLACK_TOKEN]' },
  ];

  for (const { pattern, replacement } of patterns) {
    redacted = redacted.replace(pattern, replacement);
  }

  return redacted;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
