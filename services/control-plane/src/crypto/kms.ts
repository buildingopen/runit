/**
 * ABOUTME: KMS-based encryption for secrets at rest
 * ABOUTME: Re-exports from encryption/kms.ts which uses secure AES-256-GCM
 *
 * MIGRATION NOTE: This file previously used AES-256-CBC without authentication.
 * It now delegates to encryption/kms.ts which uses AES-256-GCM (authenticated encryption).
 * The redactSecrets function is kept here as it's unrelated to the encryption change.
 */

// Re-export encryption functions from the secure implementation
export { encryptSecret, decryptSecret } from '../encryption/kms.js';

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
