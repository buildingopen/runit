// ABOUTME: Routes for version management: list versions, promote dev to prod, rollback to previous version.
// ABOUTME: Mounted at /projects/:id/versions, /projects/:id/promote, /projects/:id/rollback.

import { Hono } from 'hono';
import { getAuthContext } from '../middleware/auth.js';
import * as projectsStore from '../db/projects-store.js';
import { logger } from '../lib/logger.js';

const versions = new Hono();

/**
 * GET /projects/:id/versions - List all versions for a project
 */
versions.get('/:id/versions', async (c) => {
  const project_id = c.req.param('id');

  const authContext = getAuthContext(c);
  if (!authContext.isAuthenticated || !authContext.user) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const project = await projectsStore.getProject(project_id);
  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }
  if (project.owner_id !== authContext.user.id) {
    return c.json({ error: 'Not authorized' }, 403);
  }

  const versionList = await projectsStore.listVersions(project_id);

  return c.json({
    versions: versionList.map(v => ({
      version_id: v.id,
      version_hash: v.version_hash,
      created_at: v.created_at,
      status: v.status,
      is_dev: v.id === project.dev_version_id,
      is_prod: v.id === project.prod_version_id,
      endpoints: (v.endpoints || []).map(ep => ({
        id: ep.id,
        method: ep.method,
        path: ep.path,
        summary: ep.summary,
      })),
    })),
    total: versionList.length,
    dev_version_id: project.dev_version_id,
    prod_version_id: project.prod_version_id,
  });
});

/**
 * POST /projects/:id/promote - Promote dev version (or specified version) to prod
 */
versions.post('/:id/promote', async (c) => {
  const project_id = c.req.param('id');

  const authContext = getAuthContext(c);
  if (!authContext.isAuthenticated || !authContext.user) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const project = await projectsStore.getProject(project_id);
  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }
  if (project.owner_id !== authContext.user.id) {
    return c.json({ error: 'Not authorized' }, 403);
  }

  let body: { version_id?: string } = {};
  try {
    body = await c.req.json();
  } catch {
    // No body is fine, defaults to dev version
  }

  const versionId = body.version_id || project.dev_version_id;
  if (!versionId) {
    return c.json({ error: 'No version to promote. Deploy first.' }, 400);
  }

  // Verify version exists and belongs to this project
  const version = await projectsStore.getVersion(versionId);
  if (!version || version.project_id !== project_id) {
    return c.json({ error: 'Version not found' }, 404);
  }

  const previousProdVersionId = project.prod_version_id;

  // Health check: verify version has endpoints and status is 'ready'
  if (version.status !== 'ready') {
    return c.json({
      promoted: false,
      rolled_back: !!previousProdVersionId,
      reason: `Version status is '${version.status}', expected 'ready'`,
      version_id: previousProdVersionId || versionId,
    });
  }

  if (!version.endpoints || version.endpoints.length === 0) {
    return c.json({
      promoted: false,
      rolled_back: !!previousProdVersionId,
      reason: 'Version has no endpoints',
      version_id: previousProdVersionId || versionId,
    });
  }

  // Promote: set prod version
  await projectsStore.setProdVersion(project_id, versionId);

  return c.json({
    promoted: true,
    version_id: versionId,
    version_hash: version.version_hash,
    previous_version_id: previousProdVersionId,
  });
});

/**
 * POST /projects/:id/rollback - Rollback prod to a specific version
 */
versions.post('/:id/rollback', async (c) => {
  const project_id = c.req.param('id');

  const authContext = getAuthContext(c);
  if (!authContext.isAuthenticated || !authContext.user) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const project = await projectsStore.getProject(project_id);
  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }
  if (project.owner_id !== authContext.user.id) {
    return c.json({ error: 'Not authorized' }, 403);
  }

  let body: { version_id: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.version_id) {
    return c.json({ error: 'Missing required field: version_id' }, 400);
  }

  // Verify version exists and belongs to this project
  const version = await projectsStore.getVersion(body.version_id);
  if (!version || version.project_id !== project_id) {
    return c.json({ error: 'Version not found' }, 404);
  }

  const previousProdVersionId = project.prod_version_id;

  // Set prod version
  await projectsStore.setProdVersion(project_id, body.version_id);

  return c.json({
    rolled_back: true,
    version_id: body.version_id,
    version_hash: version.version_hash,
    previous_version_id: previousProdVersionId,
  });
});

export default versions;
