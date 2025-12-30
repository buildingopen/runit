/**
 * Control Plane API Contracts
 *
 * These define the REST API between Web UI and Control Plane.
 * Missing from Agent 1's deliverables - critical for Phase 2.
 */

// ============================================================================
// PROJECT MANAGEMENT
// ============================================================================

export interface CreateProjectRequest {
  name: string;
  source_type: 'zip' | 'github';
  // For ZIP uploads
  zip_data?: string;  // base64 encoded
  // For GitHub imports
  github_url?: string;
  github_ref?: string;  // branch, tag, or commit SHA
}

export interface CreateProjectResponse {
  project_id: string;
  project_slug: string;
  version_id: string;
  version_hash: string;
  status: 'building' | 'ready' | 'failed';
  error?: string;
}

export interface ListProjectsRequest {
  owner_id: string;
  limit?: number;
  offset?: number;
}

export interface ListProjectsResponse {
  projects: Array<{
    project_id: string;
    project_slug: string;
    name: string;
    latest_version: string;
    created_at: string;
    updated_at: string;
  }>;
  total: number;
}

export interface GetProjectRequest {
  project_id: string;
}

export interface GetProjectResponse {
  project_id: string;
  project_slug: string;
  name: string;
  owner_id: string;
  versions: Array<{
    version_id: string;
    version_hash: string;
    created_at: string;
    status: 'building' | 'ready' | 'failed';
  }>;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// ENDPOINTS
// ============================================================================

export interface ListEndpointsRequest {
  project_id: string;
  version_id?: string;  // Optional, defaults to latest
}

export interface ListEndpointsResponse {
  project_id: string;
  version_id: string;
  endpoints: Array<{
    endpoint_id: string;
    method: string;
    path: string;
    summary?: string;
    description?: string;
    requires_gpu?: boolean;
    schema_ref: string;  // Reference to OpenAPI schema
  }>;
}

export interface GetEndpointSchemaRequest {
  project_id: string;
  version_id: string;
  endpoint_id: string;
}

export interface GetEndpointSchemaResponse {
  endpoint_id: string;
  method: string;
  path: string;
  summary?: string;
  description?: string;
  request_schema: unknown;  // OpenAPI schema object
  response_schema: unknown;
  parameters?: unknown;
}

// ============================================================================
// RUN EXECUTION
// ============================================================================

export interface CreateRunRequest {
  project_id: string;
  version_id: string;
  endpoint_id: string;
  // Request data
  params?: Record<string, unknown>;
  json?: unknown;
  headers?: Record<string, string>;
  files?: Array<{
    field_name: string;
    filename: string;
    content_type: string;
    data: string;  // base64 encoded
  }>;
  // Execution config
  lane?: 'cpu' | 'gpu';
  timeout_seconds?: number;
}

export interface CreateRunResponse {
  run_id: string;
  status: 'queued' | 'running' | 'success' | 'error' | 'timeout';
  // Immediate response if fast, otherwise polling required
  result?: RunResult;
}

export interface GetRunStatusRequest {
  run_id: string;
}

export interface GetRunStatusResponse {
  run_id: string;
  project_id: string;
  version_id: string;
  endpoint_id: string;
  status: 'queued' | 'running' | 'success' | 'error' | 'timeout';
  created_at: string;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  result?: RunResult;
  created_by: string;  // user_id
}

export interface RunResult {
  http_status: number;
  content_type: string;
  json?: unknown;
  text_preview?: string;  // First 10KB for non-JSON
  artifacts: Array<{
    name: string;
    size: number;
    mime_type: string;
    download_url: string;  // Signed URL, 24h expiry
  }>;
  warnings?: string[];
  redactions_applied: boolean;
  // Error info (if status=error)
  error_class?: string;
  error_message?: string;
  suggested_fix?: string;
}

export interface ListRunsRequest {
  project_id: string;
  endpoint_id?: string;
  limit?: number;
  offset?: number;
}

export interface ListRunsResponse {
  runs: Array<{
    run_id: string;
    endpoint_id: string;
    status: string;
    created_at: string;
    duration_ms?: number;
  }>;
  total: number;
}

// ============================================================================
// SECRETS MANAGEMENT
// ============================================================================

export interface ListSecretsRequest {
  project_id: string;
}

export interface ListSecretsResponse {
  secrets: Array<{
    key: string;
    created_at: string;
    updated_at: string;
  }>;
}

export interface CreateSecretRequest {
  project_id: string;
  key: string;
  value: string;
}

export interface CreateSecretResponse {
  key: string;
  created_at: string;
}

export interface UpdateSecretRequest {
  project_id: string;
  key: string;
  value: string;
}

export interface UpdateSecretResponse {
  key: string;
  updated_at: string;
}

export interface DeleteSecretRequest {
  project_id: string;
  key: string;
}

export interface DeleteSecretResponse {
  deleted: boolean;
}

// ============================================================================
// CONTEXT MANAGEMENT
// ============================================================================

export interface FetchContextRequest {
  project_id: string;
  url: string;
  name?: string;  // Optional friendly name
}

export interface FetchContextResponse {
  context_id: string;
  url: string;
  name?: string;
  metadata: {
    title?: string;
    description?: string;
    fetched_at: string;
  };
  size_bytes: number;
}

export interface ListContextRequest {
  project_id: string;
}

export interface ListContextResponse {
  contexts: Array<{
    context_id: string;
    url: string;
    name?: string;
    fetched_at: string;
    size_bytes: number;
  }>;
}

export interface DeleteContextRequest {
  project_id: string;
  context_id: string;
}

export interface DeleteContextResponse {
  deleted: boolean;
}

// ============================================================================
// SHARE LINKS
// ============================================================================

export interface CreateShareLinkRequest {
  project_id: string;
  target_type: 'endpoint_template' | 'run_result';
  target_ref: string;  // endpoint_id or run_id
}

export interface CreateShareLinkResponse {
  share_id: string;
  share_url: string;
  target_type: string;
  target_ref: string;
  created_at: string;
}

export interface GetShareLinkRequest {
  share_id: string;
}

export interface GetShareLinkResponse {
  share_id: string;
  target_type: string;
  target_ref: string;
  enabled: boolean;
  created_by: string;
  created_at: string;
  // Stats (owner-only)
  stats?: {
    run_count: number;
    success_count: number;
    last_run_at?: string;
  };
}

export interface DisableShareLinkRequest {
  share_id: string;
}

export interface DisableShareLinkResponse {
  disabled: boolean;
}

// ============================================================================
// AUTHENTICATION (Placeholder for v0)
// ============================================================================

export interface AuthSession {
  user_id: string;
  email: string;
  name?: string;
  avatar_url?: string;
}

export interface CreateSessionRequest {
  // For v0: mock auth
  email: string;
}

export interface CreateSessionResponse {
  session_token: string;
  user: AuthSession;
}
