// ABOUTME: Hono routes for project key-value storage: CRUD operations on /projects/:projectId/storage.
// ABOUTME: Stores values as files on disk with metadata in SQLite/Supabase. 10MB per value, 100MB per project.

import { Hono } from 'hono';
import { verifyProjectOwnership } from '../middleware/verify-ownership.js';
import * as storageStore from '../db/storage-store.js';
import { logger } from '../lib/logger.js';

const storage = new Hono();

/**
 * PUT /projects/:projectId/storage/:key - Upsert a storage value
 */
storage.put('/:projectId/storage/:key', async (c) => {
  const { projectId, key } = c.req.param();
  const ownerResult = await verifyProjectOwnership(c, projectId);
  if (ownerResult instanceof Response) return ownerResult;

  try {
    const body = await c.req.json();
    const value = body.value;
    const valueType = body.value_type || 'json';

    if (value === undefined) {
      return c.json({ error: 'Missing required field: value' }, 400);
    }

    const entry = await storageStore.putStorage(projectId, key, value, valueType);

    return c.json({
      key: entry.key,
      value_type: entry.value_type,
      size_bytes: entry.size_bytes,
      created_at: entry.created_at,
      updated_at: entry.updated_at,
    }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (message.includes('exceeds maximum') || message.includes('quota exceeded')) {
      return c.json({ error: message }, 413);
    }
    if (message.includes('Key')) {
      return c.json({ error: message }, 400);
    }

    logger.error('Storage put failed', error instanceof Error ? error : new Error(message));
    return c.json({ error: 'Failed to store value' }, 500);
  }
});

/**
 * GET /projects/:projectId/storage/:key - Get a storage value
 */
storage.get('/:projectId/storage/:key', async (c) => {
  const { projectId, key } = c.req.param();
  const ownerResult = await verifyProjectOwnership(c, projectId);
  if (ownerResult instanceof Response) return ownerResult;

  try {
    const entry = await storageStore.getStorage(projectId, key);
    if (!entry) {
      return c.json({ error: 'Key not found' }, 404);
    }

    return c.json({
      key: entry.key,
      value: entry.data,
      value_type: entry.value_type,
      size_bytes: entry.size_bytes,
      created_at: entry.created_at,
      updated_at: entry.updated_at,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Storage get failed', error instanceof Error ? error : new Error(message));
    return c.json({ error: 'Failed to retrieve value' }, 500);
  }
});

/**
 * DELETE /projects/:projectId/storage/:key - Delete a storage value
 */
storage.delete('/:projectId/storage/:key', async (c) => {
  const { projectId, key } = c.req.param();
  const ownerResult = await verifyProjectOwnership(c, projectId);
  if (ownerResult instanceof Response) return ownerResult;

  try {
    await storageStore.deleteStorage(projectId, key);
    return c.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Storage delete failed', error instanceof Error ? error : new Error(message));
    return c.json({ error: 'Failed to delete value' }, 500);
  }
});

/**
 * GET /projects/:projectId/storage - List all storage keys (metadata only)
 */
storage.get('/:projectId/storage', async (c) => {
  const { projectId } = c.req.param();
  const ownerResult = await verifyProjectOwnership(c, projectId);
  if (ownerResult instanceof Response) return ownerResult;

  try {
    const entries = await storageStore.listStorageKeys(projectId);
    const usage = await storageStore.getStorageUsage(projectId);

    return c.json({
      entries: entries.map(e => ({
        key: e.key,
        value_type: e.value_type,
        size_bytes: e.size_bytes,
        created_at: e.created_at,
        updated_at: e.updated_at,
      })),
      total: entries.length,
      usage_bytes: usage,
      quota_bytes: 100 * 1024 * 1024,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Storage list failed', error instanceof Error ? error : new Error(message));
    return c.json({ error: 'Failed to list storage entries' }, 500);
  }
});

export default storage;
