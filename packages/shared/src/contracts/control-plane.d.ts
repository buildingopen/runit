/**
 * Control Plane API Contracts
 *
 * These define the REST API between Web UI and Control Plane.
 * Missing from Agent 1's deliverables - critical for Phase 2.
 */
export interface CreateProjectRequest {
    name: string;
    source_type: 'zip' | 'github';
    zip_data?: string;
    github_url?: string;
    github_ref?: string;
}
export type ProjectStatus = 'draft' | 'deploying' | 'live' | 'failed';
export interface CreateProjectResponse {
    project_id: string;
    project_slug: string;
    version_id: string;
    version_hash: string;
    status: ProjectStatus;
    detected_env_vars?: string[];
    endpoints?: Array<{
        id: string;
        method: string;
        path: string;
        summary?: string;
    }>;
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
export interface ListEndpointsRequest {
    project_id: string;
    version_id?: string;
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
        schema_ref: string;
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
    request_schema: unknown;
    response_schema: unknown;
    parameters?: unknown;
}
export interface CreateRunRequest {
    project_id: string;
    version_id: string;
    endpoint_id: string;
    params?: Record<string, unknown>;
    json?: unknown;
    headers?: Record<string, string>;
    files?: Array<{
        field_name: string;
        filename: string;
        content_type: string;
        data: string;
    }>;
    lane?: 'cpu' | 'gpu';
    timeout_seconds?: number;
}
export interface CreateRunResponse {
    run_id: string;
    status: 'queued' | 'running' | 'success' | 'error' | 'timeout';
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
    created_by: string;
}
export interface RunResult {
    http_status: number;
    content_type: string;
    json?: unknown;
    text_preview?: string;
    artifacts: Array<{
        name: string;
        size: number;
        mime_type: string;
        download_url: string;
    }>;
    warnings?: string[];
    redactions_applied: boolean;
    error_class?: string | null;
    error_message?: string | null;
    suggested_fix?: string | null;
    logs?: string;
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
export interface FetchContextRequest {
    project_id: string;
    url: string;
    name?: string;
}
export interface FetchContextResponse {
    id: string;
    data: Record<string, any>;
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
export interface CreateShareLinkRequest {
    project_id: string;
    target_type: 'endpoint_template' | 'run_result';
    target_ref: string;
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
export interface AuthSession {
    user_id: string;
    email: string;
    name?: string;
    avatar_url?: string;
}
export interface CreateSessionRequest {
    email: string;
}
export interface CreateSessionResponse {
    session_token: string;
    user: AuthSession;
}
//# sourceMappingURL=control-plane.d.ts.map