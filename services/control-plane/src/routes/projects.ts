/**
 * Project routes - Create and manage projects
 */

import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import { createHash } from 'crypto';
import type {
  CreateProjectRequest,
  CreateProjectResponse,
  ListProjectsResponse,
  GetProjectResponse
} from '@execution-layer/shared';
import { extractOpenAPIFromZip } from '../openapi-extractor.js';

const projects = new Hono();

// In-memory store for MVP (replace with database later)
const projectsStore = new Map<string, {
  project_id: string;
  project_slug: string;
  name: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
  versions: Array<{
    version_id: string;
    version_hash: string;
    code_bundle: string;  // base64
    created_at: string;
    status: 'building' | 'ready' | 'failed';
    openapi?: any;
    endpoints?: any[];
  }>;
}>();

/**
 * POST /projects - Create a new project
 */
projects.post('/', async (c) => {
  const body = await c.req.json() as CreateProjectRequest;

  // Validate request
  if (!body.name || !body.source_type) {
    return c.json({ error: 'Missing required fields: name, source_type' }, 400);
  }

  if (body.source_type === 'zip' && !body.zip_data) {
    return c.json({ error: 'zip_data required for ZIP uploads' }, 400);
  }

  // Generate IDs
  const project_id = randomUUID();
  const project_slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const version_id = randomUUID();

  // Calculate version hash from code bundle
  const code_bundle = body.zip_data || '';
  const version_hash = createHash('sha256').update(code_bundle).digest('hex').substring(0, 12);

  // Create project
  const version: {
    version_id: string;
    version_hash: string;
    code_bundle: string;
    created_at: string;
    status: 'building' | 'ready' | 'failed';
    openapi?: any;
    endpoints?: any[];
  } = {
    version_id,
    version_hash,
    code_bundle,
    created_at: new Date().toISOString(),
    status: 'ready',
  };

  const project = {
    project_id,
    project_slug,
    name: body.name,
    owner_id: 'default-user',  // TODO: Get from auth
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    versions: [version]
  };

  projectsStore.set(project_id, project);

  // Extract OpenAPI spec (non-blocking, best-effort)
  if (code_bundle) {
    try {
      const { openapi, endpoints } = await extractOpenAPIFromZip(code_bundle);
      version.openapi = openapi;
      version.endpoints = endpoints;
      console.log(`✅ Extracted ${endpoints.length} endpoints from ${project.name}`);
    } catch (error) {
      console.warn('⚠️  OpenAPI extraction failed (non-fatal):', error);
      // Non-fatal: project created but without OpenAPI
    }
  }

  const response: CreateProjectResponse = {
    project_id,
    project_slug,
    version_id,
    version_hash,
    status: 'ready',
  };

  return c.json(response, 201);
});

/**
 * GET /projects - List all projects
 */
projects.get('/', async (c) => {
  const projects_array = Array.from(projectsStore.values()).map(p => ({
    project_id: p.project_id,
    project_slug: p.project_slug,
    name: p.name,
    latest_version: p.versions[p.versions.length - 1]?.version_hash || '',
    created_at: p.created_at,
    updated_at: p.updated_at,
  }));

  const response: ListProjectsResponse = {
    projects: projects_array,
    total: projects_array.length,
  };

  return c.json(response);
});

/**
 * GET /projects/:id - Get project details
 */
projects.get('/:id', async (c) => {
  const project_id = c.req.param('id');
  const project = projectsStore.get(project_id);

  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  const response: GetProjectResponse = {
    project_id: project.project_id,
    project_slug: project.project_slug,
    name: project.name,
    owner_id: project.owner_id,
    versions: project.versions.map(v => ({
      version_id: v.version_id,
      version_hash: v.version_hash,
      created_at: v.created_at,
      status: v.status,
    })),
    created_at: project.created_at,
    updated_at: project.updated_at,
  };

  return c.json(response);
});

/**
 * Helper to get project from store
 */
export function getProject(project_id: string) {
  return projectsStore.get(project_id);
}

/**
 * Helper to update project version with OpenAPI
 */
export function updateVersionOpenAPI(project_id: string, version_id: string, openapi: any, endpoints: any[]) {
  const project = projectsStore.get(project_id);
  if (!project) return false;

  const version = project.versions.find(v => v.version_id === version_id);
  if (!version) return false;

  version.openapi = openapi;
  version.endpoints = endpoints;
  return true;
}

export default projects;
