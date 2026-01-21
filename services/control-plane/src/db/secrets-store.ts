/**
 * Secrets Store
 *
 * Database operations for encrypted secrets
 * Falls back to in-memory store if Supabase is not configured
 * Keeps the encryption layer intact (see encryption/kms.ts)
 */

import { getServiceSupabaseClient, isSupabaseConfigured } from './supabase.js';
import { v4 as uuidv4 } from 'uuid';

export interface Secret {
  id: string;
  project_id: string;
  key: string;
  encrypted_value: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateSecretInput {
  project_id: string;
  key: string;
  encrypted_value: string;
  created_by: string;
}

// In-memory store for v0 / dev mode
const secretsStore = new Map<string, Secret>();

/**
 * Generate composite key for in-memory storage
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
  encryptedValue: string,
  createdBy: string = 'system'
): Promise<Secret> {
  if (!isSupabaseConfigured()) {
    const storeKey = getStoreKey(projectId, key);
    const existing = secretsStore.get(storeKey);
    const now = new Date().toISOString();

    const secret: Secret = {
      id: existing?.id || uuidv4(),
      project_id: projectId,
      key,
      encrypted_value: encryptedValue,
      created_by: existing?.created_by || createdBy,
      created_at: existing?.created_at || now,
      updated_at: now,
    };

    secretsStore.set(storeKey, secret);
    return secret;
  }

  const supabase = getServiceSupabaseClient();

  // Try to get existing secret first
  const { data: existing } = await supabase
    .from('secrets')
    .select('*')
    .eq('project_id', projectId)
    .eq('key', key)
    .single();

  if (existing) {
    // Update existing secret
    const { data, error } = await supabase
      .from('secrets')
      .update({
        encrypted_value: encryptedValue,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update secret: ${error.message}`);
    }

    return data as Secret;
  }

  // Create new secret
  const { data, error } = await supabase
    .from('secrets')
    .insert({
      project_id: projectId,
      key,
      encrypted_value: encryptedValue,
      created_by: createdBy,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create secret: ${error.message}`);
  }

  return data as Secret;
}

/**
 * Get all secrets for a project
 */
export async function getProjectSecrets(projectId: string): Promise<Secret[]> {
  if (!isSupabaseConfigured()) {
    const secrets: Secret[] = [];
    for (const secret of secretsStore.values()) {
      if (secret.project_id === projectId) {
        secrets.push(secret);
      }
    }
    return secrets;
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('secrets')
    .select('*')
    .eq('project_id', projectId)
    .order('key', { ascending: true });

  if (error) {
    throw new Error(`Failed to list secrets: ${error.message}`);
  }

  return (data || []) as Secret[];
}

/**
 * Get a specific secret
 */
export async function getSecret(projectId: string, key: string): Promise<Secret | null> {
  if (!isSupabaseConfigured()) {
    const storeKey = getStoreKey(projectId, key);
    return secretsStore.get(storeKey) || null;
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('secrets')
    .select('*')
    .eq('project_id', projectId)
    .eq('key', key)
    .single();

  if (error || !data) {
    return null;
  }

  return data as Secret;
}

/**
 * Delete a secret
 */
export async function deleteSecret(projectId: string, key: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    const storeKey = getStoreKey(projectId, key);
    return secretsStore.delete(storeKey);
  }

  const supabase = getServiceSupabaseClient();
  const { error } = await supabase
    .from('secrets')
    .delete()
    .eq('project_id', projectId)
    .eq('key', key);

  if (error) {
    throw new Error(`Failed to delete secret: ${error.message}`);
  }

  return true;
}

/**
 * Check if a secret exists
 */
export async function secretExists(projectId: string, key: string): Promise<boolean> {
  const secret = await getSecret(projectId, key);
  return secret !== null;
}

/**
 * Get secret count for a project
 */
export async function getProjectSecretCount(projectId: string): Promise<number> {
  if (!isSupabaseConfigured()) {
    let count = 0;
    for (const secret of secretsStore.values()) {
      if (secret.project_id === projectId) {
        count++;
      }
    }
    return count;
  }

  const supabase = getServiceSupabaseClient();
  const { count, error } = await supabase
    .from('secrets')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', projectId);

  if (error) {
    throw new Error(`Failed to count secrets: ${error.message}`);
  }

  return count || 0;
}

/**
 * Clear all secrets (for testing)
 */
export function clearAllSecrets(): void {
  secretsStore.clear();
}

/**
 * Delete all secrets for a project
 */
export async function deleteProjectSecrets(projectId: string): Promise<number> {
  if (!isSupabaseConfigured()) {
    let deleted = 0;
    for (const [storeKey, secret] of secretsStore.entries()) {
      if (secret.project_id === projectId) {
        secretsStore.delete(storeKey);
        deleted++;
      }
    }
    return deleted;
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('secrets')
    .delete()
    .eq('project_id', projectId)
    .select('id');

  if (error) {
    throw new Error(`Failed to delete project secrets: ${error.message}`);
  }

  return data?.length || 0;
}
