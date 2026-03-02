/**
 * Request to build a project version
 */
export interface BuildRequest {
    version_id: string;
    code_bundle_ref: string;
    entrypoint?: string;
}
/**
 * Response from building a project version
 */
export interface BuildResponse {
    build_id: string;
    version_hash: string;
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
    openapi: Record<string, unknown>;
    endpoints: EndpointMetadata[];
}
/**
 * File uploaded in a request
 */
export interface FileUpload {
    name: string;
    content: string;
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
    request_data: RequestData;
    secrets_ref: string;
    context_ref: string;
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
    storage_ref: string;
}
/**
 * Response from running an endpoint
 */
export interface RunEndpointResponse {
    run_id: string;
    status: "success" | "error" | "timeout";
    http_status: number;
    http_headers: Record<string, string>;
    response_body: unknown;
    duration_ms: number;
    base_image_version: string;
    artifacts: ArtifactMetadata[];
    logs?: string;
    error_class?: string;
    error_detail?: string;
    error_message?: string;
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
    run_id: string;
    project_id: string;
    project_version: string;
    base_image_version: string;
    deps_hash: string;
    installed_packages: Array<{
        name: string;
        version: string;
    }>;
    endpoint: string;
    method: string;
    path: string;
    request_params: unknown;
    request_body: unknown;
    request_headers: Record<string, string>;
    context_refs: string[];
    resource_lane: "cpu" | "gpu";
    timeout_seconds: number;
    max_memory_mb: number;
    status: "success" | "error" | "timeout";
    error_class?: string;
    duration_ms: number;
    created_at: string;
}
/**
 * Response with run details and optional repro bundle
 */
export interface GetRunResponse {
    run: RunEndpointResponse;
    repro_bundle?: ReproBundle;
}
//# sourceMappingURL=runner.d.ts.map