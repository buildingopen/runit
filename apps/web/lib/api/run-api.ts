// ABOUTME: Run API client methods for creating runs, fetching status, and listing run history
// ABOUTME: Uses control-plane contracts from @runtime-ai/shared

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
} from '@runtime-ai/shared';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const DEFAULT_TIMEOUT = 30000; // 30 seconds

/**
 * Fetch with timeout wrapper
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = DEFAULT_TIMEOUT
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timeout - please try again');
    }
    throw error;
  }
}

/**
 * List all endpoints for a project
 */
export async function listEndpoints(
  req: ListEndpointsRequest
): Promise<ListEndpointsResponse> {
  const params = new URLSearchParams();

  if (req.version_id) {
    params.set('version_id', req.version_id);
  }

  const encodedProjectId = encodeURIComponent(req.project_id);
  const url = params.toString()
    ? `${API_BASE_URL}/projects/${encodedProjectId}/endpoints?${params}`
    : `${API_BASE_URL}/projects/${encodedProjectId}/endpoints`;

  const response = await fetchWithTimeout(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.message || 'Unable to load endpoints. Please try again.'
    );
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
    version_id: req.version_id,
    endpoint_id: req.endpoint_id,
  });

  const encodedProjectId = encodeURIComponent(req.project_id);
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/projects/${encodedProjectId}/endpoints/schema?${params}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.message || 'Unable to load endpoint schema. Please try again.'
    );
  }

  return response.json();
}

/**
 * Create and execute a run
 */
export async function createRun(req: CreateRunRequest): Promise<CreateRunResponse> {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/runs`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req),
    },
    60000 // 60 seconds for run creation
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.message || errorData.error || 'Unable to create run. Please try again.'
    );
  }

  return response.json();
}

/**
 * Get run status and result
 */
export async function getRunStatus(
  req: GetRunStatusRequest
): Promise<GetRunStatusResponse> {
  const encodedRunId = encodeURIComponent(req.run_id);
  const response = await fetchWithTimeout(`${API_BASE_URL}/runs/${encodedRunId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.message || 'Unable to get run status. Please try again.'
    );
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

  const response = await fetchWithTimeout(`${API_BASE_URL}/runs?${params}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.message || 'Unable to load run history. Please try again.'
    );
  }

  return response.json();
}
