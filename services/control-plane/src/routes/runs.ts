// ABOUTME: Hono routes for run execution: POST /runs creates a run, dispatches to Modal, returns 202 with run_id.
// ABOUTME: GET /runs/:id polls status/results. Integrates quota tracking, secrets encryption, and artifact mapping.
/**
 * Runs routes - Execute endpoints and get results
 */

import { Hono } from 'hono';
import type {
  CreateRunRequest,
  CreateRunResponse,
  GetRunStatusResponse,
} from '@runtime-ai/shared';
import { getProject } from './projects.js';
import { executeOnModal } from '../lib/modal/client.js';
import { getDecryptedSecretsForRun } from './secrets.js';
import { encryptSecretsBundle } from '../encryption/kms.js';
import { getAuthContext } from '../middleware/auth.js';
import * as runsStore from '../db/runs-store.js';
import * as projectsStore from '../db/projects-store.js';
import { logger } from '../lib/logger.js';

/**
 * Quota tracking interface set by quota middleware
 */
interface QuotaTracking {
  userId: string;
  lane: 'cpu' | 'gpu';
  trackStart: (runId: string) => void;
  trackComplete: (runId: string) => void;
}

/**
 * Hono environment with quota tracking variable
 */
type RunsEnv = {
  Variables: {
    quotaTracking?: QuotaTracking;
  };
};

const runs = new Hono<RunsEnv>();

/**
 * POST /runs - Create and execute a new run
 */
runs.post('/', async (c) => {
  const body = await c.req.json() as CreateRunRequest;

  // Get authenticated user
  const authContext = getAuthContext(c);
  const owner_id = authContext.user?.id || 'anonymous';

  // Validate request
  if (!body.project_id || !body.version_id || !body.endpoint_id) {
    return c.json({ error: 'Missing required fields' }, 400);
  }

  // Get quota tracking from middleware (if present)
  const quotaTracking = c.get('quotaTracking');

  // Get project and version from DB
  const project = await projectsStore.getProject(body.project_id);
  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  const version = await projectsStore.getVersion(body.version_id);
  if (!version || version.project_id !== body.project_id) {
    return c.json({ error: 'Version not found' }, 404);
  }

  const endpoint = version.endpoints?.find(ep => ep.id === body.endpoint_id);
  if (!endpoint) {
    return c.json({ error: 'Endpoint not found' }, 404);
  }

  // Create run record in database
  const run = await runsStore.createRun({
    project_id: body.project_id,
    version_id: body.version_id,
    endpoint_id: body.endpoint_id,
    owner_id,
    request_params: body.params as Record<string, unknown>,
    request_body: body.json as Record<string, unknown>,
    request_headers: body.headers as Record<string, unknown>,
    resource_lane: body.lane || 'cpu',
  });

  // Track run start in quota system BEFORE returning 202 (prevents race condition)
  if (quotaTracking) {
    quotaTracking.trackStart(run.id);
  }

  // Mark run as started
  await runsStore.markRunStarted(run.id);

  // Get and encrypt secrets for this project
  let secretsRef: string | undefined;
  try {
    const decryptedSecrets = await getDecryptedSecretsForRun(body.project_id);
    if (Object.keys(decryptedSecrets).length > 0) {
      secretsRef = await encryptSecretsBundle(decryptedSecrets);
    }
  } catch (error) {
    // Secrets decryption failed: abort the run, do not proceed without secrets
    if (quotaTracking) {
      quotaTracking.trackComplete(run.id);
    }
    await runsStore.markRunError(run.id, {
      error_class: 'SECRETS_DECRYPTION_FAILED',
      error_message: 'Failed to decrypt project secrets. Check KMS configuration.',
    });
    return c.json({ error: 'Failed to prepare run: secrets decryption error' }, 500);
  }

  // Execute on Modal asynchronously (in background)
  logger.info('Starting Modal execution', { runId: run.id, entrypoint: version.entrypoint || 'main:app' });
  executeOnModal({
    run_id: run.id,
    code_bundle: version.code_bundle_ref,
    endpoint: `${endpoint.method} ${endpoint.path}`,
    entrypoint: version.entrypoint || 'main:app',
    request_data: {
      params: body.params,
      json: body.json,
      headers: body.headers,
      files: body.files?.map(f => ({
        name: f.filename,
        content: f.data,
        mime: f.content_type,
      })),
    },
    secrets_ref: secretsRef,
    lane: body.lane || 'cpu',
    timeout_seconds: body.timeout_seconds || 60,
  }).then(async (result) => {
    logger.info('Modal execution completed', { runId: run.id, status: result.status });

    if (result.status === 'success') {
      await runsStore.markRunSuccess(run.id, {
        response_status: result.http_status || 200,
        response_body: result.response_body as Record<string, unknown>,
        response_content_type: 'application/json',
        duration_ms: result.duration_ms || 0,
        artifacts: result.artifacts?.map(a => ({
          name: a.name || 'artifact',
          size: a.size || 0,
          mime: a.mime || 'application/octet-stream',
          storage_ref: a.url || '',
        })),
        logs: result.logs,
      });
    } else if (result.status === 'timeout') {
      await runsStore.markRunTimeout(run.id, {
        duration_ms: result.duration_ms,
        logs: result.logs,
      });
    } else {
      await runsStore.markRunError(run.id, {
        error_class: result.error_class || 'EXECUTION_ERROR',
        error_message: result.error_message || 'Unknown error',
        suggested_fix: result.suggested_fix,
        duration_ms: result.duration_ms,
        logs: result.logs,
      });
    }

    // Release quota slot
    if (quotaTracking) {
      quotaTracking.trackComplete(run.id);
    }
  }).catch(async (error) => {
    logger.error('Modal execution failed', { runId: run.id, error: String(error) });
    await runsStore.markRunError(run.id, {
      error_class: 'EXECUTION_FAILED',
      error_message: error.message,
      suggested_fix: 'Check control-plane logs for details',
    });

    if (quotaTracking) {
      quotaTracking.trackComplete(run.id);
    }
  });

  // Return immediate response
  const response: CreateRunResponse = {
    run_id: run.id,
    status: 'running',
  };

  return c.json(response, 202);
});

/**
 * GET /runs/:id - Get run status and result
 */
runs.get('/:id', async (c) => {
  const run_id = c.req.param('id');
  const run = await runsStore.getRun(run_id);

  if (!run) {
    return c.json({ error: 'Run not found' }, 404);
  }

  // Verify ownership (allow anonymous access to anonymous runs for share links)
  const authContext = getAuthContext(c);
  const userId = authContext.user?.id || 'anonymous';
  if (run.owner_id !== userId && run.owner_id !== 'anonymous') {
    return c.json({ error: 'Not authorized' }, 403);
  }

  const response: GetRunStatusResponse = {
    run_id: run.id,
    project_id: run.project_id,
    version_id: run.version_id,
    endpoint_id: run.endpoint_id,
    status: run.status,
    created_at: run.created_at,
    started_at: run.started_at || undefined,
    completed_at: run.completed_at || undefined,
    duration_ms: run.duration_ms || undefined,
    created_by: run.owner_id,
    result: run.status === 'success' || run.status === 'error' || run.status === 'timeout' ? {
      http_status: run.response_status || 0,
      content_type: run.response_content_type || 'application/json',
      json: run.response_body,
      artifacts: (run.artifacts || []).map(a => ({
        name: a.name || 'artifact',
        size: a.size || 0,
        mime_type: a.mime || 'application/octet-stream',
        download_url: a.storage_ref || '',
      })),
      redactions_applied: run.redactions_applied,
      error_class: run.error_class || undefined,
      error_message: run.error_message || undefined,
      suggested_fix: run.suggested_fix || undefined,
      logs: run.logs || undefined,
    } : undefined,
  };

  return c.json(response);
});

/**
 * Helper to get runs for a project (async)
 */
export async function getRunsForProject(project_id: string, options?: { limit?: number }) {
  return runsStore.listProjectRuns(project_id, options);
}

export default runs;
