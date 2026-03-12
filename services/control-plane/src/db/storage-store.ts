// ABOUTME: CRUD operations for project key-value storage (stores data as files on disk, metadata in DB).
// ABOUTME: Uses Supabase when configured, falls back to SQLite for OSS persistence.

import { getServiceSupabaseClient, isSupabaseConfigured } from './supabase.js';
import { getSQLiteDB } from './sqlite.js';
import { v4 as uuidv4 } from 'uuid';
import { join } from 'path';
import { mkdirSync, writeFileSync, readFileSync, unlinkSync, existsSync, renameSync, readdirSync, statSync, chmodSync } from 'fs';
import { rmSync } from 'fs';

function getDefaultDataDir(): string {
  if (process.env.NODE_ENV === 'test') {
    return join(process.cwd(), '.runit-test-data');
  }
  return '/data';
}

function getDataDir(): string {
  return process.env.RUNIT_DATA_DIR || getDefaultDataDir();
}

export interface StorageEntry {
  id: string;
  project_id: string;
  key: string;
  value_type: 'json' | 'binary';
  size_bytes: number;
  created_at: string;
  updated_at: string;
}

export interface StorageEntryWithData extends StorageEntry {
  data: unknown;
}

const MAX_VALUE_SIZE = 10 * 1024 * 1024; // 10MB per value
const MAX_PROJECT_SIZE = 100 * 1024 * 1024; // 100MB per project
const KEY_PATTERN = /^[a-zA-Z0-9._-]+$/;
const MAX_KEY_LENGTH = 256;

function validateKey(key: string): string | null {
  if (!key || key.length === 0) return 'Key is required';
  if (key.length > MAX_KEY_LENGTH) return `Key exceeds maximum length of ${MAX_KEY_LENGTH} characters`;
  if (!KEY_PATTERN.test(key)) return 'Key must contain only alphanumeric characters, dots, underscores, and hyphens';
  if (key.includes('..') || key.startsWith('.') || key.endsWith('.')) return 'Key must not start/end with dots or contain consecutive dots';
  return null;
}

function getStorageDir(projectId: string): string {
  // Use RUNNER_STORAGE_BASE_DIR when set (Docker mode), so HTTP API and runner
  // containers share the same storage directory. Falls back to {RUNIT_DATA_DIR}/storage.
  const base = process.env.RUNNER_STORAGE_BASE_DIR || join(getDataDir(), 'storage');
  return join(base, projectId);
}

function getStorageFilePath(projectId: string, key: string): string {
  return join(getStorageDir(projectId), key);
}

function ensureStorageDir(projectId: string): void {
  const dir = getStorageDir(projectId);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    // Runner containers drop ALL capabilities (including DAC_OVERRIDE),
    // so they can't write to dirs they don't own. Make world-writable.
    chmodSync(dir, 0o777);
  }
}

function rowToEntry(row: Record<string, unknown>): StorageEntry {
  return {
    id: row.id as string,
    project_id: row.project_id as string,
    key: row.key as string,
    value_type: row.value_type as 'json' | 'binary',
    size_bytes: row.size_bytes as number,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export async function putStorage(
  projectId: string,
  key: string,
  value: unknown,
  valueType: 'json' | 'binary' = 'json'
): Promise<StorageEntry> {
  const keyError = validateKey(key);
  if (keyError) throw new Error(keyError);

  // Serialize value
  const serialized = valueType === 'json' ? JSON.stringify(value) : String(value);
  const sizeBytes = Buffer.byteLength(serialized, 'utf-8');

  if (sizeBytes > MAX_VALUE_SIZE) {
    throw new Error(`Value size (${sizeBytes} bytes) exceeds maximum of ${MAX_VALUE_SIZE} bytes`);
  }

  // Check project quota (exclude current key's existing size)
  const currentUsage = await getStorageUsage(projectId);
  const existing = await getStorageEntry(projectId, key);
  const existingSize = existing ? existing.size_bytes : 0;
  const projectedUsage = currentUsage - existingSize + sizeBytes;

  if (projectedUsage > MAX_PROJECT_SIZE) {
    throw new Error(`Project storage quota exceeded (${projectedUsage} / ${MAX_PROJECT_SIZE} bytes)`);
  }

  if (!isSupabaseConfigured()) {
    const db = getSQLiteDB();
    const now = new Date().toISOString();

    // Write file atomically
    ensureStorageDir(projectId);
    const filePath = getStorageFilePath(projectId, key);
    const tmpPath = filePath + '.tmp';
    writeFileSync(tmpPath, serialized, 'utf-8');
    renameSync(tmpPath, filePath);

    if (existing) {
      db.prepare(
        'UPDATE storage_entries SET value_type = ?, size_bytes = ?, updated_at = ? WHERE project_id = ? AND key = ?'
      ).run(valueType, sizeBytes, now, projectId, key);
      return rowToEntry({ ...existing, value_type: valueType, size_bytes: sizeBytes, updated_at: now });
    }

    const id = uuidv4();
    db.prepare(
      'INSERT INTO storage_entries (id, project_id, key, value_type, size_bytes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, projectId, key, valueType, sizeBytes, now, now);

    return { id, project_id: projectId, key, value_type: valueType, size_bytes: sizeBytes, created_at: now, updated_at: now };
  }

  // Supabase path
  const supabase = getServiceSupabaseClient();
  const now = new Date().toISOString();

  // Write file atomically
  ensureStorageDir(projectId);
  const filePath = getStorageFilePath(projectId, key);
  const tmpPath = filePath + '.tmp';
  writeFileSync(tmpPath, serialized, 'utf-8');
  renameSync(tmpPath, filePath);

  if (existing) {
    const { data, error } = await supabase
      .from('storage_entries')
      .update({ value_type: valueType, size_bytes: sizeBytes, updated_at: now })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw new Error(`Failed to update storage entry: ${error.message}`);
    return data as StorageEntry;
  }

  const { data, error } = await supabase
    .from('storage_entries')
    .insert({ project_id: projectId, key, value_type: valueType, size_bytes: sizeBytes })
    .select()
    .single();
  if (error) throw new Error(`Failed to create storage entry: ${error.message}`);
  return data as StorageEntry;
}

export async function getStorage(projectId: string, key: string): Promise<StorageEntryWithData | null> {
  const entry = await getStorageEntry(projectId, key);
  if (!entry) return null;

  const filePath = getStorageFilePath(projectId, key);
  if (!existsSync(filePath)) return null;

  const raw = readFileSync(filePath, 'utf-8');
  const data = entry.value_type === 'json' ? JSON.parse(raw) : raw;

  return { ...entry, data };
}

async function getStorageEntry(projectId: string, key: string): Promise<StorageEntry | null> {
  if (!isSupabaseConfigured()) {
    const db = getSQLiteDB();
    const row = db.prepare('SELECT * FROM storage_entries WHERE project_id = ? AND key = ?').get(projectId, key) as Record<string, unknown> | undefined;
    return row ? rowToEntry(row) : null;
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('storage_entries')
    .select('*')
    .eq('project_id', projectId)
    .eq('key', key)
    .single();
  if (error || !data) return null;
  return data as StorageEntry;
}

export async function deleteStorage(projectId: string, key: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    const db = getSQLiteDB();
    const result = db.prepare('DELETE FROM storage_entries WHERE project_id = ? AND key = ?').run(projectId, key);

    // Delete file
    const filePath = getStorageFilePath(projectId, key);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }

    return result.changes > 0;
  }

  const supabase = getServiceSupabaseClient();
  const { error } = await supabase
    .from('storage_entries')
    .delete()
    .eq('project_id', projectId)
    .eq('key', key);
  if (error) throw new Error(`Failed to delete storage entry: ${error.message}`);

  // Delete file
  const filePath = getStorageFilePath(projectId, key);
  if (existsSync(filePath)) {
    unlinkSync(filePath);
  }

  return true;
}

export async function listStorageKeys(projectId: string): Promise<StorageEntry[]> {
  if (!isSupabaseConfigured()) {
    const db = getSQLiteDB();
    const rows = db.prepare('SELECT * FROM storage_entries WHERE project_id = ? ORDER BY key ASC').all(projectId) as Record<string, unknown>[];
    return rows.map(rowToEntry);
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('storage_entries')
    .select('*')
    .eq('project_id', projectId)
    .order('key', { ascending: true });
  if (error) throw new Error(`Failed to list storage entries: ${error.message}`);
  return (data || []) as StorageEntry[];
}

export async function getStorageUsage(projectId: string): Promise<number> {
  if (!isSupabaseConfigured()) {
    const db = getSQLiteDB();
    const row = db.prepare('SELECT COALESCE(SUM(size_bytes), 0) as total FROM storage_entries WHERE project_id = ?').get(projectId) as { total: number };
    return row.total;
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('storage_entries')
    .select('size_bytes')
    .eq('project_id', projectId);
  if (error) throw new Error(`Failed to get storage usage: ${error.message}`);
  return (data || []).reduce((sum: number, row: { size_bytes: number }) => sum + row.size_bytes, 0);
}

export async function deleteProjectStorage(projectId: string): Promise<number> {
  if (!isSupabaseConfigured()) {
    const db = getSQLiteDB();
    const result = db.prepare('DELETE FROM storage_entries WHERE project_id = ?').run(projectId);

    // Delete storage directory
    const dir = getStorageDir(projectId);
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
    }

    return result.changes;
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('storage_entries')
    .delete()
    .eq('project_id', projectId)
    .select('id');
  if (error) throw new Error(`Failed to delete project storage: ${error.message}`);

  // Delete storage directory
  const dir = getStorageDir(projectId);
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }

  return data?.length || 0;
}

export function clearAllStorage(): void {
  if (!isSupabaseConfigured()) {
    const db = getSQLiteDB();
    db.prepare('DELETE FROM storage_entries').run();
  }
}

export { validateKey, MAX_VALUE_SIZE, MAX_PROJECT_SIZE };
