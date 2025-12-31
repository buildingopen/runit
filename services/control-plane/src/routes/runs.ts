/**
 * Runs routes - Execute endpoints and get results
 */

import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import type {
  CreateRunRequest,
  CreateRunResponse,
  GetRunStatusResponse,
  ListRunsResponse
} from '@execution-layer/shared';
import { getProject } from './projects.js';
import { executeOnModal } from '../modal-client.js';
import { getDecryptedSecretsForRun } from './secrets.js';
import { encryptSecretsBundle } from '../encryption/kms.js';

const runs = new Hono();

// In-memory runs store (replace with database later)
const runsStore = new Map<string, {
  run_id: string;
  project_id: string;
  version_id: string;
  endpoint_id: string;
  status: 'queued' | 'running' | 'success' | 'error' | 'timeout';
  created_at: string;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  http_status?: number;
  response_body?: any;
  artifacts?: any[];
  logs?: string;
  error_class?: string;
  error_message?: string;
  suggested_fix?: string;
}>();

/**
 * POST /runs - Create and execute a new run
 */
runs.post('/', async (c) => {
  const body = await c.req.json() as CreateRunRequest;

  // Validate request
  if (!body.project_id || !body.version_id || !body.endpoint_id) {
    return c.json({ error: 'Missing required fields' }, 400);
  }

  // Get project and version
  const project = getProject(body.project_id);
  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  const version = project.versions.find(v => v.version_id === body.version_id);
  if (!version) {
    return c.json({ error: 'Version not found' }, 404);
  }

  const endpoint = version.endpoints?.find(ep => ep.id === body.endpoint_id);
  if (!endpoint) {
    return c.json({ error: 'Endpoint not found' }, 404);
  }

  // Create run record
  const run_id = randomUUID();
  const run = {
    run_id,
    project_id: body.project_id,
    version_id: body.version_id,
    endpoint_id: body.endpoint_id,
    status: 'running' as const,
    created_at: new Date().toISOString(),
    started_at: new Date().toISOString(),
  };

  runsStore.set(run_id, run);

  // Get and encrypt secrets for this project
  let secretsRef: string | undefined;
  try {
    const decryptedSecrets = await getDecryptedSecretsForRun(body.project_id);
    if (Object.keys(decryptedSecrets).length > 0) {
      // Encrypt secrets bundle for runner
      secretsRef = await encryptSecretsBundle(decryptedSecrets);
    }
  } catch (error) {
    console.error('Failed to get secrets:', error);
    // Continue without secrets (non-fatal)
  }

  // Execute on Modal asynchronously (in background)
  executeOnModal({
    run_id,
    code_bundle: version.code_bundle,
    endpoint: `${endpoint.method} ${endpoint.path}`,
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
    secrets_ref: secretsRef,  // Encrypted secrets bundle
    lane: body.lane || 'cpu',
    timeout_seconds: body.timeout_seconds || 60,
  }).then(result => {
    // Update run with result
    const run = runsStore.get(run_id);
    if (run) {
      run.status = result.status;
      run.completed_at = new Date().toISOString();
      run.duration_ms = result.duration_ms;
      run.http_status = result.http_status;
      run.response_body = result.response_body;
      run.artifacts = result.artifacts;
      run.logs = result.logs;
      run.error_class = result.error_class;
      run.error_message = result.error_message;
      run.suggested_fix = result.suggested_fix;
    }
  }).catch(error => {
    // Handle execution error
    const run = runsStore.get(run_id);
    if (run) {
      run.status = 'error';
      run.completed_at = new Date().toISOString();
      run.error_class = 'EXECUTION_FAILED';
      run.error_message = error.message;
    }
  });

  // Return immediate response
  const response: CreateRunResponse = {
    run_id,
    status: 'running',
  };

  return c.json(response, 202);  // 202 Accepted
});

/**
 * GET /runs/:id - Get run status and result
 */
runs.get('/:id', async (c) => {
  const run_id = c.req.param('id');
  const run = runsStore.get(run_id);

  if (!run) {
    return c.json({ error: 'Run not found' }, 404);
  }

  const response: GetRunStatusResponse = {
    run_id: run.run_id,
    project_id: run.project_id,
    version_id: run.version_id,
    endpoint_id: run.endpoint_id,
    status: run.status,
    created_at: run.created_at,
    started_at: run.started_at,
    completed_at: run.completed_at,
    duration_ms: run.duration_ms,
    created_by: 'anonymous',  // TODO: Get from auth context
    result: run.status === 'success' || run.status === 'error' || run.status === 'timeout' ? {
      http_status: run.http_status || 0,
      content_type: 'application/json',
      json: run.response_body,
      artifacts: (run.artifacts || []).map(a => ({
        name: a.name || 'artifact',
        size: a.size || 0,
        mime_type: a.mime || 'application/octet-stream',
        download_url: a.url || '',
      })),
      redactions_applied: false,
      error_class: run.error_class,
      error_message: run.error_message,
      suggested_fix: run.suggested_fix,
    } : undefined,
  };

  return c.json(response);
});

/**
 * Helper to get runs for a project
 */
export function getRunsForProject(project_id: string) {
  return Array.from(runsStore.values())
    .filter(run => run.project_id === project_id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export default runs;
