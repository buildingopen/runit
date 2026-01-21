/**
 * Projects Store
 *
 * Database operations for projects and versions
 * Falls back to in-memory store if Supabase is not configured
 */

import { getServiceSupabaseClient, isSupabaseConfigured } from './supabase.js';
import { v4 as uuidv4 } from 'uuid';

export interface Project {
  id: string;
  owner_id: string;
  slug: string;
  name: string;
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
  status: string;
  created_at: string;
}

export interface Endpoint {
  id: string;
  path: string;
  method: string;
  summary?: string;
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
  status?: string;
}

// In-memory store for v0 / dev mode
const inMemoryProjects = new Map<string, Project>();
const inMemoryVersions = new Map<string, ProjectVersion>();

/**
 * Generate a slug from name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}

/**
 * Create a new project
 */
export async function createProject(input: CreateProjectInput): Promise<Project> {
  const id = uuidv4();
  const slug = input.slug || generateSlug(input.name) + '-' + id.substring(0, 8);
  const now = new Date().toISOString();

  const project: Project = {
    id,
    owner_id: input.owner_id,
    slug,
    name: input.name,
    created_at: now,
    updated_at: now,
  };

  if (!isSupabaseConfigured()) {
    inMemoryProjects.set(id, project);
    return project;
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('projects')
    .insert({
      id: project.id,
      owner_id: project.owner_id,
      slug: project.slug,
      name: project.name,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create project: ${error.message}`);
  }

  return data as Project;
}

/**
 * Get a project by ID
 */
export async function getProject(projectId: string): Promise<Project | null> {
  if (!isSupabaseConfigured()) {
    return inMemoryProjects.get(projectId) || null;
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single();

  if (error || !data) {
    return null;
  }

  return data as Project;
}

/**
 * Get a project by slug
 */
export async function getProjectBySlug(slug: string): Promise<Project | null> {
  if (!isSupabaseConfigured()) {
    for (const project of inMemoryProjects.values()) {
      if (project.slug === slug) {
        return project;
      }
    }
    return null;
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error || !data) {
    return null;
  }

  return data as Project;
}

/**
 * List projects for an owner
 */
export async function listProjects(ownerId: string): Promise<Project[]> {
  if (!isSupabaseConfigured()) {
    return Array.from(inMemoryProjects.values()).filter(
      (p) => p.owner_id === ownerId
    );
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list projects: ${error.message}`);
  }

  return (data || []) as Project[];
}

/**
 * Delete a project
 */
export async function deleteProject(projectId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return inMemoryProjects.delete(projectId);
  }

  const supabase = getServiceSupabaseClient();
  const { error } = await supabase.from('projects').delete().eq('id', projectId);

  if (error) {
    throw new Error(`Failed to delete project: ${error.message}`);
  }

  return true;
}

/**
 * Update a project
 */
export async function updateProject(
  projectId: string,
  updates: Partial<Pick<Project, 'name' | 'slug'>>
): Promise<Project | null> {
  if (!isSupabaseConfigured()) {
    const project = inMemoryProjects.get(projectId);
    if (!project) return null;
    Object.assign(project, updates, { updated_at: new Date().toISOString() });
    return project;
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('projects')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', projectId)
    .select()
    .single();

  if (error || !data) {
    return null;
  }

  return data as Project;
}

// =====================
// Version Operations
// =====================

/**
 * Create a new version
 */
export async function createVersion(input: CreateVersionInput): Promise<ProjectVersion> {
  const id = uuidv4();
  const now = new Date().toISOString();

  const version: ProjectVersion = {
    id,
    project_id: input.project_id,
    version_hash: input.version_hash,
    code_bundle_ref: input.code_bundle_ref,
    openapi: input.openapi || null,
    endpoints: input.endpoints || null,
    deps_hash: null,
    base_image_version: null,
    entrypoint: input.entrypoint || null,
    installed_packages: null,
    status: input.status || 'pending',
    created_at: now,
  };

  if (!isSupabaseConfigured()) {
    inMemoryVersions.set(id, version);
    return version;
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('project_versions')
    .insert({
      id: version.id,
      project_id: version.project_id,
      version_hash: version.version_hash,
      code_bundle_ref: version.code_bundle_ref,
      openapi: version.openapi,
      endpoints: version.endpoints,
      entrypoint: version.entrypoint,
      status: version.status,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create version: ${error.message}`);
  }

  return data as ProjectVersion;
}

/**
 * Get a version by ID
 */
export async function getVersion(versionId: string): Promise<ProjectVersion | null> {
  if (!isSupabaseConfigured()) {
    return inMemoryVersions.get(versionId) || null;
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('project_versions')
    .select('*')
    .eq('id', versionId)
    .single();

  if (error || !data) {
    return null;
  }

  return data as ProjectVersion;
}

/**
 * List versions for a project
 */
export async function listVersions(projectId: string): Promise<ProjectVersion[]> {
  if (!isSupabaseConfigured()) {
    return Array.from(inMemoryVersions.values()).filter(
      (v) => v.project_id === projectId
    );
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('project_versions')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list versions: ${error.message}`);
  }

  return (data || []) as ProjectVersion[];
}

/**
 * Get the latest version for a project
 */
export async function getLatestVersion(projectId: string): Promise<ProjectVersion | null> {
  if (!isSupabaseConfigured()) {
    const versions = Array.from(inMemoryVersions.values())
      .filter((v) => v.project_id === projectId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return versions[0] || null;
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('project_versions')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  return data as ProjectVersion;
}

/**
 * Update a version
 */
export async function updateVersion(
  versionId: string,
  updates: Partial<Pick<ProjectVersion, 'openapi' | 'endpoints' | 'status'>>
): Promise<ProjectVersion | null> {
  if (!isSupabaseConfigured()) {
    const version = inMemoryVersions.get(versionId);
    if (!version) return null;
    Object.assign(version, updates);
    return version;
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('project_versions')
    .update(updates)
    .eq('id', versionId)
    .select()
    .single();

  if (error || !data) {
    return null;
  }

  return data as ProjectVersion;
}

/**
 * Get project with versions
 */
export async function getProjectWithVersions(
  projectId: string
): Promise<(Project & { versions: ProjectVersion[] }) | null> {
  const project = await getProject(projectId);
  if (!project) return null;

  const versions = await listVersions(projectId);
  return { ...project, versions };
}
