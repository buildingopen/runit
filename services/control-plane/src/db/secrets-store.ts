// ABOUTME: CRUD operations for encrypted secrets (stores pre-encrypted blobs, does not handle encryption itself).
// ABOUTME: Uses Supabase when configured, falls back to SQLite for OSS persistence.

import { getServiceSupabaseClient, isSupabaseConfigured } from './supabase.js';
import { getSQLiteDB } from './sqlite.js';
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

function rowToSecret(row: Record<string, unknown>): Secret {
  return {
    id: row.id as string,
    project_id: row.project_id as string,
    key: row.key as string,
    encrypted_value: row.encrypted_value as string,
    created_by: row.created_by as string,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export async function storeSecret(
  projectId: string,
  key: string,
  encryptedValue: string,
  createdBy: string = 'system'
): Promise<Secret> {
  if (!isSupabaseConfigured()) {
    const db = getSQLiteDB();
    const now = new Date().toISOString();

    const existing = db.prepare('SELECT * FROM secrets WHERE project_id = ? AND key = ?').get(projectId, key) as Record<string, unknown> | undefined;

    if (existing) {
      db.prepare('UPDATE secrets SET encrypted_value = ?, updated_at = ? WHERE project_id = ? AND key = ?')
        .run(encryptedValue, now, projectId, key);
      return rowToSecret({ ...existing, encrypted_value: encryptedValue, updated_at: now });
    }

    const id = uuidv4();
    db.prepare('INSERT INTO secrets (id, project_id, key, encrypted_value, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, projectId, key, encryptedValue, createdBy, now, now);

    return { id, project_id: projectId, key, encrypted_value: encryptedValue, created_by: createdBy, created_at: now, updated_at: now };
  }

  const supabase = getServiceSupabaseClient();
  const { data: existing } = await supabase.from('secrets').select('*').eq('project_id', projectId).eq('key', key).single();

  if (existing) {
    const { data, error } = await supabase.from('secrets').update({ encrypted_value: encryptedValue, updated_at: new Date().toISOString() }).eq('id', existing.id).select().single();
    if (error) throw new Error(`Failed to update secret: ${error.message}`);
    return data as Secret;
  }

  const { data, error } = await supabase.from('secrets').insert({ project_id: projectId, key, encrypted_value: encryptedValue, created_by: createdBy }).select().single();
  if (error) throw new Error(`Failed to create secret: ${error.message}`);
  return data as Secret;
}

export async function getProjectSecrets(projectId: string): Promise<Secret[]> {
  if (!isSupabaseConfigured()) {
    const db = getSQLiteDB();
    const rows = db.prepare('SELECT * FROM secrets WHERE project_id = ? ORDER BY key ASC').all(projectId) as Record<string, unknown>[];
    return rows.map(rowToSecret);
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase.from('secrets').select('*').eq('project_id', projectId).order('key', { ascending: true });
  if (error) throw new Error(`Failed to list secrets: ${error.message}`);
  return (data || []) as Secret[];
}

export async function getSecret(projectId: string, key: string): Promise<Secret | null> {
  if (!isSupabaseConfigured()) {
    const db = getSQLiteDB();
    const row = db.prepare('SELECT * FROM secrets WHERE project_id = ? AND key = ?').get(projectId, key) as Record<string, unknown> | undefined;
    return row ? rowToSecret(row) : null;
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase.from('secrets').select('*').eq('project_id', projectId).eq('key', key).single();
  if (error || !data) return null;
  return data as Secret;
}

export async function deleteSecret(projectId: string, key: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    const db = getSQLiteDB();
    const result = db.prepare('DELETE FROM secrets WHERE project_id = ? AND key = ?').run(projectId, key);
    return result.changes > 0;
  }

  const supabase = getServiceSupabaseClient();
  const { error } = await supabase.from('secrets').delete().eq('project_id', projectId).eq('key', key);
  if (error) throw new Error(`Failed to delete secret: ${error.message}`);
  return true;
}

export async function secretExists(projectId: string, key: string): Promise<boolean> {
  const secret = await getSecret(projectId, key);
  return secret !== null;
}

export async function getProjectSecretCount(projectId: string): Promise<number> {
  if (!isSupabaseConfigured()) {
    const db = getSQLiteDB();
    const row = db.prepare('SELECT COUNT(*) as cnt FROM secrets WHERE project_id = ?').get(projectId) as { cnt: number };
    return row.cnt;
  }

  const supabase = getServiceSupabaseClient();
  const { count, error } = await supabase.from('secrets').select('*', { count: 'exact', head: true }).eq('project_id', projectId);
  if (error) throw new Error(`Failed to count secrets: ${error.message}`);
  return count || 0;
}

export function clearAllSecrets(): void {
  if (!isSupabaseConfigured()) {
    const db = getSQLiteDB();
    db.prepare('DELETE FROM secrets').run();
    return;
  }
}

export async function deleteProjectSecrets(projectId: string): Promise<number> {
  if (!isSupabaseConfigured()) {
    const db = getSQLiteDB();
    const result = db.prepare('DELETE FROM secrets WHERE project_id = ?').run(projectId);
    return result.changes;
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase.from('secrets').delete().eq('project_id', projectId).select('id');
  if (error) throw new Error(`Failed to delete project secrets: ${error.message}`);
  return data?.length || 0;
}
