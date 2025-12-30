/**
 * ABOUTME: Context CRUD routes for managing project context
 * ABOUTME: Handles fetching, listing, refreshing, and deleting context data
 */

import { Hono } from 'hono';
import { fetchContextFromURL, validateContext } from '../context-fetcher';
import type {
  ContextMetadata,
  FetchContextRequest,
  FetchContextResponse,
} from '../../../../packages/shared/src/types';

const context = new Hono();

// In-memory storage for v0 (will be replaced with database)
const contextStore: Map<string, Map<string, ContextMetadata>> = new Map();

/**
 * POST /projects/:id/context
 * Fetch context from URL
 */
context.post('/projects/:id/context', async (c) => {
  const projectId = c.req.param('id');
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

    // Check size limit (1MB)
    const dataSize = JSON.stringify(fetchedContext.data).length;
    if (dataSize > 1024 * 1024) {
      return c.json({ error: 'Context data exceeds 1MB limit' }, 400);
    }

    const now = new Date().toISOString();

    // Store context
    const contextMetadata: ContextMetadata = {
      id: fetchedContext.id,
      project_id: projectId,
      name: body.name,
      url: body.url,
      data: fetchedContext.data,
      created_at: now,
      updated_at: now,
      fetched_at: now,
    };

    if (!contextStore.has(projectId)) {
      contextStore.set(projectId, new Map());
    }

    const projectContexts = contextStore.get(projectId)!;

    // Check total size for project
    let totalSize = dataSize;
    for (const ctx of projectContexts.values()) {
      totalSize += JSON.stringify(ctx.data).length;
    }

    if (totalSize > 1024 * 1024) {
      return c.json(
        { error: 'Total context size for project exceeds 1MB limit' },
        400
      );
    }

    projectContexts.set(contextMetadata.id, contextMetadata);

    return c.json(
      {
        id: contextMetadata.id,
        data: contextMetadata.data,
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
context.get('/projects/:id/context', async (c) => {
  const projectId = c.req.param('id');

  const projectContexts = contextStore.get(projectId);

  if (!projectContexts || projectContexts.size === 0) {
    return c.json({ contexts: [] });
  }

  const contexts = Array.from(projectContexts.values()).map((ctx) => ({
    id: ctx.id,
    name: ctx.name,
    url: ctx.url,
    created_at: ctx.created_at,
    updated_at: ctx.updated_at,
    fetched_at: ctx.fetched_at,
    size: JSON.stringify(ctx.data).length,
  }));

  return c.json({ contexts });
});

/**
 * GET /projects/:id/context/:cid
 * Get specific context data
 */
context.get('/projects/:id/context/:cid', async (c) => {
  const projectId = c.req.param('id');
  const contextId = c.req.param('cid');

  const projectContexts = contextStore.get(projectId);

  if (!projectContexts) {
    return c.json({ error: 'Project not found' }, 404);
  }

  const ctx = projectContexts.get(contextId);

  if (!ctx) {
    return c.json({ error: 'Context not found' }, 404);
  }

  return c.json(ctx);
});

/**
 * PUT /projects/:id/context/:cid
 * Refresh context from URL
 */
context.put('/projects/:id/context/:cid', async (c) => {
  const projectId = c.req.param('id');
  const contextId = c.req.param('cid');

  const projectContexts = contextStore.get(projectId);

  if (!projectContexts) {
    return c.json({ error: 'Project not found' }, 404);
  }

  const existingContext = projectContexts.get(contextId);

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
      existingContext.name
    );

    // Check size limit
    const dataSize = JSON.stringify(fetchedContext.data).length;
    if (dataSize > 1024 * 1024) {
      return c.json({ error: 'Context data exceeds 1MB limit' }, 400);
    }

    const now = new Date().toISOString();

    // Update context
    existingContext.data = fetchedContext.data;
    existingContext.updated_at = now;
    existingContext.fetched_at = now;

    return c.json({
      id: existingContext.id,
      data: existingContext.data,
      updated_at: existingContext.updated_at,
      fetched_at: existingContext.fetched_at,
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
context.delete('/projects/:id/context/:cid', async (c) => {
  const projectId = c.req.param('id');
  const contextId = c.req.param('cid');

  const projectContexts = contextStore.get(projectId);

  if (!projectContexts) {
    return c.json({ error: 'Project not found' }, 404);
  }

  const deleted = projectContexts.delete(contextId);

  if (!deleted) {
    return c.json({ error: 'Context not found' }, 404);
  }

  return c.json({ success: true }, 200);
});

/**
 * Helper function to get all contexts for a project (for runner)
 */
export function getProjectContexts(projectId: string): Record<string, any> {
  const projectContexts = contextStore.get(projectId);

  if (!projectContexts || projectContexts.size === 0) {
    return {};
  }

  const contexts: Record<string, any> = {};
  for (const [_id, ctx] of projectContexts) {
    contexts[ctx.name] = ctx.data;
  }

  return contexts;
}

export default context;
