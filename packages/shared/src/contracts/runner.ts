// ABOUTME: Runner API contracts for control-plane → runner communication
// ABOUTME: Defines Build, OpenAPI extraction, and Run endpoint request/response types

/**
 * Request to build a project version
 */
export interface BuildRequest {
  version_id: string;
  code_bundle_ref: string;  // S3 URL
  entrypoint?: string;      // Optional override (e.g., "main:app")
}

/**
 * Response from building a project version
 */
export interface BuildResponse {
  build_id: string;
  version_hash: string;       // SHA256
  deps_hash: string;
  base_image_version: string;
  status: "ready" | "failed";
  error?: string;
}

/**
 * Request to get OpenAPI spec from a build
 */
export interface GetOpenAPIRequest {
  build_id: string;
}

/**
 * Endpoint metadata extracted from OpenAPI
 */
export interface EndpointMetadata {
  id: string;
  method: string;
  path: string;
  summary?: string;
  requires_gpu?: boolean;
}

/**
 * Response with OpenAPI spec and endpoints
 */
export interface GetOpenAPIResponse {
  build_id: string;
  openapi: Record<string, unknown>;  // Full OpenAPI spec
  endpoints: EndpointMetadata[];
}

/**
 * File uploaded in a request
 */
export interface FileUpload {
  name: string;
  content: string;  // Base64 encoded
  mime: string;
}

/**
 * Request data for endpoint execution
 */
export interface RequestData {
  params?: Record<string, unknown>;
  json?: unknown;
  headers?: Record<string, string>;
  files?: FileUpload[];
}

/**
 * Request to run an endpoint
 */
export interface RunEndpointRequest {
  run_id: string;
  build_id: string;
  endpoint_id: string;

  // Inputs
  request_data: RequestData;

  // Environment
  secrets_ref: string;   // KMS-encrypted blob ref
  context_ref: string;   // Context data ref

  // Resources
  lane: "cpu" | "gpu";
  timeout_seconds: number;
  max_memory_mb: number;
}

/**
 * Artifact metadata
 */
export interface ArtifactMetadata {
  name: string;
  size: number;
  mime: string;
  storage_ref: string;  // S3 ref
}

/**
 * Response from running an endpoint
 */
export interface RunEndpointResponse {
  run_id: string;
  status: "success" | "error" | "timeout";

  // HTTP response
  http_status: number;
  http_headers: Record<string, string>;
  response_body: unknown;

  // Metadata
  duration_ms: number;
  base_image_version: string;

  // Artifacts
  artifacts: ArtifactMetadata[];

  // Logs (owner-only, redacted)
  logs?: string;

  // Error info
  error_class?: string;
  error_detail?: string;   // Owner-only
  error_message?: string;  // Runner-safe
  suggested_fix?: string;
}

/**
 * Request to get run details
 */
export interface GetRunRequest {
  run_id: string;
}

/**
 * Repro bundle for debugging (owner-only)
 */
export interface ReproBundle {
  // Immutable identifiers
  run_id: string;
  project_id: string;
  project_version: string;  // SHA

  // Environment
  base_image_version: string;
  deps_hash: string;
  installed_packages: Array<{ name: string; version: string }>;

  // Execution
  endpoint: string;
  method: string;
  path: string;

  // Inputs (SANITIZED - no secrets)
  request_params: unknown;
  request_body: unknown;
  request_headers: Record<string, string>;

  // Context (pointers, not raw data)
  context_refs: string[];

  // Metadata
  resource_lane: "cpu" | "gpu";
  timeout_seconds: number;
  max_memory_mb: number;

  // Outcome
  status: "success" | "error" | "timeout";
  error_class?: string;
  duration_ms: number;

  // Timestamp
  created_at: string;  // ISO 8601
}

/**
 * Response with run details and optional repro bundle
 */
export interface GetRunResponse {
  run: RunEndpointResponse;
  repro_bundle?: ReproBundle;  // Owner-only
}
