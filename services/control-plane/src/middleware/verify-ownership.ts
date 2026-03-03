// ABOUTME: Shared helper to verify project ownership in route handlers.
// ABOUTME: Returns owner user ID on success, or an error Response on failure.

import type { Context } from 'hono';
import { getAuthContext } from './auth.js';
import * as projectsStore from '../db/projects-store.js';

/**
 * Verify the authenticated user owns the given project.
 * Returns the owner's user ID string on success, or an error Response.
 */
export async function verifyProjectOwnership(c: Context, projectId: string): Promise<string | Response> {
  const authContext = getAuthContext(c);
  if (!authContext.isAuthenticated || !authContext.user) {
    return c.json({ error: 'Authentication required' }, 401);
  }
  const project = await projectsStore.getProject(projectId);
  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }
  if (project.owner_id !== authContext.user.id) {
    return c.json({ error: 'Not authorized' }, 403);
  }
  return authContext.user.id;
}
