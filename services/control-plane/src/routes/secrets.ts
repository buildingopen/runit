/**
 * ABOUTME: Secrets management routes - encrypted storage and injection
 * ABOUTME: Handles CRUD operations for project secrets (KMS encrypted at rest)
 */

import { Hono } from 'hono';
import { encryptSecret, decryptSecret } from '../crypto/kms';
import { getProjectSecrets, storeSecret, deleteSecret, getSecret } from '../db/secrets-store';

const secrets = new Hono();

/**
 * Create or update a secret for a project
 * POST /projects/:projectId/secrets
 */
secrets.post('/:projectId/secrets', async (c) => {
  const { projectId } = c.req.param();
  const body = await c.req.json();

  const { key, value } = body;

  if (!key || !value) {
    return c.json({ error: 'Missing required fields: key, value' }, 400);
  }

  // Validate key name
  if (!/^[A-Z_][A-Z0-9_]*$/.test(key)) {
    return c.json({
      error: 'Invalid secret key format. Use UPPERCASE_SNAKE_CASE (A-Z, 0-9, _)'
    }, 400);
  }

  // Reject reserved prefix
  if (key.startsWith('EL_')) {
    return c.json({
      error: `Secret key '${key}' uses reserved prefix 'EL_'. Choose a different name.`
    }, 400);
  }

  try {
    // Encrypt the secret value
    const encryptedValue = await encryptSecret(value);

    // Store encrypted
    const secret = await storeSecret(projectId, key, encryptedValue);

    return c.json({
      id: secret.id,
      key: secret.key,
      created_at: secret.created_at,
      updated_at: secret.updated_at
    }, 201);
  } catch (error) {
    console.error('Failed to store secret:', error);
    return c.json({ error: 'Failed to store secret' }, 500);
  }
});

/**
 * List all secret keys for a project (values never returned)
 * GET /projects/:projectId/secrets
 */
secrets.get('/:projectId/secrets', async (c) => {
  const { projectId } = c.req.param();

  try {
    const projectSecrets = await getProjectSecrets(projectId);

    // Return only keys and metadata, never values
    const secretsList = projectSecrets.map(s => ({
      id: s.id,
      key: s.key,
      created_at: s.created_at,
      updated_at: s.updated_at
    }));

    return c.json({ secrets: secretsList });
  } catch (error) {
    console.error('Failed to list secrets:', error);
    return c.json({ error: 'Failed to list secrets' }, 500);
  }
});

/**
 * Delete a secret
 * DELETE /projects/:projectId/secrets/:key
 */
secrets.delete('/:projectId/secrets/:key', async (c) => {
  const { projectId, key } = c.req.param();

  try {
    await deleteSecret(projectId, key);
    return c.json({ success: true });
  } catch (error) {
    console.error('Failed to delete secret:', error);
    return c.json({ error: 'Failed to delete secret' }, 500);
  }
});

/**
 * Internal: Get decrypted secrets for a run (never exposed via HTTP)
 */
export async function getDecryptedSecretsForRun(projectId: string): Promise<Record<string, string>> {
  const projectSecrets = await getProjectSecrets(projectId);

  const decrypted: Record<string, string> = {};

  for (const secret of projectSecrets) {
    try {
      const value = await decryptSecret(secret.encrypted_value);
      decrypted[secret.key] = value;
    } catch (error) {
      console.error(`Failed to decrypt secret ${secret.key}:`, error);
      throw new Error(`SECRETS_DECRYPTION_FAILED: ${secret.key}`);
    }
  }

  return decrypted;
}

export default secrets;
