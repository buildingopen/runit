// ABOUTME: CRUD and lifecycle operations for execution runs: create, update status (running/success/error/timeout), list, expire.
// ABOUTME: Uses Supabase when configured, falls back to SQLite for OSS persistence; 30-day TTL on runs for automatic cleanup.

import { getServiceSupabaseClient, isSupabaseConfigured } from './supabase.js';
import { getSQLiteDB, parseJSON, toJSON } from './sqlite.js';
import { v4 as uuidv4 } from 'uuid';

export type RunStatus = 'queued' | 'running' | 'success' | 'error' | 'timeout';

export interface Run {
  id: string;
  project_id: string;
  version_id: string;
  endpoint_id: string;
  owner_id: string;
  request_params: Record<string, unknown> | null;
  request_body: Record<string, unknown> | null;
  request_headers: Record<string, unknown> | null;
  request_files: Record<string, unknown> | null;
  response_status: number | null;
  response_body: Record<string, unknown> | null;
  response_content_type: string | null;
  status: RunStatus;
  duration_ms: number | null;
  resource_lane: string | null;
  base_image_version: string | null;
  error_class: string | null;
  error_message: string | null;
  suggested_fix: string | null;
  logs: string | null;
  artifacts: Artifact[] | null;
  warnings: string[] | null;
  redactions_applied: boolean;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  expires_at: string;
}

export interface Artifact {
  name: string;
  size: number;
  mime: string;
  storage_ref: string;
}

export interface CreateRunInput {
  project_id: string;
  version_id: string;
  endpoint_id: string;
  owner_id: string;
  request_params?: Record<string, unknown>;
  request_body?: Record<string, unknown>;
  request_headers?: Record<string, unknown>;
  request_files?: Record<string, unknown>;
  resource_lane?: string;
}

export interface UpdateRunInput {
  status?: RunStatus;
  response_status?: number;
  response_body?: Record<string, unknown>;
  response_content_type?: string;
  duration_ms?: number;
  error_class?: string;
  error_message?: string;
  suggested_fix?: string;
  logs?: string;
  artifacts?: Artifact[];
  warnings?: string[];
  redactions_applied?: boolean;
  started_at?: string;
  completed_at?: string;
}

function rowToRun(row: Record<string, unknown>): Run {
  return {
    id: row.id as string,
    project_id: row.project_id as string,
    version_id: row.version_id as string,
    endpoint_id: row.endpoint_id as string,
    owner_id: row.owner_id as string,
    request_params: parseJSON<Record<string, unknown>>(row.request_params as string),
    request_body: parseJSON<Record<string, unknown>>(row.request_body as string),
    request_headers: parseJSON<Record<string, unknown>>(row.request_headers as string),
    request_files: parseJSON<Record<string, unknown>>(row.request_files as string),
    response_status: (row.response_status as number) || null,
    response_body: parseJSON<Record<string, unknown>>(row.response_body as string),
    response_content_type: (row.response_content_type as string) || null,
    status: row.status as RunStatus,
    duration_ms: (row.duration_ms as number) || null,
    resource_lane: (row.resource_lane as string) || null,
    base_image_version: (row.base_image_version as string) || null,
    error_class: (row.error_class as string) || null,
    error_message: (row.error_message as string) || null,
    suggested_fix: (row.suggested_fix as string) || null,
    logs: (row.logs as string) || null,
    artifacts: parseJSON<Artifact[]>(row.artifacts as string),
    warnings: parseJSON<string[]>(row.warnings as string),
    redactions_applied: !!(row.redactions_applied),
    created_at: row.created_at as string,
    started_at: (row.started_at as string) || null,
    completed_at: (row.completed_at as string) || null,
    expires_at: row.expires_at as string,
  };
}

export async function createRun(input: CreateRunInput): Promise<Run> {
  const id = uuidv4();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  if (!isSupabaseConfigured()) {
    const db = getSQLiteDB();
    db.prepare(
      `INSERT INTO runs (id, project_id, version_id, endpoint_id, owner_id, request_params, request_body, request_headers, request_files, status, resource_lane, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?, ?)`
    ).run(
      id, input.project_id, input.version_id, input.endpoint_id, input.owner_id,
      toJSON(input.request_params || null), toJSON(input.request_body || null),
      toJSON(input.request_headers || null), toJSON(input.request_files || null),
      input.resource_lane || 'cpu', now, expiresAt
    );

    return {
      id, project_id: input.project_id, version_id: input.version_id,
      endpoint_id: input.endpoint_id, owner_id: input.owner_id,
      request_params: input.request_params || null, request_body: input.request_body || null,
      request_headers: input.request_headers || null, request_files: input.request_files || null,
      response_status: null, response_body: null, response_content_type: null,
      status: 'queued', duration_ms: null, resource_lane: input.resource_lane || 'cpu',
      base_image_version: null, error_class: null, error_message: null, suggested_fix: null,
      logs: null, artifacts: null, warnings: null, redactions_applied: false,
      created_at: now, started_at: null, completed_at: null, expires_at: expiresAt,
    };
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase.from('runs').insert({
    id, project_id: input.project_id, version_id: input.version_id,
    endpoint_id: input.endpoint_id, owner_id: input.owner_id,
    request_params: input.request_params, request_body: input.request_body,
    request_headers: input.request_headers, request_files: input.request_files,
    status: 'queued', resource_lane: input.resource_lane,
  }).select().single();

  if (error) throw new Error(`Failed to create run: ${error.message}`);
  return data as Run;
}

export async function getRun(runId: string): Promise<Run | null> {
  if (!isSupabaseConfigured()) {
    const db = getSQLiteDB();
    const row = db.prepare('SELECT * FROM runs WHERE id = ?').get(runId) as Record<string, unknown> | undefined;
    return row ? rowToRun(row) : null;
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase.from('runs').select('*').eq('id', runId).single();
  if (error || !data) return null;
  return data as Run;
}

export async function updateRun(runId: string, updates: UpdateRunInput): Promise<Run | null> {
  if (!isSupabaseConfigured()) {
    const db = getSQLiteDB();
    const sets: string[] = [];
    const values: unknown[] = [];

    if (updates.status !== undefined) { sets.push('status = ?'); values.push(updates.status); }
    if (updates.response_status !== undefined) { sets.push('response_status = ?'); values.push(updates.response_status); }
    if (updates.response_body !== undefined) { sets.push('response_body = ?'); values.push(toJSON(updates.response_body)); }
    if (updates.response_content_type !== undefined) { sets.push('response_content_type = ?'); values.push(updates.response_content_type); }
    if (updates.duration_ms !== undefined) { sets.push('duration_ms = ?'); values.push(updates.duration_ms); }
    if (updates.error_class !== undefined) { sets.push('error_class = ?'); values.push(updates.error_class); }
    if (updates.error_message !== undefined) { sets.push('error_message = ?'); values.push(updates.error_message); }
    if (updates.suggested_fix !== undefined) { sets.push('suggested_fix = ?'); values.push(updates.suggested_fix); }
    if (updates.logs !== undefined) { sets.push('logs = ?'); values.push(updates.logs); }
    if (updates.artifacts !== undefined) { sets.push('artifacts = ?'); values.push(toJSON(updates.artifacts)); }
    if (updates.warnings !== undefined) { sets.push('warnings = ?'); values.push(toJSON(updates.warnings)); }
    if (updates.redactions_applied !== undefined) { sets.push('redactions_applied = ?'); values.push(updates.redactions_applied ? 1 : 0); }
    if (updates.started_at !== undefined) { sets.push('started_at = ?'); values.push(updates.started_at); }
    if (updates.completed_at !== undefined) { sets.push('completed_at = ?'); values.push(updates.completed_at); }

    if (sets.length === 0) return getRun(runId);
    values.push(runId);
    db.prepare(`UPDATE runs SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    return getRun(runId);
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase.from('runs').update(updates).eq('id', runId).select().single();
  if (error || !data) return null;
  return data as Run;
}

export async function listProjectRuns(
  projectId: string,
  options?: { limit?: number; offset?: number }
): Promise<Run[]> {
  const limit = options?.limit || 50;
  const offset = options?.offset || 0;

  if (!isSupabaseConfigured()) {
    const db = getSQLiteDB();
    const rows = db.prepare('SELECT * FROM runs WHERE project_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?').all(projectId, limit, offset) as Record<string, unknown>[];
    return rows.map(rowToRun);
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase.from('runs').select('*').eq('project_id', projectId).order('created_at', { ascending: false }).range(offset, offset + limit - 1);
  if (error) throw new Error(`Failed to list runs: ${error.message}`);
  return (data || []) as Run[];
}

export async function listUserRuns(
  ownerId: string,
  options?: { limit?: number; offset?: number }
): Promise<Run[]> {
  const limit = options?.limit || 50;
  const offset = options?.offset || 0;

  if (!isSupabaseConfigured()) {
    const db = getSQLiteDB();
    const rows = db.prepare('SELECT * FROM runs WHERE owner_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?').all(ownerId, limit, offset) as Record<string, unknown>[];
    return rows.map(rowToRun);
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase.from('runs').select('*').eq('owner_id', ownerId).order('created_at', { ascending: false }).range(offset, offset + limit - 1);
  if (error) throw new Error(`Failed to list runs: ${error.message}`);
  return (data || []) as Run[];
}

export async function markRunStarted(runId: string): Promise<Run | null> {
  return updateRun(runId, { status: 'running', started_at: new Date().toISOString() });
}

export async function markRunSuccess(
  runId: string,
  result: {
    response_status: number;
    response_body: Record<string, unknown>;
    response_content_type: string;
    duration_ms: number;
    artifacts?: Artifact[];
    warnings?: string[];
    logs?: string;
    redactions_applied?: boolean;
  }
): Promise<Run | null> {
  return updateRun(runId, {
    status: 'success', response_status: result.response_status,
    response_body: result.response_body, response_content_type: result.response_content_type,
    duration_ms: result.duration_ms, artifacts: result.artifacts, warnings: result.warnings,
    logs: result.logs, redactions_applied: result.redactions_applied,
    completed_at: new Date().toISOString(),
  });
}

export async function markRunError(
  runId: string,
  error: {
    error_class: string;
    error_message: string;
    suggested_fix?: string;
    duration_ms?: number;
    logs?: string;
  }
): Promise<Run | null> {
  return updateRun(runId, {
    status: 'error', error_class: error.error_class, error_message: error.error_message,
    suggested_fix: error.suggested_fix, duration_ms: error.duration_ms, logs: error.logs,
    completed_at: new Date().toISOString(),
  });
}

export async function markRunTimeout(
  runId: string,
  options?: { duration_ms?: number; logs?: string }
): Promise<Run | null> {
  return updateRun(runId, {
    status: 'timeout', error_class: 'TimeoutError',
    error_message: 'Run exceeded the maximum allowed execution time',
    duration_ms: options?.duration_ms, logs: options?.logs,
    completed_at: new Date().toISOString(),
  });
}

export async function deleteExpiredRuns(): Promise<number> {
  const now = new Date().toISOString();

  if (!isSupabaseConfigured()) {
    const db = getSQLiteDB();
    const result = db.prepare('DELETE FROM runs WHERE expires_at < ?').run(now);
    return result.changes;
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase.from('runs').delete().lt('expires_at', now).select('id');
  if (error) throw new Error(`Failed to delete expired runs: ${error.message}`);
  return data?.length || 0;
}

export async function getProjectRunCount(projectId: string): Promise<number> {
  if (!isSupabaseConfigured()) {
    const db = getSQLiteDB();
    const row = db.prepare('SELECT COUNT(*) as cnt FROM runs WHERE project_id = ?').get(projectId) as { cnt: number };
    return row.cnt;
  }

  const supabase = getServiceSupabaseClient();
  const { count, error } = await supabase.from('runs').select('*', { count: 'exact', head: true }).eq('project_id', projectId);
  if (error) throw new Error(`Failed to count runs: ${error.message}`);
  return count || 0;
}
