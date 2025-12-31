/**
 * Share routes - Create and manage share links
 */

import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import { getProject } from './projects.js';

// Project-scoped share routes (mounted at /projects)
const projectShare = new Hono();

// Global share link routes (mounted at /share)
const shareLinks = new Hono();

// In-memory share links store (replace with database later)
const shareLinksStore = new Map<string, {
  share_id: string;
  project_id: string;
  target_type: 'endpoint_template' | 'run_result';
  target_ref: string;  // endpoint_id or run_id
  enabled: boolean;
  created_by: string;
  created_at: string;
  run_count: number;
  success_count: number;
  last_run_at?: string;
}>();

/**
 * POST /projects/:id/share - Create share link
 */
projectShare.post('/:id/share', async (c) => {
  const project_id = c.req.param('id');
  const body = await c.req.json() as {
    target_type: 'endpoint_template' | 'run_result';
    target_ref: string;
  };

  // Validate project exists
  const project = getProject(project_id);
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

  // Create share link
  const share_id = randomUUID();
  const shareLink = {
    share_id,
    project_id,
    target_type: body.target_type,
    target_ref: body.target_ref,
    enabled: true,
    created_by: 'default-user',  // TODO: Get from auth
    created_at: new Date().toISOString(),
    run_count: 0,
    success_count: 0,
  };

  shareLinksStore.set(share_id, shareLink);

  return c.json({
    share_id,
    share_url: `/s/${share_id}`,
    target_type: body.target_type,
    target_ref: body.target_ref,
    created_at: shareLink.created_at,
  }, 201);
});

/**
 * GET /share/:share_id - Get share link data
 */
shareLinks.get('/:share_id', async (c) => {
  const share_id = c.req.param('share_id');
  const shareLink = shareLinksStore.get(share_id);

  if (!shareLink) {
    return c.json({ error: 'Share link not found' }, 404);
  }

  if (!shareLink.enabled) {
    return c.json({ error: 'This share link has been disabled by the owner' }, 403);
  }

  // Get project data
  const project = getProject(shareLink.project_id);
  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  return c.json({
    share_id: shareLink.share_id,
    project: {
      project_id: project.project_id,
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
  const shareLink = shareLinksStore.get(share_id);

  if (!shareLink) {
    return c.json({ error: 'Share link not found' }, 404);
  }

  if (shareLink.project_id !== project_id) {
    return c.json({ error: 'Share link does not belong to this project' }, 403);
  }

  // Disable the share link
  shareLink.enabled = false;

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
  const project = getProject(project_id);
  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  // Find all share links for this project
  const links = Array.from(shareLinksStore.values())
    .filter(link => link.project_id === project_id)
    .map(link => ({
      share_id: link.share_id,
      share_url: `/s/${link.share_id}`,
      target_type: link.target_type,
      target_ref: link.target_ref,
      enabled: link.enabled,
      created_at: link.created_at,
      stats: {
        run_count: link.run_count,
        success_count: link.success_count,
        last_run_at: link.last_run_at,
      },
    }));

  return c.json({
    shares: links,
    total: links.length,
  });
});

/**
 * Helper to increment share link stats
 */
export function incrementShareLinkStats(share_id: string, success: boolean) {
  const shareLink = shareLinksStore.get(share_id);
  if (shareLink) {
    shareLink.run_count++;
    if (success) {
      shareLink.success_count++;
    }
    shareLink.last_run_at = new Date().toISOString();
  }
}

/**
 * Helper to get share link
 */
export function getShareLink(share_id: string) {
  return shareLinksStore.get(share_id);
}

export { projectShare, shareLinks };
export default projectShare;
