/**
 * Share routes - Create and manage share links
 */

import { Hono } from 'hono';
import { getProject } from './projects.js';
import { getAuthContext } from '../middleware/auth.js';
import * as shareLinksStore from '../db/share-links-store.js';
import * as projectsStore from '../db/projects-store.js';

// Project-scoped share routes (mounted at /projects)
const projectShare = new Hono();

// Global share link routes (mounted at /share)
const shareLinks = new Hono();

/**
 * POST /projects/:id/share - Create share link
 */
projectShare.post('/:id/share', async (c) => {
  const project_id = c.req.param('id');
  const body = await c.req.json() as {
    target_type: 'endpoint_template' | 'run_result';
    target_ref: string;
  };

  // Get authenticated user
  const authContext = getAuthContext(c);
  const created_by = authContext.user?.id || 'anonymous';

  // Validate project exists
  const project = await projectsStore.getProject(project_id);
  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  // Validate request
  if (!body.target_type || !body.target_ref) {
    return c.json({ error: 'Missing required fields: target_type, target_ref' }, 400);
  }

  if (!['endpoint_template', 'run_result'].includes(body.target_type)) {
    return c.json({ error: 'Invalid target_type. Must be: endpoint_template or run_result' }, 400);
  }

  // Create share link in database
  const shareLink = await shareLinksStore.createShareLink({
    project_id,
    target_type: body.target_type,
    target_ref: body.target_ref,
    created_by,
  });

  return c.json({
    share_id: shareLink.id,
    share_url: `/s/${shareLink.id}`,
    target_type: shareLink.target_type,
    target_ref: shareLink.target_ref,
    created_at: shareLink.created_at,
  }, 201);
});

/**
 * GET /share/:share_id - Get share link data
 */
shareLinks.get('/:share_id', async (c) => {
  const share_id = c.req.param('share_id');
  const shareLink = await shareLinksStore.getEnabledShareLink(share_id);

  if (!shareLink) {
    // Check if it exists but is disabled
    const disabledLink = await shareLinksStore.getShareLink(share_id);
    if (disabledLink && !disabledLink.enabled) {
      return c.json({ error: 'This share link has been disabled by the owner' }, 403);
    }
    return c.json({ error: 'Share link not found' }, 404);
  }

  // Get project data
  const project = await projectsStore.getProject(shareLink.project_id);
  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  return c.json({
    share_id: shareLink.id,
    project: {
      project_id: project.id,
      name: project.name,
    },
    target_type: shareLink.target_type,
    target_ref: shareLink.target_ref,
    stats: {
      run_count: shareLink.run_count,
      success_count: shareLink.success_count,
      last_run_at: shareLink.last_run_at,
    },
  });
});

/**
 * DELETE /projects/:id/share/:share_id - Disable share link
 */
projectShare.delete('/:id/share/:share_id', async (c) => {
  const project_id = c.req.param('id');
  const share_id = c.req.param('share_id');
  const shareLink = await shareLinksStore.getShareLink(share_id);

  if (!shareLink) {
    return c.json({ error: 'Share link not found' }, 404);
  }

  if (shareLink.project_id !== project_id) {
    return c.json({ error: 'Share link does not belong to this project' }, 403);
  }

  // Disable the share link
  await shareLinksStore.disableShareLink(share_id);

  return c.json({
    share_id,
    status: 'disabled',
  });
});

/**
 * GET /projects/:id/shares - List share links for a project (owner-only)
 */
projectShare.get('/:id/shares', async (c) => {
  const project_id = c.req.param('id');

  // Get project
  const project = await projectsStore.getProject(project_id);
  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  // Find all share links for this project
  const links = await shareLinksStore.listProjectShareLinks(project_id);

  return c.json({
    shares: links.map(link => ({
      share_id: link.id,
      share_url: `/s/${link.id}`,
      target_type: link.target_type,
      target_ref: link.target_ref,
      enabled: link.enabled,
      created_at: link.created_at,
      stats: {
        run_count: link.run_count,
        success_count: link.success_count,
        last_run_at: link.last_run_at,
      },
    })),
    total: links.length,
  });
});

/**
 * Helper to increment share link stats
 */
export async function incrementShareLinkStats(share_id: string, success: boolean) {
  await shareLinksStore.incrementShareLinkStats(share_id, success);
}

/**
 * Helper to get share link
 */
export async function getShareLink(share_id: string) {
  return shareLinksStore.getShareLink(share_id);
}

export { projectShare, shareLinks };
export default projectShare;
