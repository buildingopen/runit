// ABOUTME: Run API client methods for creating runs, fetching status, and listing run history
// ABOUTME: Uses control-plane contracts from @execution-layer/shared

import type {
  CreateRunRequest,
  CreateRunResponse,
  GetRunStatusRequest,
  GetRunStatusResponse,
  ListRunsRequest,
  ListRunsResponse,
  ListEndpointsRequest,
  ListEndpointsResponse,
  GetEndpointSchemaRequest,
  GetEndpointSchemaResponse,
} from '@execution-layer/shared';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * List all endpoints for a project
 */
export async function listEndpoints(
  req: ListEndpointsRequest
): Promise<ListEndpointsResponse> {
  const params = new URLSearchParams({
    project_id: req.project_id,
  });

  if (req.version_id) {
    params.set('version_id', req.version_id);
  }

  const response = await fetch(`${API_BASE_URL}/api/endpoints?${params}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to list endpoints: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get endpoint schema for form generation
 */
export async function getEndpointSchema(
  req: GetEndpointSchemaRequest
): Promise<GetEndpointSchemaResponse> {
  const params = new URLSearchParams({
    project_id: req.project_id,
    version_id: req.version_id,
    endpoint_id: req.endpoint_id,
  });

  const response = await fetch(`${API_BASE_URL}/api/endpoints/schema?${params}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get endpoint schema: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Create and execute a run
 */
export async function createRun(req: CreateRunRequest): Promise<CreateRunResponse> {
  const response = await fetch(`${API_BASE_URL}/api/runs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(req),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `Failed to create run: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get run status and result
 */
export async function getRunStatus(
  req: GetRunStatusRequest
): Promise<GetRunStatusResponse> {
  const response = await fetch(`${API_BASE_URL}/api/runs/${req.run_id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get run status: ${response.statusText}`);
  }

  return response.json();
}

/**
 * List runs for a project/endpoint
 */
export async function listRuns(req: ListRunsRequest): Promise<ListRunsResponse> {
  const params = new URLSearchParams({
    project_id: req.project_id,
  });

  if (req.endpoint_id) {
    params.set('endpoint_id', req.endpoint_id);
  }

  if (req.limit) {
    params.set('limit', req.limit.toString());
  }

  if (req.offset) {
    params.set('offset', req.offset.toString());
  }

  const response = await fetch(`${API_BASE_URL}/api/runs?${params}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to list runs: ${response.statusText}`);
  }

  return response.json();
}
