/**
 * ABOUTME: In-memory secrets store (v0 implementation)
 * ABOUTME: Production should use PostgreSQL with encrypted columns
 */

interface Secret {
  id: string;
  project_id: string;
  key: string;
  encrypted_value: string;
  created_at: string;
  updated_at: string;
}

// In-memory store for v0
const secretsStore = new Map<string, Secret>();

/**
 * Generate composite key for storage
 */
function getStoreKey(projectId: string, key: string): string {
  return `${projectId}:${key}`;
}

/**
 * Store or update a secret
 */
export async function storeSecret(
  projectId: string,
  key: string,
  encryptedValue: string
): Promise<Secret> {
  const storeKey = getStoreKey(projectId, key);
  const existing = secretsStore.get(storeKey);

  const secret: Secret = {
    id: existing?.id || crypto.randomUUID(),
    project_id: projectId,
    key,
    encrypted_value: encryptedValue,
    created_at: existing?.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  secretsStore.set(storeKey, secret);
  return secret;
}

/**
 * Get all secrets for a project
 */
export async function getProjectSecrets(projectId: string): Promise<Secret[]> {
  const secrets: Secret[] = [];

  for (const [storeKey, secret] of secretsStore.entries()) {
    if (secret.project_id === projectId) {
      secrets.push(secret);
    }
  }

  return secrets;
}

/**
 * Get a specific secret
 */
export async function getSecret(projectId: string, key: string): Promise<Secret | null> {
  const storeKey = getStoreKey(projectId, key);
  return secretsStore.get(storeKey) || null;
}

/**
 * Delete a secret
 */
export async function deleteSecret(projectId: string, key: string): Promise<void> {
  const storeKey = getStoreKey(projectId, key);
  secretsStore.delete(storeKey);
}

/**
 * Clear all secrets (for testing)
 */
export function clearAllSecrets(): void {
  secretsStore.clear();
}
