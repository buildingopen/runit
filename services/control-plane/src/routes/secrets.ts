/**
 * ABOUTME: Secrets management routes - encrypted storage and injection
 * ABOUTME: Handles CRUD operations for project secrets (KMS encrypted at rest)
 * Includes audit logging for all secret operations.
 */

import { Hono } from 'hono';
import { encryptSecret, decryptSecret } from '../crypto/kms';
import { getProjectSecrets, storeSecret, deleteSecret, getSecret } from '../db/secrets-store';
import { SECRETS_RESERVED_PREFIX, ERROR_CODES } from '../constants';
import { getAuthContext } from '../middleware/auth';
import { logger } from '../lib/logger';
import { captureMessage } from '../lib/sentry';
import { secretsOperationsTotal } from '../lib/metrics';

const secrets = new Hono();

/**
 * Audit log for secrets operations
 */
function auditLogSecret(
  operation: 'create' | 'update' | 'delete' | 'list' | 'decrypt_failed',
  projectId: string,
  secretKey: string | null,
  userId: string | null,
  success: boolean,
  error?: string
) {
  const auditEntry = {
    operation,
    projectId,
    secretKey: secretKey ? `${secretKey.substring(0, 4)}***` : undefined,  // Partial key for privacy
    userId: userId ?? undefined,
    success,
    error,
    timestamp: new Date().toISOString(),
  };

  if (success) {
    logger.info(`[Secrets Audit] ${operation}`, auditEntry);
  } else {
    logger.warn(`[Secrets Audit] ${operation} FAILED`, auditEntry);
    // Track failed operations in Sentry for alerting
    if (operation === 'decrypt_failed') {
      captureMessage(`Secret decryption failed for project ${projectId}`, 'error');
    }
  }

  // Track metrics
  secretsOperationsTotal.inc({
    operation,
    result: success ? 'success' : 'failure',
  });
}

/**
 * Create or update a secret for a project
 * POST /projects/:projectId/secrets
 */
secrets.post('/:projectId/secrets', async (c) => {
  const { projectId } = c.req.param();
  const authContext = getAuthContext(c);
  const userId = authContext.user?.id || null;

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
  if (key.startsWith(SECRETS_RESERVED_PREFIX)) {
    return c.json({
      error: `Secret key '${key}' uses reserved prefix '${SECRETS_RESERVED_PREFIX}'. Choose a different name.`,
      code: ERROR_CODES.SECRET_RESERVED_PREFIX
    }, 400);
  }

  try {
    // Check if secret exists (update vs create)
    const existing = await getSecret(projectId, key);
    const operation = existing ? 'update' : 'create';

    // Encrypt the secret value
    const encryptedValue = await encryptSecret(value);

    // Store encrypted
    const secret = await storeSecret(projectId, key, encryptedValue);

    // Audit log
    auditLogSecret(operation, projectId, key, userId, true);

    return c.json({
      id: secret.id,
      key: secret.key,
      created_at: secret.created_at,
      updated_at: secret.updated_at
    }, 201);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    auditLogSecret('create', projectId, key, userId, false, errorMessage);

    console.error(`[${ERROR_CODES.SECRET_STORE_FAILED}] Failed to store secret for project ${projectId}:`, {
      key,
      error: errorMessage,
      timestamp: new Date().toISOString()
    });
    return c.json({
      error: 'Failed to store secret',
      code: ERROR_CODES.SECRET_STORE_FAILED
    }, 500);
  }
});

/**
 * List all secret keys for a project (values never returned)
 * GET /projects/:projectId/secrets
 */
secrets.get('/:projectId/secrets', async (c) => {
  const { projectId } = c.req.param();
  const authContext = getAuthContext(c);
  const userId = authContext.user?.id || null;

  try {
    const projectSecrets = await getProjectSecrets(projectId);

    // Return only keys and metadata, never values
    const secretsList = projectSecrets.map(s => ({
      id: s.id,
      key: s.key,
      created_at: s.created_at,
      updated_at: s.updated_at
    }));

    // Audit log
    auditLogSecret('list', projectId, null, userId, true);

    return c.json({ secrets: secretsList });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    auditLogSecret('list', projectId, null, userId, false, errorMessage);

    console.error(`[${ERROR_CODES.SECRET_LIST_FAILED}] Failed to list secrets for project ${projectId}:`, {
      error: errorMessage,
      timestamp: new Date().toISOString()
    });
    return c.json({
      error: 'Failed to list secrets',
      code: ERROR_CODES.SECRET_LIST_FAILED
    }, 500);
  }
});

/**
 * Delete a secret
 * DELETE /projects/:projectId/secrets/:key
 */
secrets.delete('/:projectId/secrets/:key', async (c) => {
  const { projectId, key } = c.req.param();
  const authContext = getAuthContext(c);
  const userId = authContext.user?.id || null;

  try {
    await deleteSecret(projectId, key);

    // Audit log
    auditLogSecret('delete', projectId, key, userId, true);

    return c.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    auditLogSecret('delete', projectId, key, userId, false, errorMessage);

    console.error(`[${ERROR_CODES.SECRET_DELETE_FAILED}] Failed to delete secret ${key} for project ${projectId}:`, {
      error: errorMessage,
      timestamp: new Date().toISOString()
    });
    return c.json({
      error: 'Failed to delete secret',
      code: ERROR_CODES.SECRET_DELETE_FAILED
    }, 500);
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
      // Audit log failed decryption
      auditLogSecret('decrypt_failed', projectId, secret.key, null, false,
        error instanceof Error ? error.message : 'Unknown error');

      console.error(`Failed to decrypt secret ${secret.key}:`, error);
      throw new Error(`SECRETS_DECRYPTION_FAILED: ${secret.key}`);
    }
  }

  return decrypted;
}

export default secrets;
