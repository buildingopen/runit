// ABOUTME: CRUD operations for project context data (URL-fetched JSON blobs) with per-context and per-project size limits.
// ABOUTME: Uses Supabase when configured, falls back to in-memory Map for development.
/**
 * Contexts Store
 *
 * Database operations for project contexts
 * Falls back to in-memory store if Supabase is not configured
 */

import { getServiceSupabaseClient, isSupabaseConfigured } from './supabase.js';
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

// In-memory store for v0 / dev mode
const inMemoryContexts = new Map<string, Context>();

// Size limits
const MAX_CONTEXT_SIZE = 1024 * 1024; // 1MB per context
const MAX_PROJECT_TOTAL_SIZE = 1024 * 1024; // 1MB total per project

/**
 * Create a new context
 */
export async function createContext(input: CreateContextInput): Promise<Context> {
  // Check size limits
  if (input.size_bytes > MAX_CONTEXT_SIZE) {
    throw new Error(`Context size ${input.size_bytes} bytes exceeds maximum ${MAX_CONTEXT_SIZE} bytes`);
  }

  // Check project total size
  const totalSize = await getProjectContextsSize(input.project_id);
  if (totalSize + input.size_bytes > MAX_PROJECT_TOTAL_SIZE) {
    throw new Error(
      `Adding this context would exceed the project limit of ${MAX_PROJECT_TOTAL_SIZE} bytes`
    );
  }

  const id = uuidv4();
  const now = new Date().toISOString();

  const context: Context = {
    id,
    project_id: input.project_id,
    name: input.name || null,
    url: input.url,
    data: input.data,
    size_bytes: input.size_bytes,
    fetched_at: now,
    created_at: now,
    updated_at: now,
  };

  if (!isSupabaseConfigured()) {
    inMemoryContexts.set(id, context);
    return context;
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('contexts')
    .insert({
      id: context.id,
      project_id: context.project_id,
      name: context.name,
      url: context.url,
      data: context.data,
      size_bytes: context.size_bytes,
      fetched_at: context.fetched_at,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create context: ${error.message}`);
  }

  return data as Context;
}

/**
 * Get a context by ID
 */
export async function getContext(contextId: string): Promise<Context | null> {
  if (!isSupabaseConfigured()) {
    return inMemoryContexts.get(contextId) || null;
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('contexts')
    .select('*')
    .eq('id', contextId)
    .single();

  if (error || !data) {
    return null;
  }

  return data as Context;
}

/**
 * Get a context by project ID and context ID
 */
export async function getProjectContext(
  projectId: string,
  contextId: string
): Promise<Context | null> {
  if (!isSupabaseConfigured()) {
    const context = inMemoryContexts.get(contextId);
    if (context && context.project_id === projectId) {
      return context;
    }
    return null;
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('contexts')
    .select('*')
    .eq('id', contextId)
    .eq('project_id', projectId)
    .single();

  if (error || !data) {
    return null;
  }

  return data as Context;
}

/**
 * List contexts for a project
 */
export async function listProjectContexts(projectId: string): Promise<Context[]> {
  if (!isSupabaseConfigured()) {
    return Array.from(inMemoryContexts.values()).filter(
      (c) => c.project_id === projectId
    );
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('contexts')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list contexts: ${error.message}`);
  }

  return (data || []) as Context[];
}

/**
 * Update a context
 */
export async function updateContext(
  contextId: string,
  updates: UpdateContextInput
): Promise<Context | null> {
  // Check size limit if updating data
  if (updates.size_bytes && updates.size_bytes > MAX_CONTEXT_SIZE) {
    throw new Error(`Context size ${updates.size_bytes} bytes exceeds maximum ${MAX_CONTEXT_SIZE} bytes`);
  }

  if (!isSupabaseConfigured()) {
    const context = inMemoryContexts.get(contextId);
    if (!context) return null;

    // Check project total size if updating data
    if (updates.size_bytes) {
      const totalSize = await getProjectContextsSize(context.project_id);
      const currentSize = context.size_bytes;
      if (totalSize - currentSize + updates.size_bytes > MAX_PROJECT_TOTAL_SIZE) {
        throw new Error(
          `Updating this context would exceed the project limit of ${MAX_PROJECT_TOTAL_SIZE} bytes`
        );
      }
    }

    Object.assign(context, updates, { updated_at: new Date().toISOString() });
    return context;
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('contexts')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', contextId)
    .select()
    .single();

  if (error || !data) {
    return null;
  }

  return data as Context;
}

/**
 * Delete a context
 */
export async function deleteContext(contextId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return inMemoryContexts.delete(contextId);
  }

  const supabase = getServiceSupabaseClient();
  const { error } = await supabase.from('contexts').delete().eq('id', contextId);

  if (error) {
    throw new Error(`Failed to delete context: ${error.message}`);
  }

  return true;
}

/**
 * Delete a context by project ID and context ID
 */
export async function deleteProjectContext(
  projectId: string,
  contextId: string
): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    const context = inMemoryContexts.get(contextId);
    if (context && context.project_id === projectId) {
      return inMemoryContexts.delete(contextId);
    }
    return false;
  }

  const supabase = getServiceSupabaseClient();
  const { error } = await supabase
    .from('contexts')
    .delete()
    .eq('id', contextId)
    .eq('project_id', projectId);

  if (error) {
    throw new Error(`Failed to delete context: ${error.message}`);
  }

  return true;
}

/**
 * Get total size of all contexts for a project
 */
export async function getProjectContextsSize(projectId: string): Promise<number> {
  if (!isSupabaseConfigured()) {
    let total = 0;
    for (const context of inMemoryContexts.values()) {
      if (context.project_id === projectId) {
        total += context.size_bytes;
      }
    }
    return total;
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('contexts')
    .select('size_bytes')
    .eq('project_id', projectId);

  if (error) {
    throw new Error(`Failed to get context sizes: ${error.message}`);
  }

  return (data || []).reduce((sum, c) => sum + (c.size_bytes || 0), 0);
}

/**
 * Refresh a context (update data from URL)
 */
export async function refreshContext(
  contextId: string,
  newData: Record<string, unknown>,
  newSizeBytes: number
): Promise<Context | null> {
  return updateContext(contextId, {
    data: newData,
    size_bytes: newSizeBytes,
    fetched_at: new Date().toISOString(),
  });
}

/**
 * Get context count for a project
 */
export async function getProjectContextCount(projectId: string): Promise<number> {
  if (!isSupabaseConfigured()) {
    return Array.from(inMemoryContexts.values()).filter(
      (c) => c.project_id === projectId
    ).length;
  }

  const supabase = getServiceSupabaseClient();
  const { count, error } = await supabase
    .from('contexts')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', projectId);

  if (error) {
    throw new Error(`Failed to count contexts: ${error.message}`);
  }

  return count || 0;
}
