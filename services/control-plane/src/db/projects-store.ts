// ABOUTME: CRUD for projects (create, get, list, delete, update status) and versioned code bundles with OpenAPI metadata.
// ABOUTME: Uses Supabase when configured, falls back to SQLite for OSS persistence; generates slugs from project names.

import { getServiceSupabaseClient, isSupabaseConfigured } from './supabase.js';
import { getSQLiteDB, parseJSON, toJSON } from './sqlite.js';
import { v4 as uuidv4 } from 'uuid';

export type ProjectStatus = 'draft' | 'deploying' | 'live' | 'failed';

export interface Project {
  id: string;
  owner_id: string;
  slug: string;
  name: string;
  status: ProjectStatus;
  deployed_at: string | null;
  deploy_error: string | null;
  runtime_url: string | null;
  dev_version_id: string | null;
  prod_version_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectVersion {
  id: string;
  project_id: string;
  version_hash: string;
  code_bundle_ref: string;
  openapi: Record<string, unknown> | null;
  endpoints: Endpoint[] | null;
  deps_hash: string | null;
  base_image_version: string | null;
  entrypoint: string | null;
  installed_packages: Record<string, unknown> | null;
  detected_env_vars: string[];
  status: string;
  created_at: string;
}

export interface Endpoint {
  id: string;
  path: string;
  method: string;
  summary?: string;
  description?: string;
  parameters?: Record<string, unknown>[];
  requestBody?: Record<string, unknown>;
  responses?: Record<string, unknown>;
}

export interface CreateProjectInput {
  owner_id: string;
  name: string;
  slug?: string;
}

export interface CreateVersionInput {
  project_id: string;
  version_hash: string;
  code_bundle_ref: string;
  openapi?: Record<string, unknown> | null;
  endpoints?: Endpoint[] | null;
  entrypoint?: string | null;
  detected_env_vars?: string[];
  status?: string;
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}

// --- SQLite row mappers ---

function rowToProject(row: Record<string, unknown>): Project {
  return {
    id: row.id as string,
    owner_id: row.owner_id as string,
    slug: row.slug as string,
    name: row.name as string,
    status: (row.status as ProjectStatus) || 'draft',
    deployed_at: (row.deployed_at as string) || null,
    deploy_error: (row.deploy_error as string) || null,
    runtime_url: (row.runtime_url as string) || null,
    dev_version_id: (row.dev_version_id as string) || null,
    prod_version_id: (row.prod_version_id as string) || null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function rowToVersion(row: Record<string, unknown>): ProjectVersion {
  return {
    id: row.id as string,
    project_id: row.project_id as string,
    version_hash: row.version_hash as string,
    code_bundle_ref: row.code_bundle_ref as string,
    openapi: parseJSON<Record<string, unknown>>(row.openapi as string),
    endpoints: parseJSON<Endpoint[]>(row.endpoints as string),
    deps_hash: (row.deps_hash as string) || null,
    base_image_version: (row.base_image_version as string) || null,
    entrypoint: (row.entrypoint as string) || null,
    installed_packages: parseJSON<Record<string, unknown>>(row.installed_packages as string),
    detected_env_vars: parseJSON<string[]>(row.detected_env_vars as string) || [],
    status: row.status as string,
    created_at: row.created_at as string,
  };
}

// =====================
// Project Operations
// =====================

export async function createProject(input: CreateProjectInput): Promise<Project> {
  const id = uuidv4();
  const slug = input.slug || generateSlug(input.name) + '-' + id.substring(0, 8);
  const now = new Date().toISOString();

  if (!isSupabaseConfigured()) {
    const db = getSQLiteDB();
    db.prepare(
      `INSERT INTO projects (id, owner_id, slug, name, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'draft', ?, ?)`
    ).run(id, input.owner_id, slug, input.name, now, now);

    return { id, owner_id: input.owner_id, slug, name: input.name, status: 'draft', deployed_at: null, deploy_error: null, runtime_url: null, dev_version_id: null, prod_version_id: null, created_at: now, updated_at: now };
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('projects')
    .insert({ id, owner_id: input.owner_id, slug, name: input.name, status: 'draft' })
    .select()
    .single();

  if (error) throw new Error(`Failed to create project: ${error.message}`);
  return data as Project;
}

export async function createProjectAtomic(
  input: CreateProjectInput,
  maxProjects: number
): Promise<Project | null> {
  const id = uuidv4();
  const slug = input.slug || generateSlug(input.name) + '-' + id.substring(0, 8);

  if (!isSupabaseConfigured()) {
    const db = getSQLiteDB();
    const count = db.prepare('SELECT COUNT(*) as cnt FROM projects WHERE owner_id = ?').get(input.owner_id) as { cnt: number };
    if (count.cnt >= maxProjects) return null;

    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO projects (id, owner_id, slug, name, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'draft', ?, ?)`
    ).run(id, input.owner_id, slug, input.name, now, now);

    return { id, owner_id: input.owner_id, slug, name: input.name, status: 'draft', deployed_at: null, deploy_error: null, runtime_url: null, dev_version_id: null, prod_version_id: null, created_at: now, updated_at: now };
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase.rpc('create_project_atomic', {
    p_id: id, p_owner_id: input.owner_id, p_name: input.name, p_slug: slug, p_max_projects: maxProjects,
  });

  if (error) throw new Error(`Failed to create project: ${error.message}`);
  if (data === false) return null;

  // Fetch the project we just created. Retry once if replication delay causes null.
  let project = await getProject(id);
  if (!project) {
    await new Promise((r) => setTimeout(r, 200));
    project = await getProject(id);
  }
  return project;
}

export async function getProject(projectId: string): Promise<Project | null> {
  if (!isSupabaseConfigured()) {
    const db = getSQLiteDB();
    const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as Record<string, unknown> | undefined;
    return row ? rowToProject(row) : null;
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase.from('projects').select('*').eq('id', projectId).single();
  if (error || !data) return null;
  return data as Project;
}

export async function getProjectBySlug(slug: string): Promise<Project | null> {
  if (!isSupabaseConfigured()) {
    const db = getSQLiteDB();
    const row = db.prepare('SELECT * FROM projects WHERE slug = ?').get(slug) as Record<string, unknown> | undefined;
    return row ? rowToProject(row) : null;
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase.from('projects').select('*').eq('slug', slug).single();
  if (error || !data) return null;
  return data as Project;
}

export async function listProjects(ownerId: string): Promise<Project[]> {
  if (!isSupabaseConfigured()) {
    const db = getSQLiteDB();
    const rows = db.prepare('SELECT * FROM projects WHERE owner_id = ? ORDER BY created_at DESC').all(ownerId) as Record<string, unknown>[];
    return rows.map(rowToProject);
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase.from('projects').select('*').eq('owner_id', ownerId).order('created_at', { ascending: false });
  if (error) throw new Error(`Failed to list projects: ${error.message}`);
  return (data || []) as Project[];
}

export async function deleteProject(projectId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    const db = getSQLiteDB();
    const result = db.prepare('DELETE FROM projects WHERE id = ?').run(projectId);
    return result.changes > 0;
  }

  const supabase = getServiceSupabaseClient();
  const { error } = await supabase.from('projects').delete().eq('id', projectId);
  if (error) throw new Error(`Failed to delete project: ${error.message}`);
  return true;
}

export async function updateProject(
  projectId: string,
  updates: Partial<Pick<Project, 'name' | 'slug'>>
): Promise<Project | null> {
  const now = new Date().toISOString();

  if (!isSupabaseConfigured()) {
    const db = getSQLiteDB();
    const sets: string[] = ['updated_at = ?'];
    const values: unknown[] = [now];
    if (updates.name !== undefined) { sets.push('name = ?'); values.push(updates.name); }
    if (updates.slug !== undefined) { sets.push('slug = ?'); values.push(updates.slug); }
    values.push(projectId);
    db.prepare(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    return getProject(projectId);
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase.from('projects').update({ ...updates, updated_at: now }).eq('id', projectId).select().single();
  if (error || !data) return null;
  return data as Project;
}

export async function updateProjectStatus(
  projectId: string,
  status: ProjectStatus,
  options?: { deployed_at?: string; deploy_error?: string | null; runtime_url?: string | null }
): Promise<Project | null> {
  const now = new Date().toISOString();

  if (!isSupabaseConfigured()) {
    const db = getSQLiteDB();
    const sets: string[] = ['status = ?', 'updated_at = ?'];
    const values: unknown[] = [status, now];
    if (options?.deployed_at) { sets.push('deployed_at = ?'); values.push(options.deployed_at); }
    if (options?.deploy_error !== undefined) { sets.push('deploy_error = ?'); values.push(options.deploy_error); }
    if (options?.runtime_url !== undefined) { sets.push('runtime_url = ?'); values.push(options.runtime_url); }
    values.push(projectId);
    db.prepare(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    return getProject(projectId);
  }

  const updates: Record<string, unknown> = { status, updated_at: now };
  if (options?.deployed_at) updates.deployed_at = options.deployed_at;
  if (options?.deploy_error !== undefined) updates.deploy_error = options.deploy_error;
  if (options?.runtime_url !== undefined) updates.runtime_url = options.runtime_url;

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase.from('projects').update(updates).eq('id', projectId).select().single();
  if (error || !data) return null;
  return data as Project;
}

export async function setDevVersion(projectId: string, versionId: string): Promise<void> {
  const now = new Date().toISOString();
  if (!isSupabaseConfigured()) {
    const db = getSQLiteDB();
    db.prepare('UPDATE projects SET dev_version_id = ?, updated_at = ? WHERE id = ?').run(versionId, now, projectId);
    return;
  }
  const supabase = getServiceSupabaseClient();
  await supabase.from('projects').update({ dev_version_id: versionId, updated_at: now }).eq('id', projectId);
}

export async function setProdVersion(projectId: string, versionId: string): Promise<void> {
  const now = new Date().toISOString();
  if (!isSupabaseConfigured()) {
    const db = getSQLiteDB();
    db.prepare('UPDATE projects SET prod_version_id = ?, updated_at = ? WHERE id = ?').run(versionId, now, projectId);
    return;
  }
  const supabase = getServiceSupabaseClient();
  await supabase.from('projects').update({ prod_version_id: versionId, updated_at: now }).eq('id', projectId);
}

// =====================
// Version Operations
// =====================

export async function createVersion(input: CreateVersionInput): Promise<ProjectVersion> {
  const id = uuidv4();
  const now = new Date().toISOString();

  if (!isSupabaseConfigured()) {
    const db = getSQLiteDB();
    db.prepare(
      `INSERT INTO project_versions (id, project_id, version_hash, code_bundle_ref, openapi, endpoints, entrypoint, detected_env_vars, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, input.project_id, input.version_hash, input.code_bundle_ref,
      toJSON(input.openapi || null), toJSON(input.endpoints || null),
      input.entrypoint || null, toJSON(input.detected_env_vars || []),
      input.status || 'pending', now
    );

    return {
      id, project_id: input.project_id, version_hash: input.version_hash,
      code_bundle_ref: input.code_bundle_ref, openapi: input.openapi || null,
      endpoints: input.endpoints || null, deps_hash: null, base_image_version: null,
      entrypoint: input.entrypoint || null, installed_packages: null,
      detected_env_vars: input.detected_env_vars || [],
      status: input.status || 'pending', created_at: now,
    };
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('project_versions')
    .insert({
      id, project_id: input.project_id, version_hash: input.version_hash,
      code_bundle_ref: input.code_bundle_ref, openapi: input.openapi,
      endpoints: input.endpoints, entrypoint: input.entrypoint,
      detected_env_vars: input.detected_env_vars, status: input.status || 'pending',
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create version: ${error.message}`);
  return data as ProjectVersion;
}

export async function getVersion(versionId: string): Promise<ProjectVersion | null> {
  if (!isSupabaseConfigured()) {
    const db = getSQLiteDB();
    const row = db.prepare('SELECT * FROM project_versions WHERE id = ?').get(versionId) as Record<string, unknown> | undefined;
    return row ? rowToVersion(row) : null;
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase.from('project_versions').select('*').eq('id', versionId).single();
  if (error || !data) return null;
  return data as ProjectVersion;
}

export async function listVersions(projectId: string): Promise<ProjectVersion[]> {
  if (!isSupabaseConfigured()) {
    const db = getSQLiteDB();
    const rows = db.prepare('SELECT * FROM project_versions WHERE project_id = ? ORDER BY created_at DESC').all(projectId) as Record<string, unknown>[];
    return rows.map(rowToVersion);
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase.from('project_versions').select('*').eq('project_id', projectId).order('created_at', { ascending: false });
  if (error) throw new Error(`Failed to list versions: ${error.message}`);
  return (data || []) as ProjectVersion[];
}

export async function getLatestVersion(projectId: string): Promise<ProjectVersion | null> {
  if (!isSupabaseConfigured()) {
    const db = getSQLiteDB();
    const row = db.prepare('SELECT * FROM project_versions WHERE project_id = ? ORDER BY created_at DESC LIMIT 1').get(projectId) as Record<string, unknown> | undefined;
    return row ? rowToVersion(row) : null;
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase.from('project_versions').select('*').eq('project_id', projectId).order('created_at', { ascending: false }).limit(1).single();
  if (error || !data) return null;
  return data as ProjectVersion;
}

export async function updateVersion(
  versionId: string,
  updates: Partial<Pick<ProjectVersion, 'openapi' | 'endpoints' | 'status'>>
): Promise<ProjectVersion | null> {
  if (!isSupabaseConfigured()) {
    const db = getSQLiteDB();
    const sets: string[] = [];
    const values: unknown[] = [];
    if (updates.openapi !== undefined) { sets.push('openapi = ?'); values.push(toJSON(updates.openapi)); }
    if (updates.endpoints !== undefined) { sets.push('endpoints = ?'); values.push(toJSON(updates.endpoints)); }
    if (updates.status !== undefined) { sets.push('status = ?'); values.push(updates.status); }
    if (sets.length === 0) return getVersion(versionId);
    values.push(versionId);
    db.prepare(`UPDATE project_versions SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    return getVersion(versionId);
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase.from('project_versions').update(updates).eq('id', versionId).select().single();
  if (error || !data) return null;
  return data as ProjectVersion;
}

export async function getProjectWithVersions(
  projectId: string
): Promise<(Project & { versions: ProjectVersion[] }) | null> {
  const project = await getProject(projectId);
  if (!project) return null;
  const versions = await listVersions(projectId);
  return { ...project, versions };
}
