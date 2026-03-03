// ABOUTME: CRUD operations for project context data (URL-fetched JSON blobs) with per-context and per-project size limits.
// ABOUTME: Uses Supabase when configured, falls back to SQLite for OSS persistence.

import { getServiceSupabaseClient, isSupabaseConfigured } from './supabase.js';
import { getSQLiteDB, parseJSON, toJSON } from './sqlite.js';
import { v4 as uuidv4 } from 'uuid';

export interface Context {
  id: string;
  project_id: string;
  name: string | null;
  url: string;
  data: Record<string, unknown>;
  size_bytes: number;
  fetched_at: string;
  created_at: string;
  updated_at: string;
}

export interface CreateContextInput {
  project_id: string;
  name?: string;
  url: string;
  data: Record<string, unknown>;
  size_bytes: number;
}

export interface UpdateContextInput {
  name?: string;
  data?: Record<string, unknown>;
  size_bytes?: number;
  fetched_at?: string;
}

const MAX_CONTEXT_SIZE = 1024 * 1024;
const MAX_PROJECT_TOTAL_SIZE = 1024 * 1024;

function rowToContext(row: Record<string, unknown>): Context {
  return {
    id: row.id as string,
    project_id: row.project_id as string,
    name: (row.name as string) || null,
    url: row.url as string,
    data: parseJSON<Record<string, unknown>>(row.data as string) || {},
    size_bytes: row.size_bytes as number,
    fetched_at: row.fetched_at as string,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export async function createContext(input: CreateContextInput): Promise<Context> {
  if (input.size_bytes > MAX_CONTEXT_SIZE) {
    throw new Error(`Context size ${input.size_bytes} bytes exceeds maximum ${MAX_CONTEXT_SIZE} bytes`);
  }

  const totalSize = await getProjectContextsSize(input.project_id);
  if (totalSize + input.size_bytes > MAX_PROJECT_TOTAL_SIZE) {
    throw new Error(`Adding this context would exceed the project limit of ${MAX_PROJECT_TOTAL_SIZE} bytes`);
  }

  const id = uuidv4();
  const now = new Date().toISOString();

  if (!isSupabaseConfigured()) {
    const db = getSQLiteDB();
    db.prepare(
      `INSERT INTO contexts (id, project_id, name, url, data, size_bytes, fetched_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, input.project_id, input.name || null, input.url, toJSON(input.data), input.size_bytes, now, now, now);

    return { id, project_id: input.project_id, name: input.name || null, url: input.url, data: input.data, size_bytes: input.size_bytes, fetched_at: now, created_at: now, updated_at: now };
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase.from('contexts').insert({ id, project_id: input.project_id, name: input.name || null, url: input.url, data: input.data, size_bytes: input.size_bytes, fetched_at: now }).select().single();
  if (error) throw new Error(`Failed to create context: ${error.message}`);
  return data as Context;
}

export async function getContext(contextId: string): Promise<Context | null> {
  if (!isSupabaseConfigured()) {
    const db = getSQLiteDB();
    const row = db.prepare('SELECT * FROM contexts WHERE id = ?').get(contextId) as Record<string, unknown> | undefined;
    return row ? rowToContext(row) : null;
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase.from('contexts').select('*').eq('id', contextId).single();
  if (error || !data) return null;
  return data as Context;
}

export async function getProjectContext(projectId: string, contextId: string): Promise<Context | null> {
  if (!isSupabaseConfigured()) {
    const db = getSQLiteDB();
    const row = db.prepare('SELECT * FROM contexts WHERE id = ? AND project_id = ?').get(contextId, projectId) as Record<string, unknown> | undefined;
    return row ? rowToContext(row) : null;
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase.from('contexts').select('*').eq('id', contextId).eq('project_id', projectId).single();
  if (error || !data) return null;
  return data as Context;
}

export async function listProjectContexts(projectId: string): Promise<Context[]> {
  if (!isSupabaseConfigured()) {
    const db = getSQLiteDB();
    const rows = db.prepare('SELECT * FROM contexts WHERE project_id = ? ORDER BY created_at DESC').all(projectId) as Record<string, unknown>[];
    return rows.map(rowToContext);
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase.from('contexts').select('*').eq('project_id', projectId).order('created_at', { ascending: false });
  if (error) throw new Error(`Failed to list contexts: ${error.message}`);
  return (data || []) as Context[];
}

export async function updateContext(contextId: string, updates: UpdateContextInput): Promise<Context | null> {
  if (updates.size_bytes && updates.size_bytes > MAX_CONTEXT_SIZE) {
    throw new Error(`Context size ${updates.size_bytes} bytes exceeds maximum ${MAX_CONTEXT_SIZE} bytes`);
  }

  const now = new Date().toISOString();

  if (!isSupabaseConfigured()) {
    const db = getSQLiteDB();

    if (updates.size_bytes) {
      const ctx = db.prepare('SELECT * FROM contexts WHERE id = ?').get(contextId) as Record<string, unknown> | undefined;
      if (ctx) {
        const totalSize = await getProjectContextsSize(ctx.project_id as string);
        if (totalSize - (ctx.size_bytes as number) + updates.size_bytes > MAX_PROJECT_TOTAL_SIZE) {
          throw new Error(`Updating this context would exceed the project limit of ${MAX_PROJECT_TOTAL_SIZE} bytes`);
        }
      }
    }

    const sets: string[] = ['updated_at = ?'];
    const values: unknown[] = [now];
    if (updates.name !== undefined) { sets.push('name = ?'); values.push(updates.name); }
    if (updates.data !== undefined) { sets.push('data = ?'); values.push(toJSON(updates.data)); }
    if (updates.size_bytes !== undefined) { sets.push('size_bytes = ?'); values.push(updates.size_bytes); }
    if (updates.fetched_at !== undefined) { sets.push('fetched_at = ?'); values.push(updates.fetched_at); }
    values.push(contextId);
    db.prepare(`UPDATE contexts SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    return getContext(contextId);
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase.from('contexts').update({ ...updates, updated_at: now }).eq('id', contextId).select().single();
  if (error || !data) return null;
  return data as Context;
}

export async function deleteContext(contextId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    const db = getSQLiteDB();
    const result = db.prepare('DELETE FROM contexts WHERE id = ?').run(contextId);
    return result.changes > 0;
  }

  const supabase = getServiceSupabaseClient();
  const { error } = await supabase.from('contexts').delete().eq('id', contextId);
  if (error) throw new Error(`Failed to delete context: ${error.message}`);
  return true;
}

export async function deleteProjectContext(projectId: string, contextId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    const db = getSQLiteDB();
    const result = db.prepare('DELETE FROM contexts WHERE id = ? AND project_id = ?').run(contextId, projectId);
    return result.changes > 0;
  }

  const supabase = getServiceSupabaseClient();
  const { error } = await supabase.from('contexts').delete().eq('id', contextId).eq('project_id', projectId);
  if (error) throw new Error(`Failed to delete context: ${error.message}`);
  return true;
}

export async function getProjectContextsSize(projectId: string): Promise<number> {
  if (!isSupabaseConfigured()) {
    const db = getSQLiteDB();
    const row = db.prepare('SELECT COALESCE(SUM(size_bytes), 0) as total FROM contexts WHERE project_id = ?').get(projectId) as { total: number };
    return row.total;
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase.from('contexts').select('size_bytes').eq('project_id', projectId);
  if (error) throw new Error(`Failed to get context sizes: ${error.message}`);
  return (data || []).reduce((sum, c) => sum + (c.size_bytes || 0), 0);
}

export async function refreshContext(contextId: string, newData: Record<string, unknown>, newSizeBytes: number): Promise<Context | null> {
  return updateContext(contextId, { data: newData, size_bytes: newSizeBytes, fetched_at: new Date().toISOString() });
}

export async function getProjectContextCount(projectId: string): Promise<number> {
  if (!isSupabaseConfigured()) {
    const db = getSQLiteDB();
    const row = db.prepare('SELECT COUNT(*) as cnt FROM contexts WHERE project_id = ?').get(projectId) as { cnt: number };
    return row.cnt;
  }

  const supabase = getServiceSupabaseClient();
  const { count, error } = await supabase.from('contexts').select('*', { count: 'exact', head: true }).eq('project_id', projectId);
  if (error) throw new Error(`Failed to count contexts: ${error.message}`);
  return count || 0;
}
