// ABOUTME: CRUD and lifecycle operations for execution runs: create, update status (running/success/error/timeout), list, expire.
// ABOUTME: Uses Supabase when configured, falls back to in-memory Map; 30-day TTL on runs for automatic cleanup.
/**
 * Runs Store
 *
 * Database operations for runs and their results
 * Falls back to in-memory store if Supabase is not configured
 */

import { getServiceSupabaseClient, isSupabaseConfigured } from './supabase.js';
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

// In-memory store for v0 / dev mode
const inMemoryRuns = new Map<string, Run>();

/**
 * Create a new run
 */
export async function createRun(input: CreateRunInput): Promise<Run> {
  const id = uuidv4();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

  const run: Run = {
    id,
    project_id: input.project_id,
    version_id: input.version_id,
    endpoint_id: input.endpoint_id,
    owner_id: input.owner_id,
    request_params: input.request_params || null,
    request_body: input.request_body || null,
    request_headers: input.request_headers || null,
    request_files: input.request_files || null,
    response_status: null,
    response_body: null,
    response_content_type: null,
    status: 'queued',
    duration_ms: null,
    resource_lane: input.resource_lane || 'cpu',
    base_image_version: null,
    error_class: null,
    error_message: null,
    suggested_fix: null,
    logs: null,
    artifacts: null,
    warnings: null,
    redactions_applied: false,
    created_at: now,
    started_at: null,
    completed_at: null,
    expires_at: expiresAt,
  };

  if (!isSupabaseConfigured()) {
    inMemoryRuns.set(id, run);
    return run;
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('runs')
    .insert({
      id: run.id,
      project_id: run.project_id,
      version_id: run.version_id,
      endpoint_id: run.endpoint_id,
      owner_id: run.owner_id,
      request_params: run.request_params,
      request_body: run.request_body,
      request_headers: run.request_headers,
      request_files: run.request_files,
      status: run.status,
      resource_lane: run.resource_lane,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create run: ${error.message}`);
  }

  return data as Run;
}

/**
 * Get a run by ID
 */
export async function getRun(runId: string): Promise<Run | null> {
  if (!isSupabaseConfigured()) {
    return inMemoryRuns.get(runId) || null;
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('runs')
    .select('*')
    .eq('id', runId)
    .single();

  if (error || !data) {
    return null;
  }

  return data as Run;
}

/**
 * Update a run
 */
export async function updateRun(runId: string, updates: UpdateRunInput): Promise<Run | null> {
  if (!isSupabaseConfigured()) {
    const run = inMemoryRuns.get(runId);
    if (!run) return null;
    Object.assign(run, updates);
    return run;
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('runs')
    .update(updates)
    .eq('id', runId)
    .select()
    .single();

  if (error || !data) {
    return null;
  }

  return data as Run;
}

/**
 * List runs for a project
 */
export async function listProjectRuns(
  projectId: string,
  options?: { limit?: number; offset?: number }
): Promise<Run[]> {
  const limit = options?.limit || 50;
  const offset = options?.offset || 0;

  if (!isSupabaseConfigured()) {
    const runs = Array.from(inMemoryRuns.values())
      .filter((r) => r.project_id === projectId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return runs.slice(offset, offset + limit);
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('runs')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to list runs: ${error.message}`);
  }

  return (data || []) as Run[];
}

/**
 * List runs for a user
 */
export async function listUserRuns(
  ownerId: string,
  options?: { limit?: number; offset?: number }
): Promise<Run[]> {
  const limit = options?.limit || 50;
  const offset = options?.offset || 0;

  if (!isSupabaseConfigured()) {
    const runs = Array.from(inMemoryRuns.values())
      .filter((r) => r.owner_id === ownerId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return runs.slice(offset, offset + limit);
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('runs')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to list runs: ${error.message}`);
  }

  return (data || []) as Run[];
}

/**
 * Mark a run as started
 */
export async function markRunStarted(runId: string): Promise<Run | null> {
  return updateRun(runId, {
    status: 'running',
    started_at: new Date().toISOString(),
  });
}

/**
 * Mark a run as completed with success
 */
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
    status: 'success',
    response_status: result.response_status,
    response_body: result.response_body,
    response_content_type: result.response_content_type,
    duration_ms: result.duration_ms,
    artifacts: result.artifacts,
    warnings: result.warnings,
    logs: result.logs,
    redactions_applied: result.redactions_applied,
    completed_at: new Date().toISOString(),
  });
}

/**
 * Mark a run as failed
 */
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
    status: 'error',
    error_class: error.error_class,
    error_message: error.error_message,
    suggested_fix: error.suggested_fix,
    duration_ms: error.duration_ms,
    logs: error.logs,
    completed_at: new Date().toISOString(),
  });
}

/**
 * Mark a run as timed out
 */
export async function markRunTimeout(
  runId: string,
  options?: { duration_ms?: number; logs?: string }
): Promise<Run | null> {
  return updateRun(runId, {
    status: 'timeout',
    error_class: 'TimeoutError',
    error_message: 'Run exceeded the maximum allowed execution time',
    duration_ms: options?.duration_ms,
    logs: options?.logs,
    completed_at: new Date().toISOString(),
  });
}

/**
 * Delete old runs (for retention cleanup)
 */
export async function deleteExpiredRuns(): Promise<number> {
  if (!isSupabaseConfigured()) {
    const now = Date.now();
    let deleted = 0;
    for (const [id, run] of inMemoryRuns.entries()) {
      if (new Date(run.expires_at).getTime() < now) {
        inMemoryRuns.delete(id);
        deleted++;
      }
    }
    return deleted;
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('runs')
    .delete()
    .lt('expires_at', new Date().toISOString())
    .select('id');

  if (error) {
    throw new Error(`Failed to delete expired runs: ${error.message}`);
  }

  return data?.length || 0;
}

/**
 * Get run count for a project
 */
export async function getProjectRunCount(projectId: string): Promise<number> {
  if (!isSupabaseConfigured()) {
    return Array.from(inMemoryRuns.values()).filter(
      (r) => r.project_id === projectId
    ).length;
  }

  const supabase = getServiceSupabaseClient();
  const { count, error } = await supabase
    .from('runs')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', projectId);

  if (error) {
    throw new Error(`Failed to count runs: ${error.message}`);
  }

  return count || 0;
}
