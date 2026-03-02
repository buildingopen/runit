/**
 * ABOUTME: Context CRUD routes for managing project context
 * ABOUTME: Handles fetching, listing, refreshing, and deleting context data
 */

import { Hono } from 'hono';
import { fetchContextFromURL } from '../lib/context/fetcher';
import type { FetchContextRequest } from '@runtime-ai/shared';
import { CONTEXT_MAX_SIZE_BYTES, PROJECT_CONTEXT_MAX_TOTAL_BYTES } from '../config/constants';
import * as contextsStore from '../db/contexts-store.js';
import * as projectsStore from '../db/projects-store.js';
import { getAuthContext } from '../middleware/auth.js';

const context = new Hono();

/**
 * Verify project ownership. Returns project or null (and sets response).
 */
async function verifyOwnership(c: any, projectId: string) {
  const authContext = getAuthContext(c);
  if (!authContext.isAuthenticated || !authContext.user) {
    return { error: c.json({ error: 'Authentication required' }, 401) };
  }
  const project = await projectsStore.getProject(projectId);
  if (!project) {
    return { error: c.json({ error: 'Project not found' }, 404) };
  }
  if (project.owner_id !== authContext.user.id) {
    return { error: c.json({ error: 'Not authorized' }, 403) };
  }
  return { project };
}

/**
 * POST /projects/:id/context
 * Fetch context from URL
 */
context.post('/:id/context', async (c) => {
  const projectId = c.req.param('id');

  const ownership = await verifyOwnership(c, projectId);
  if ('error' in ownership && ownership.error) return ownership.error;

  const body = await c.req.json<FetchContextRequest>();

  if (!body.url || !body.name) {
    return c.json({ error: 'Missing required fields: url, name' }, 400);
  }

  // Validate name format
  if (!/^[a-zA-Z0-9_-]+$/.test(body.name)) {
    return c.json(
      {
        error: 'Invalid context name. Use only letters, numbers, hyphens, and underscores.',
      },
      400
    );
  }

  try {
    // Fetch context from URL
    const fetchedContext = await fetchContextFromURL(body.url, body.name);

    // Check size limit
    const dataSize = Buffer.byteLength(JSON.stringify(fetchedContext.data), 'utf-8');
    if (dataSize > CONTEXT_MAX_SIZE_BYTES) {
      return c.json({ error: `Context data exceeds ${CONTEXT_MAX_SIZE_BYTES / (1024 * 1024)}MB limit` }, 400);
    }

    // Create context in database (size limits checked in store)
    const contextRecord = await contextsStore.createContext({
      project_id: projectId,
      name: body.name,
      url: body.url,
      data: fetchedContext.data as Record<string, unknown>,
      size_bytes: dataSize,
    });

    return c.json(
      {
        id: contextRecord.id,
        data: contextRecord.data,
      },
      201
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: `Failed to fetch context: ${message}` }, 400);
  }
});

/**
 * GET /projects/:id/context
 * List all context for a project
 */
context.get('/:id/context', async (c) => {
  const projectId = c.req.param('id');

  const ownership = await verifyOwnership(c, projectId);
  if ('error' in ownership && ownership.error) return ownership.error;

  const contexts = await contextsStore.listProjectContexts(projectId);

  return c.json({
    contexts: contexts.map((ctx) => ({
      id: ctx.id,
      name: ctx.name,
      url: ctx.url,
      created_at: ctx.created_at,
      updated_at: ctx.updated_at,
      fetched_at: ctx.fetched_at,
      size: ctx.size_bytes,
    })),
  });
});

/**
 * GET /projects/:id/context/:cid
 * Get specific context data
 */
context.get('/:id/context/:cid', async (c) => {
  const projectId = c.req.param('id');
  const contextId = c.req.param('cid');

  const ownership = await verifyOwnership(c, projectId);
  if ('error' in ownership && ownership.error) return ownership.error;

  const ctx = await contextsStore.getProjectContext(projectId, contextId);

  if (!ctx) {
    return c.json({ error: 'Context not found' }, 404);
  }

  return c.json({
    id: ctx.id,
    project_id: ctx.project_id,
    name: ctx.name,
    url: ctx.url,
    data: ctx.data,
    created_at: ctx.created_at,
    updated_at: ctx.updated_at,
    fetched_at: ctx.fetched_at,
  });
});

/**
 * PUT /projects/:id/context/:cid
 * Refresh context from URL
 */
context.put('/:id/context/:cid', async (c) => {
  const projectId = c.req.param('id');
  const contextId = c.req.param('cid');

  const ownership = await verifyOwnership(c, projectId);
  if ('error' in ownership && ownership.error) return ownership.error;

  const existingContext = await contextsStore.getProjectContext(projectId, contextId);

  if (!existingContext) {
    return c.json({ error: 'Context not found' }, 404);
  }

  if (!existingContext.url) {
    return c.json(
      { error: 'Cannot refresh context without URL' },
      400
    );
  }

  try {
    // Re-fetch from URL
    const fetchedContext = await fetchContextFromURL(
      existingContext.url,
      existingContext.name || 'context'
    );

    // Check size limit
    const dataSize = Buffer.byteLength(JSON.stringify(fetchedContext.data), 'utf-8');
    if (dataSize > CONTEXT_MAX_SIZE_BYTES) {
      return c.json({ error: `Context data exceeds ${CONTEXT_MAX_SIZE_BYTES / (1024 * 1024)}MB limit` }, 400);
    }

    // Update context in database
    const updated = await contextsStore.refreshContext(
      contextId,
      fetchedContext.data as Record<string, unknown>,
      dataSize
    );

    if (!updated) {
      return c.json({ error: 'Failed to update context' }, 500);
    }

    return c.json({
      id: updated.id,
      data: updated.data,
      updated_at: updated.updated_at,
      fetched_at: updated.fetched_at,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: `Failed to refresh context: ${message}` }, 400);
  }
});

/**
 * DELETE /projects/:id/context/:cid
 * Delete context
 */
context.delete('/:id/context/:cid', async (c) => {
  const projectId = c.req.param('id');
  const contextId = c.req.param('cid');

  const ownership = await verifyOwnership(c, projectId);
  if ('error' in ownership && ownership.error) return ownership.error;

  const deleted = await contextsStore.deleteProjectContext(projectId, contextId);

  if (!deleted) {
    return c.json({ error: 'Context not found' }, 404);
  }

  return c.json({ success: true }, 200);
});

/**
 * Helper function to get all contexts for a project (for runner)
 */
export async function getProjectContexts(projectId: string): Promise<Record<string, unknown>> {
  const contexts = await contextsStore.listProjectContexts(projectId);

  const result: Record<string, unknown> = {};
  for (const ctx of contexts) {
    if (ctx.name) {
      result[ctx.name] = ctx.data;
    }
  }

  return result;
}

export default context;
