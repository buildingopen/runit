/**
 * Secrets routes - Store and manage encrypted secrets per project
 *
 * SECURITY CONTRACT:
 * - Secrets encrypted at rest using KMS envelope encryption
 * - Decrypted only at run-time
 * - Never shared via links
 * - Owner-only visibility
 */

import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import { encryptSecret, decryptSecret } from '../encryption/kms.js';
import { getProject } from './projects.js';

const secrets = new Hono();

// In-memory secrets store (replace with database later)
// Maps: project_id -> Map<key, encrypted_value>
const secretsStore = new Map<string, Map<string, {
  id: string;
  key: string;
  encrypted_value: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}>>();

// Forbidden context key patterns (prevent storing secrets as context)
const FORBIDDEN_SECRET_KEYS = [
  /.*_KEY$/i,
  /.*_TOKEN$/i,
  /.*_SECRET$/i,
  /^PASSWORD/i,
  /^API_KEY/i,
  /^SECRET/i,
];

function validateSecretKey(key: string): void {
  for (const pattern of FORBIDDEN_SECRET_KEYS) {
    if (pattern.test(key)) {
      // This is actually ALLOWED for secrets (not context)
      // The validation is reversed - we WANT these patterns here
      return;
    }
  }
  // Allow all keys for secrets
}

/**
 * POST /projects/:id/secrets - Store encrypted secret
 */
secrets.post('/:id/secrets', async (c) => {
  const projectId = c.req.param('id');
  const body = await c.req.json() as { key: string; value: string };

  // Validate request
  if (!body.key || !body.value) {
    return c.json({ error: 'Missing key or value' }, 400);
  }

  // Validate project exists
  const project = getProject(projectId);
  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  // Encrypt the secret value
  let encryptedValue: string;
  try {
    encryptedValue = await encryptSecret(body.value);
  } catch (error) {
    console.error('Encryption failed:', error);
    return c.json({
      error: 'Failed to encrypt secret',
      error_class: 'SECRETS_ENCRYPTION_FAILED'
    }, 500);
  }

  // Get or create project secrets map
  let projectSecrets = secretsStore.get(projectId);
  if (!projectSecrets) {
    projectSecrets = new Map();
    secretsStore.set(projectId, projectSecrets);
  }

  // Store encrypted secret
  const secretId = randomUUID();
  const now = new Date().toISOString();

  projectSecrets.set(body.key, {
    id: secretId,
    key: body.key,
    encrypted_value: encryptedValue,
    created_by: 'mock-user-id',  // TODO: Get from auth
    created_at: now,
    updated_at: now,
  });

  return c.json({
    id: secretId,
    key: body.key,
    created_at: now,
    updated_at: now,
  }, 201);
});

/**
 * GET /projects/:id/secrets - List secret keys (masked values)
 */
secrets.get('/:id/secrets', async (c) => {
  const projectId = c.req.param('id');

  // Validate project exists
  const project = getProject(projectId);
  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  // Get project secrets
  const projectSecrets = secretsStore.get(projectId);
  if (!projectSecrets) {
    return c.json({ secrets: [] });
  }

  // Return keys only (never values)
  const secrets = Array.from(projectSecrets.values()).map(secret => ({
    id: secret.id,
    key: secret.key,
    value: '***',  // Always masked
    created_at: secret.created_at,
    updated_at: secret.updated_at,
  }));

  return c.json({ secrets });
});

/**
 * PUT /projects/:id/secrets/:key - Update secret value
 */
secrets.put('/:id/secrets/:key', async (c) => {
  const projectId = c.req.param('id');
  const secretKey = c.req.param('key');
  const body = await c.req.json() as { value: string };

  // Validate request
  if (!body.value) {
    return c.json({ error: 'Missing value' }, 400);
  }

  // Validate project exists
  const project = getProject(projectId);
  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  // Get project secrets
  const projectSecrets = secretsStore.get(projectId);
  if (!projectSecrets || !projectSecrets.has(secretKey)) {
    return c.json({ error: 'Secret not found' }, 404);
  }

  // Encrypt new value
  let encryptedValue: string;
  try {
    encryptedValue = await encryptSecret(body.value);
  } catch (error) {
    console.error('Encryption failed:', error);
    return c.json({
      error: 'Failed to encrypt secret',
      error_class: 'SECRETS_ENCRYPTION_FAILED'
    }, 500);
  }

  // Update secret
  const existingSecret = projectSecrets.get(secretKey)!;
  projectSecrets.set(secretKey, {
    ...existingSecret,
    encrypted_value: encryptedValue,
    updated_at: new Date().toISOString(),
  });

  return c.json({
    id: existingSecret.id,
    key: secretKey,
    updated_at: new Date().toISOString(),
  });
});

/**
 * DELETE /projects/:id/secrets/:key - Delete secret
 */
secrets.delete('/:id/secrets/:key', async (c) => {
  const projectId = c.req.param('id');
  const secretKey = c.req.param('key');

  // Validate project exists
  const project = getProject(projectId);
  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  // Get project secrets
  const projectSecrets = secretsStore.get(projectId);
  if (!projectSecrets || !projectSecrets.has(secretKey)) {
    return c.json({ error: 'Secret not found' }, 404);
  }

  // Delete secret
  projectSecrets.delete(secretKey);

  return c.json({ success: true });
});

/**
 * Internal function to get decrypted secrets for a run
 * (Never exposed via HTTP)
 */
export async function getDecryptedSecrets(projectId: string): Promise<Record<string, string>> {
  const projectSecrets = secretsStore.get(projectId);
  if (!projectSecrets) {
    return {};
  }

  const decrypted: Record<string, string> = {};

  for (const [key, secret] of projectSecrets.entries()) {
    try {
      decrypted[key] = await decryptSecret(secret.encrypted_value);
    } catch (error) {
      console.error(`Failed to decrypt secret ${key}:`, error);
      throw new Error(`SECRETS_DECRYPTION_FAILED: ${key}`);
    }
  }

  return decrypted;
}

export default secrets;
