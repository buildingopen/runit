// ABOUTME: Hono routes for project CRUD: create (ZIP upload or GitHub clone), list, get details, delete, list runs.
// ABOUTME: Validates ZIP bundles (base64, magic bytes, zip bomb), extracts OpenAPI on creation, and clones GitHub repos safely.
/**
 * Project routes - Create and manage projects
 */

import { Hono } from 'hono';
import { createHash } from 'crypto';
import { spawn } from 'child_process';
import { mkdtemp, rm, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import type {
  CreateProjectRequest,
  CreateProjectResponse,
  ListProjectsResponse,
  GetProjectResponse
} from '@runtime-ai/shared';
import { extractOpenAPIFromZip } from '../lib/openapi/zip-extractor.js';
import {
  validateProjectName,
  validateBase64,
  validateZipMagicBytes,
  validateZipDataSize,
  validateZipDecompressionSafe,
} from '../lib/validation-utils.js';
import { getAuthContext, getAuthUser } from '../middleware/auth.js';
import * as projectsStore from '../db/projects-store.js';
import * as runsStore from '../db/runs-store.js';
import { incrementProjectsCount, getUserTier } from '../db/billing-store.js';
import { getTierLimits } from '../config/tiers.js';
import { logger } from '../lib/logger.js';

// Validation patterns for GitHub inputs (prevent command injection)
const GITHUB_URL_PATTERN = /^https:\/\/github\.com\/[\w\-\.]+\/[\w\-\.]+(?:\.git)?$/;
const GIT_REF_PATTERN = /^[\w\-\.\/]+$/;

/**
 * Run a command safely using spawn (prevents shell injection)
 */
function runCommand(cmd: string, args: string[], options: { cwd?: string; timeout?: number }): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, {
      cwd: options.cwd,
      timeout: options.timeout,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(stderr || stdout || `Command failed with code ${code}`));
      }
    });

    proc.on('error', reject);
  });
}

/**
 * Clone a GitHub repo and return as base64 ZIP
 * Uses spawn with array arguments to prevent command injection
 */
async function cloneGitHubRepo(github_url: string, github_ref?: string): Promise<string> {
  // Validate GitHub URL format (prevent command injection)
  if (!GITHUB_URL_PATTERN.test(github_url)) {
    throw new Error('Invalid GitHub URL format. Must be https://github.com/owner/repo');
  }

  // Validate git ref format if provided
  if (github_ref && !GIT_REF_PATTERN.test(github_ref)) {
    throw new Error('Invalid git ref format. Only alphanumeric, dash, dot, and slash allowed');
  }

  // Create temp directory
  const tempDir = await mkdtemp(join(tmpdir(), 'github-clone-'));
  const repoDir = join(tempDir, 'repo');

  try {
    // Build git clone arguments as array (safe from injection)
    const cloneArgs = ['clone', '--depth', '1'];
    if (github_ref) {
      cloneArgs.push('--branch', github_ref);
    }
    cloneArgs.push(github_url, repoDir);

    console.log(`📥 Cloning ${github_url}${github_ref ? ` (${github_ref})` : ''}...`);
    await runCommand('git', cloneArgs, { timeout: 60000 });

    // Remove .git directory to reduce size
    const gitDir = join(repoDir, '.git');
    await rm(gitDir, { recursive: true, force: true });

    // Enforce repo size limit after clone (prevents multi-GB repos from exhausting disk/memory)
    const MAX_REPO_SIZE_MB = 50;
    const duOutput = await runCommand('du', ['-sm', repoDir], { timeout: 10000 });
    const repoSizeMB = parseInt(duOutput.split('\t')[0], 10);
    if (repoSizeMB > MAX_REPO_SIZE_MB) {
      throw new Error(`Repository is ${repoSizeMB}MB, exceeding the ${MAX_REPO_SIZE_MB}MB limit`);
    }

    // Create ZIP of the repo using spawn (safe)
    const zipPath = join(tempDir, 'repo.zip');
    await runCommand('zip', ['-r', zipPath, '.'], { cwd: repoDir, timeout: 30000 });

    // Read ZIP as base64
    const zipBuffer = await readFile(zipPath);
    const base64 = zipBuffer.toString('base64');

    console.log(`✅ Cloned and zipped ${github_url} (${Math.round(base64.length / 1024)}KB)`);
    return base64;
  } finally {
    // Cleanup temp directory
    await rm(tempDir, { recursive: true, force: true }).catch((err) => {
      logger.warn('Failed to clean up temp directory', { tempDir, error: String(err) });
    });
  }
}

const projects = new Hono();

/**
 * POST /projects - Create a new project
 */
projects.post('/', async (c) => {
  const body = await c.req.json() as CreateProjectRequest;

  // Require authenticated user
  const authContext = getAuthContext(c);
  if (!authContext.isAuthenticated || !authContext.user) {
    return c.json({ error: 'Authentication required' }, 401);
  }
  const owner_id = authContext.user.id;

  // Validate required fields
  if (!body.name || !body.source_type) {
    return c.json({ error: 'Missing required fields: name, source_type' }, 400);
  }

  // Validate source_type enum
  if (!['zip', 'github'].includes(body.source_type)) {
    return c.json({
      error: 'Invalid source_type. Must be "zip" or "github"',
      received: body.source_type
    }, 400);
  }

  // Validate project name (length and format)
  const nameValidation = validateProjectName(body.name);
  if (!nameValidation.valid) {
    return c.json({ error: nameValidation.error }, 400);
  }

  // Get tier limits for atomic project creation
  let maxProjects = 5; // default
  try {
    const tier = await getUserTier(owner_id);
    const limits = getTierLimits(tier);
    maxProjects = limits.maxProjects;
  } catch (err) {
    logger.warn('Failed to check tier limits, using default', { error: String(err) });
  }

  // Validate ZIP-specific requirements
  if (body.source_type === 'zip') {
    if (!body.zip_data) {
      return c.json({ error: 'zip_data required for ZIP uploads' }, 400);
    }

    // Validate base64 format
    const base64Validation = validateBase64(body.zip_data);
    if (!base64Validation.valid) {
      return c.json({ error: base64Validation.error }, 400);
    }

    // Validate ZIP size
    const sizeValidation = validateZipDataSize(body.zip_data);
    if (!sizeValidation.valid) {
      return c.json({ error: sizeValidation.error }, 400);
    }

    // Validate ZIP magic bytes
    const zipValidation = validateZipMagicBytes(body.zip_data);
    if (!zipValidation.valid) {
      return c.json({ error: zipValidation.error }, 400);
    }

    // Validate ZIP decompression is safe (zip bomb protection)
    const decompressionValidation = validateZipDecompressionSafe(body.zip_data);
    if (!decompressionValidation.valid) {
      return c.json({ error: decompressionValidation.error }, 400);
    }
  }

  // Validate GitHub-specific requirements
  if (body.source_type === 'github' && !body.github_url) {
    return c.json({ error: 'github_url required for GitHub imports' }, 400);
  }

  // Get code bundle - either from ZIP upload or GitHub clone
  let code_bundle: string;

  if (body.source_type === 'github' && body.github_url) {
    try {
      code_bundle = await cloneGitHubRepo(body.github_url, body.github_ref);
    } catch (error) {
      console.error('❌ GitHub clone failed:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return c.json({ error: `Failed to clone GitHub repository: ${message}` }, 400);
    }
  } else {
    code_bundle = body.zip_data || '';
  }
  const version_hash = createHash('sha256').update(code_bundle).digest('hex').substring(0, 12);

  // Atomically create project with limit check (prevents TOCTOU race)
  const project = await projectsStore.createProjectAtomic({
    owner_id,
    name: body.name,
  }, maxProjects);

  if (!project) {
    return c.json({
      error: `Project limit reached (${maxProjects} max). Upgrade to create more projects.`,
    }, 403);
  }

  // Extract OpenAPI spec
  let openapi: Record<string, unknown> | null = null;
  let endpoints: projectsStore.Endpoint[] = [];
  let entrypoint: string | null = null;
  let detected_env_vars: string[] = [];

  if (code_bundle) {
    try {
      const extracted = await extractOpenAPIFromZip(code_bundle);
      openapi = extracted.openapi;
      endpoints = extracted.endpoints;
      entrypoint = extracted.entrypoint;
      detected_env_vars = extracted.detected_env_vars || [];
      console.log(`✅ Extracted ${endpoints.length} endpoints from ${project.name} (entrypoint: ${entrypoint}, env vars: ${detected_env_vars.join(', ') || 'none'})`);
    } catch (error) {
      console.warn('⚠️  OpenAPI extraction failed (non-fatal):', error);
    }
  }

  // Create version in database — clean up project if this fails
  let version;
  try {
    version = await projectsStore.createVersion({
      project_id: project.id,
      version_hash,
      // TODO(v2): Move code bundles to blob storage (S3/R2) instead of Postgres.
      // Acceptable for launch: free tier only, 10MB max enforced by validateZipDataSize.
      code_bundle_ref: code_bundle,
      openapi,
      endpoints: endpoints as projectsStore.Endpoint[],
      entrypoint,
      detected_env_vars,
      status: 'ready',
    });
  } catch (err) {
    // Delete orphaned project to free the project limit slot
    await projectsStore.deleteProject(project.id).catch(() => {});
    throw err;
  }

  const response: CreateProjectResponse & {
    detected_env_vars: string[];
    endpoints: Array<{ id: string; method: string; path: string; summary?: string }>;
  } = {
    project_id: project.id,
    project_slug: project.slug,
    version_id: version.id,
    version_hash: version.version_hash,
    status: 'draft',
    detected_env_vars,
    endpoints: endpoints.map((ep) => ({
      id: ep.id,
      method: ep.method,
      path: ep.path,
      summary: ep.summary,
    })),
  };

  // Track project creation in billing usage
  incrementProjectsCount(owner_id).catch((err) => {
    logger.warn('Failed to increment projects count', { error: String(err) });
  });

  return c.json(response, 201);
});

/**
 * PATCH /projects/:id - Update a project
 */
projects.patch('/:id', async (c) => {
  const project_id = c.req.param('id');

  const authContext = getAuthContext(c);
  if (!authContext.isAuthenticated || !authContext.user) {
    return c.json({ error: 'Authentication required' }, 401);
  }
  const userId = authContext.user.id;

  const project = await projectsStore.getProject(project_id);
  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }
  if (project.owner_id !== userId) {
    return c.json({ error: 'Not authorized' }, 403);
  }

  const body = await c.req.json();
  const updates: Partial<{ name: string; slug: string }> = {};

  if (body.name) {
    const nameValidation = validateProjectName(body.name);
    if (!nameValidation.valid) {
      return c.json({ error: nameValidation.error }, 400);
    }
    updates.name = body.name;
  }
  if (body.slug) {
    // Validate slug format: lowercase alphanumeric + hyphens, 3-60 chars
    if (!/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(body.slug)) {
      return c.json({ error: 'Invalid slug. Use lowercase letters, numbers, and hyphens (3-60 chars).' }, 400);
    }
    // Check uniqueness
    const existing = await projectsStore.getProjectBySlug(body.slug);
    if (existing && existing.id !== project_id) {
      return c.json({ error: 'Slug already in use' }, 409);
    }
    updates.slug = body.slug;
  }

  if (Object.keys(updates).length === 0) {
    return c.json({ error: 'No valid fields to update' }, 400);
  }

  let updated;
  try {
    updated = await projectsStore.updateProject(project_id, updates);
  } catch (err) {
    // Catch DB unique constraint violation on slug (TOCTOU race fallback)
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('unique') || msg.includes('duplicate') || msg.includes('idx_projects_slug_unique')) {
      return c.json({ error: 'Slug already in use' }, 409);
    }
    throw err;
  }
  if (!updated) {
    return c.json({ error: 'Failed to update project' }, 500);
  }

  return c.json({
    project_id: updated.id,
    project_slug: updated.slug,
    name: updated.name,
    owner_id: updated.owner_id,
    status: updated.status,
    created_at: updated.created_at,
    updated_at: updated.updated_at,
  });
});

/**
 * GET /projects - List all projects
 */
projects.get('/', async (c) => {
  // Require authenticated user (anonymous fallback only in dev mode)
  const authContext = getAuthContext(c);
  if (!authContext.isAuthenticated || !authContext.user) {
    return c.json({ error: 'Authentication required' }, 401);
  }
  const owner_id = authContext.user.id;

  // List projects for this user
  const userProjects = await projectsStore.listProjects(owner_id);

  // Get latest version for each project
  const projects_array = await Promise.all(
    userProjects.map(async (p) => {
      const latestVersion = await projectsStore.getLatestVersion(p.id);
      return {
        project_id: p.id,
        project_slug: p.slug,
        name: p.name,
        status: p.status,
        latest_version: latestVersion?.version_hash || '',
        created_at: p.created_at,
        updated_at: p.updated_at,
      };
    })
  );

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

  // Auth check BEFORE DB access (prevents project existence leak via 404 vs 401)
  const authContext = getAuthContext(c);
  if (!authContext.isAuthenticated || !authContext.user) {
    return c.json({ error: 'Authentication required' }, 401);
  }
  const userId = authContext.user.id;

  const project = await projectsStore.getProject(project_id);
  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }
  if (project.owner_id !== userId) {
    return c.json({ error: 'Not authorized' }, 403);
  }

  // Get versions
  const versions = await projectsStore.listVersions(project_id);

  // Get latest version for detected_env_vars
  const latestVersion = versions[0];

  const response: GetProjectResponse & {
    status: string;
    deployed_at: string | null;
    deploy_error: string | null;
    runtime_url: string | null;
    detected_env_vars: string[];
    endpoints: Array<{ id: string; method: string; path: string; summary?: string }>;
  } = {
    project_id: project.id,
    project_slug: project.slug,
    name: project.name,
    owner_id: project.owner_id,
    status: project.status,
    deployed_at: project.deployed_at,
    deploy_error: project.deploy_error,
    runtime_url: project.runtime_url,
    detected_env_vars: latestVersion?.detected_env_vars || [],
    endpoints: latestVersion?.endpoints || [],
    versions: versions.map(v => ({
      version_id: v.id,
      version_hash: v.version_hash,
      created_at: v.created_at,
      status: v.status as 'building' | 'ready' | 'failed',
    })),
    created_at: project.created_at,
    updated_at: project.updated_at,
  };

  return c.json(response);
});

/**
 * Helper to get project from store
 */
export async function getProject(project_id: string) {
  const project = await projectsStore.getProject(project_id);
  if (!project) return null;

  const versions = await projectsStore.listVersions(project_id);
  return {
    ...project,
    project_id: project.id,
    project_slug: project.slug,
    versions: versions.map(v => ({
      version_id: v.id,
      version_hash: v.version_hash,
      code_bundle: v.code_bundle_ref,
      created_at: v.created_at,
      status: v.status,
      openapi: v.openapi,
      endpoints: v.endpoints,
      entrypoint: v.entrypoint,
    })),
  };
}

/**
 * Helper to update project version with OpenAPI
 */
export async function updateVersionOpenAPI(
  project_id: string,
  version_id: string,
  openapi: Record<string, unknown> | null,
  endpoints: projectsStore.Endpoint[]
) {
  const result = await projectsStore.updateVersion(version_id, {
    openapi,
    endpoints,
  });
  return !!result;
}

/**
 * GET /projects/:id/endpoints - Get endpoints for a project version
 */
projects.get('/:id/endpoints', async (c) => {
  const project_id = c.req.param('id');
  const version_id = c.req.query('version_id');

  // Auth check BEFORE DB access
  const authContext = getAuthContext(c);
  if (!authContext.isAuthenticated || !authContext.user) {
    return c.json({ error: 'Authentication required' }, 401);
  }
  const userId = authContext.user.id;

  const project = await projectsStore.getProject(project_id);
  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }
  if (project.owner_id !== userId) {
    return c.json({ error: 'Not authorized' }, 403);
  }

  // Get specific version or latest
  let version: projectsStore.ProjectVersion | null;
  if (version_id) {
    version = await projectsStore.getVersion(version_id);
    // Verify version belongs to this project (prevents cross-project data leak)
    if (version && version.project_id !== project_id) {
      return c.json({ error: 'Version not found' }, 404);
    }
  } else {
    version = await projectsStore.getLatestVersion(project_id);
  }

  if (!version) {
    return c.json({ error: 'Version not found' }, 404);
  }

  if (!version.endpoints || version.endpoints.length === 0) {
    return c.json({ error: 'No actions detected yet for this version' }, 400);
  }

  // Map id to endpoint_id for frontend compatibility
  const mappedEndpoints = version.endpoints.map(ep => ({
    endpoint_id: ep.id,
    method: ep.method,
    path: ep.path,
    summary: ep.summary,
    description: ep.description,
  }));

  return c.json({
    endpoints: mappedEndpoints,
    total: mappedEndpoints.length,
  });
});

/**
 * DELETE /projects/:id - Delete a project and all its data
 */
projects.delete('/:id', async (c) => {
  const project_id = c.req.param('id');

  // Require authenticated user
  const authContext = getAuthContext(c);
  if (!authContext.isAuthenticated || !authContext.user) {
    return c.json({ error: 'Authentication required' }, 401);
  }
  const userId = authContext.user.id;

  // Get project
  const project = await projectsStore.getProject(project_id);
  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  // Verify ownership
  if (project.owner_id !== userId) {
    return c.json({ error: 'Not authorized' }, 403);
  }

  // Delete project (cascades to versions, secrets, contexts, share links via DB)
  await projectsStore.deleteProject(project_id);

  return c.json({ success: true, project_id });
});

/**
 * GET /projects/:id/runs - List runs for a project
 */
projects.get('/:id/runs', async (c) => {
  const project_id = c.req.param('id');

  // Auth check BEFORE DB access
  const authContext = getAuthContext(c);
  if (!authContext.isAuthenticated || !authContext.user) {
    return c.json({ error: 'Authentication required' }, 401);
  }
  const userId = authContext.user.id;

  const project = await projectsStore.getProject(project_id);
  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }
  if (project.owner_id !== userId) {
    return c.json({ error: 'Not authorized' }, 403);
  }

  // Clamp limit to prevent unbounded DB queries (#8, #10)
  const rawLimit = parseInt(c.req.query('limit') || '20');
  const limit = isNaN(rawLimit) ? 20 : Math.max(1, Math.min(rawLimit, 100));

  const runs = await runsStore.listProjectRuns(project_id, { limit });

  return c.json({
    runs: runs.map(run => ({
      run_id: run.id,
      endpoint_id: run.endpoint_id,
      status: run.status,
      created_at: run.created_at,
      duration_ms: run.duration_ms,
    })),
    total: runs.length,
  });
});

export default projects;
