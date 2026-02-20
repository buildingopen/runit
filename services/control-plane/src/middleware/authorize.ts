// ABOUTME: Authorization middleware checking project/run ownership via Supabase queries and share link access.
// ABOUTME: Provides middleware factories (requireProjectOwnership, requireRunOwnership, requireShareLinkOrOwnership).
/**
 * Authorization Middleware
 *
 * Checks resource ownership and access permissions
 */

import type { Context, Next } from 'hono';
import { getAuthContext, getAuthUser } from './auth.js';
import { getServiceSupabaseClient, isSupabaseConfigured } from '../db/supabase.js';

/**
 * Check if the current user owns a project
 */
export async function checkProjectOwnership(
  c: Context,
  projectId: string
): Promise<{ isOwner: boolean; ownerId: string | null }> {
  // If Supabase is not configured, allow all in dev mode
  if (!isSupabaseConfigured()) {
    if (process.env.NODE_ENV === 'development' || process.env.DEV_MODE === 'true') {
      return { isOwner: true, ownerId: 'dev-user-00000000-0000-0000-0000-000000000000' };
    }
    return { isOwner: false, ownerId: null };
  }

  const authContext = getAuthContext(c);
  if (!authContext.isAuthenticated || !authContext.user) {
    return { isOwner: false, ownerId: null };
  }

  const supabase = getServiceSupabaseClient();
  const { data: project, error } = await supabase
    .from('projects')
    .select('owner_id')
    .eq('id', projectId)
    .single();

  if (error || !project) {
    return { isOwner: false, ownerId: null };
  }

  return {
    isOwner: project.owner_id === authContext.user.id,
    ownerId: project.owner_id,
  };
}

/**
 * Check if the current user owns a run
 */
export async function checkRunOwnership(
  c: Context,
  runId: string
): Promise<{ isOwner: boolean; ownerId: string | null }> {
  if (!isSupabaseConfigured()) {
    if (process.env.NODE_ENV === 'development' || process.env.DEV_MODE === 'true') {
      return { isOwner: true, ownerId: 'dev-user-00000000-0000-0000-0000-000000000000' };
    }
    return { isOwner: false, ownerId: null };
  }

  const authContext = getAuthContext(c);
  if (!authContext.isAuthenticated || !authContext.user) {
    return { isOwner: false, ownerId: null };
  }

  const supabase = getServiceSupabaseClient();
  const { data: run, error } = await supabase
    .from('runs')
    .select('owner_id')
    .eq('id', runId)
    .single();

  if (error || !run) {
    return { isOwner: false, ownerId: null };
  }

  return {
    isOwner: run.owner_id === authContext.user.id,
    ownerId: run.owner_id,
  };
}

/**
 * Middleware factory for requiring project ownership
 */
export function requireProjectOwnership(paramName: string = 'id') {
  return async (c: Context, next: Next) => {
    const projectId = c.req.param(paramName);
    if (!projectId) {
      return c.json({ error: 'Project ID is required' }, 400);
    }

    const { isOwner, ownerId } = await checkProjectOwnership(c, projectId);

    if (!ownerId) {
      return c.json({ error: 'Project not found' }, 404);
    }

    if (!isOwner) {
      return c.json(
        {
          error: 'Forbidden',
          message: 'You do not have permission to access this project',
        },
        403
      );
    }

    return next();
  };
}

/**
 * Middleware factory for requiring run ownership
 */
export function requireRunOwnership(paramName: string = 'id') {
  return async (c: Context, next: Next) => {
    const runId = c.req.param(paramName);
    if (!runId) {
      return c.json({ error: 'Run ID is required' }, 400);
    }

    const { isOwner, ownerId } = await checkRunOwnership(c, runId);

    if (!ownerId) {
      return c.json({ error: 'Run not found' }, 404);
    }

    if (!isOwner) {
      return c.json(
        {
          error: 'Forbidden',
          message: 'You do not have permission to access this run',
        },
        403
      );
    }

    return next();
  };
}

/**
 * Check if access is allowed via share link
 */
export async function checkShareLinkAccess(
  shareId: string
): Promise<{
  allowed: boolean;
  shareLink: {
    id: string;
    project_id: string;
    target_type: string;
    target_ref: string;
    enabled: boolean;
  } | null;
}> {
  if (!isSupabaseConfigured()) {
    return { allowed: false, shareLink: null };
  }

  const supabase = getServiceSupabaseClient();
  const { data: shareLink, error } = await supabase
    .from('share_links')
    .select('id, project_id, target_type, target_ref, enabled')
    .eq('id', shareId)
    .single();

  if (error || !shareLink) {
    return { allowed: false, shareLink: null };
  }

  if (!shareLink.enabled) {
    return { allowed: false, shareLink };
  }

  return { allowed: true, shareLink };
}

/**
 * Middleware factory for requiring share link access OR project ownership
 */
export function requireShareLinkOrOwnership(projectIdParam: string = 'id') {
  return async (c: Context, next: Next) => {
    // Check for share link access first
    const shareId = c.req.param('share_id') || c.req.query('share_id');
    if (shareId) {
      const { allowed, shareLink } = await checkShareLinkAccess(shareId as string);
      if (allowed && shareLink) {
        // Attach share link info to context for downstream use
        c.set('shareLink', shareLink);
        return next();
      }
    }

    // Fall back to project ownership check
    const projectId = c.req.param(projectIdParam);
    if (!projectId) {
      return c.json({ error: 'Project ID or share link is required' }, 400);
    }

    const authContext = getAuthContext(c);
    if (!authContext.isAuthenticated) {
      return c.json(
        {
          error: 'Authentication required',
          message: 'Please provide a valid Bearer token or use a share link',
        },
        401
      );
    }

    const { isOwner, ownerId } = await checkProjectOwnership(c, projectId);

    if (!ownerId) {
      return c.json({ error: 'Project not found' }, 404);
    }

    if (!isOwner) {
      return c.json(
        {
          error: 'Forbidden',
          message: 'You do not have permission to access this project',
        },
        403
      );
    }

    return next();
  };
}
