/**
 * Zod Schemas for Control Plane API
 *
 * Runtime validation schemas for all control plane contracts
 */
import { z } from 'zod';
export declare const uuidSchema: z.ZodString;
export declare const timestampSchema: z.ZodString;
export declare const slugSchema: z.ZodString;
export declare const secretKeySchema: z.ZodString;
export declare const sourceTypeSchema: z.ZodEnum<["zip", "github"]>;
export declare const projectStatusSchema: z.ZodEnum<["building", "ready", "failed"]>;
export declare const runStatusSchema: z.ZodEnum<["queued", "running", "success", "error", "timeout"]>;
export declare const laneSchema: z.ZodEnum<["cpu", "gpu"]>;
export declare const shareTargetTypeSchema: z.ZodEnum<["endpoint_template", "run_result"]>;
export declare const createProjectRequestSchema: z.ZodEffects<z.ZodObject<{
    name: z.ZodString;
    source_type: z.ZodEnum<["zip", "github"]>;
    zip_data: z.ZodOptional<z.ZodString>;
    github_url: z.ZodOptional<z.ZodString>;
    github_ref: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    source_type: "zip" | "github";
    zip_data?: string | undefined;
    github_url?: string | undefined;
    github_ref?: string | undefined;
}, {
    name: string;
    source_type: "zip" | "github";
    zip_data?: string | undefined;
    github_url?: string | undefined;
    github_ref?: string | undefined;
}>, {
    name: string;
    source_type: "zip" | "github";
    zip_data?: string | undefined;
    github_url?: string | undefined;
    github_ref?: string | undefined;
}, {
    name: string;
    source_type: "zip" | "github";
    zip_data?: string | undefined;
    github_url?: string | undefined;
    github_ref?: string | undefined;
}>;
export declare const createProjectResponseSchema: z.ZodObject<{
    project_id: z.ZodString;
    project_slug: z.ZodString;
    version_id: z.ZodString;
    version_hash: z.ZodString;
    status: z.ZodEnum<["building", "ready", "failed"]>;
    error: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "ready" | "failed" | "building";
    project_id: string;
    project_slug: string;
    version_id: string;
    version_hash: string;
    error?: string | undefined;
}, {
    status: "ready" | "failed" | "building";
    project_id: string;
    project_slug: string;
    version_id: string;
    version_hash: string;
    error?: string | undefined;
}>;
export declare const projectVersionSchema: z.ZodObject<{
    version_id: z.ZodString;
    version_hash: z.ZodString;
    created_at: z.ZodString;
    status: z.ZodEnum<["building", "ready", "failed"]>;
}, "strip", z.ZodTypeAny, {
    status: "ready" | "failed" | "building";
    version_id: string;
    version_hash: string;
    created_at: string;
}, {
    status: "ready" | "failed" | "building";
    version_id: string;
    version_hash: string;
    created_at: string;
}>;
export declare const projectSchema: z.ZodObject<{
    project_id: z.ZodString;
    project_slug: z.ZodString;
    name: z.ZodString;
    owner_id: z.ZodString;
    versions: z.ZodOptional<z.ZodArray<z.ZodObject<{
        version_id: z.ZodString;
        version_hash: z.ZodString;
        created_at: z.ZodString;
        status: z.ZodEnum<["building", "ready", "failed"]>;
    }, "strip", z.ZodTypeAny, {
        status: "ready" | "failed" | "building";
        version_id: string;
        version_hash: string;
        created_at: string;
    }, {
        status: "ready" | "failed" | "building";
        version_id: string;
        version_hash: string;
        created_at: string;
    }>, "many">>;
    latest_version: z.ZodOptional<z.ZodString>;
    created_at: z.ZodString;
    updated_at: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    project_id: string;
    project_slug: string;
    created_at: string;
    owner_id: string;
    updated_at: string;
    versions?: {
        status: "ready" | "failed" | "building";
        version_id: string;
        version_hash: string;
        created_at: string;
    }[] | undefined;
    latest_version?: string | undefined;
}, {
    name: string;
    project_id: string;
    project_slug: string;
    created_at: string;
    owner_id: string;
    updated_at: string;
    versions?: {
        status: "ready" | "failed" | "building";
        version_id: string;
        version_hash: string;
        created_at: string;
    }[] | undefined;
    latest_version?: string | undefined;
}>;
export declare const listProjectsResponseSchema: z.ZodObject<{
    projects: z.ZodArray<z.ZodObject<Omit<{
        project_id: z.ZodString;
        project_slug: z.ZodString;
        name: z.ZodString;
        owner_id: z.ZodString;
        versions: z.ZodOptional<z.ZodArray<z.ZodObject<{
            version_id: z.ZodString;
            version_hash: z.ZodString;
            created_at: z.ZodString;
            status: z.ZodEnum<["building", "ready", "failed"]>;
        }, "strip", z.ZodTypeAny, {
            status: "ready" | "failed" | "building";
            version_id: string;
            version_hash: string;
            created_at: string;
        }, {
            status: "ready" | "failed" | "building";
            version_id: string;
            version_hash: string;
            created_at: string;
        }>, "many">>;
        latest_version: z.ZodOptional<z.ZodString>;
        created_at: z.ZodString;
        updated_at: z.ZodString;
    }, "versions">, "strip", z.ZodTypeAny, {
        name: string;
        project_id: string;
        project_slug: string;
        created_at: string;
        owner_id: string;
        updated_at: string;
        latest_version?: string | undefined;
    }, {
        name: string;
        project_id: string;
        project_slug: string;
        created_at: string;
        owner_id: string;
        updated_at: string;
        latest_version?: string | undefined;
    }>, "many">;
    total: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    projects: {
        name: string;
        project_id: string;
        project_slug: string;
        created_at: string;
        owner_id: string;
        updated_at: string;
        latest_version?: string | undefined;
    }[];
    total: number;
}, {
    projects: {
        name: string;
        project_id: string;
        project_slug: string;
        created_at: string;
        owner_id: string;
        updated_at: string;
        latest_version?: string | undefined;
    }[];
    total: number;
}>;
export declare const getProjectResponseSchema: z.ZodObject<{
    project_id: z.ZodString;
    project_slug: z.ZodString;
    name: z.ZodString;
    owner_id: z.ZodString;
    versions: z.ZodOptional<z.ZodArray<z.ZodObject<{
        version_id: z.ZodString;
        version_hash: z.ZodString;
        created_at: z.ZodString;
        status: z.ZodEnum<["building", "ready", "failed"]>;
    }, "strip", z.ZodTypeAny, {
        status: "ready" | "failed" | "building";
        version_id: string;
        version_hash: string;
        created_at: string;
    }, {
        status: "ready" | "failed" | "building";
        version_id: string;
        version_hash: string;
        created_at: string;
    }>, "many">>;
    latest_version: z.ZodOptional<z.ZodString>;
    created_at: z.ZodString;
    updated_at: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    project_id: string;
    project_slug: string;
    created_at: string;
    owner_id: string;
    updated_at: string;
    versions?: {
        status: "ready" | "failed" | "building";
        version_id: string;
        version_hash: string;
        created_at: string;
    }[] | undefined;
    latest_version?: string | undefined;
}, {
    name: string;
    project_id: string;
    project_slug: string;
    created_at: string;
    owner_id: string;
    updated_at: string;
    versions?: {
        status: "ready" | "failed" | "building";
        version_id: string;
        version_hash: string;
        created_at: string;
    }[] | undefined;
    latest_version?: string | undefined;
}>;
export declare const endpointSchema: z.ZodObject<{
    endpoint_id: z.ZodString;
    method: z.ZodEnum<["GET", "POST", "PUT", "PATCH", "DELETE"]>;
    path: z.ZodString;
    summary: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    requires_gpu: z.ZodOptional<z.ZodBoolean>;
    schema_ref: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    path: string;
    endpoint_id: string;
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    summary?: string | undefined;
    description?: string | undefined;
    requires_gpu?: boolean | undefined;
    schema_ref?: string | undefined;
}, {
    path: string;
    endpoint_id: string;
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    summary?: string | undefined;
    description?: string | undefined;
    requires_gpu?: boolean | undefined;
    schema_ref?: string | undefined;
}>;
export declare const listEndpointsResponseSchema: z.ZodObject<{
    project_id: z.ZodString;
    version_id: z.ZodString;
    endpoints: z.ZodArray<z.ZodObject<{
        endpoint_id: z.ZodString;
        method: z.ZodEnum<["GET", "POST", "PUT", "PATCH", "DELETE"]>;
        path: z.ZodString;
        summary: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
        requires_gpu: z.ZodOptional<z.ZodBoolean>;
        schema_ref: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        path: string;
        endpoint_id: string;
        method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
        summary?: string | undefined;
        description?: string | undefined;
        requires_gpu?: boolean | undefined;
        schema_ref?: string | undefined;
    }, {
        path: string;
        endpoint_id: string;
        method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
        summary?: string | undefined;
        description?: string | undefined;
        requires_gpu?: boolean | undefined;
        schema_ref?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    project_id: string;
    version_id: string;
    endpoints: {
        path: string;
        endpoint_id: string;
        method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
        summary?: string | undefined;
        description?: string | undefined;
        requires_gpu?: boolean | undefined;
        schema_ref?: string | undefined;
    }[];
}, {
    project_id: string;
    version_id: string;
    endpoints: {
        path: string;
        endpoint_id: string;
        method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
        summary?: string | undefined;
        description?: string | undefined;
        requires_gpu?: boolean | undefined;
        schema_ref?: string | undefined;
    }[];
}>;
export declare const getEndpointSchemaResponseSchema: z.ZodObject<{
    endpoint_id: z.ZodString;
    method: z.ZodString;
    path: z.ZodString;
    summary: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    request_schema: z.ZodUnknown;
    response_schema: z.ZodUnknown;
    parameters: z.ZodOptional<z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    path: string;
    endpoint_id: string;
    method: string;
    summary?: string | undefined;
    description?: string | undefined;
    request_schema?: unknown;
    response_schema?: unknown;
    parameters?: unknown;
}, {
    path: string;
    endpoint_id: string;
    method: string;
    summary?: string | undefined;
    description?: string | undefined;
    request_schema?: unknown;
    response_schema?: unknown;
    parameters?: unknown;
}>;
export declare const fileUploadSchema: z.ZodObject<{
    field_name: z.ZodString;
    filename: z.ZodString;
    content_type: z.ZodString;
    data: z.ZodString;
}, "strip", z.ZodTypeAny, {
    field_name: string;
    filename: string;
    content_type: string;
    data: string;
}, {
    field_name: string;
    filename: string;
    content_type: string;
    data: string;
}>;
export declare const createRunRequestSchema: z.ZodObject<{
    project_id: z.ZodString;
    version_id: z.ZodString;
    endpoint_id: z.ZodString;
    params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    json: z.ZodOptional<z.ZodUnknown>;
    headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    files: z.ZodOptional<z.ZodArray<z.ZodObject<{
        field_name: z.ZodString;
        filename: z.ZodString;
        content_type: z.ZodString;
        data: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        field_name: string;
        filename: string;
        content_type: string;
        data: string;
    }, {
        field_name: string;
        filename: string;
        content_type: string;
        data: string;
    }>, "many">>;
    lane: z.ZodDefault<z.ZodOptional<z.ZodEnum<["cpu", "gpu"]>>>;
    timeout_seconds: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    project_id: string;
    version_id: string;
    endpoint_id: string;
    lane: "cpu" | "gpu";
    timeout_seconds: number;
    params?: Record<string, unknown> | undefined;
    json?: unknown;
    headers?: Record<string, string> | undefined;
    files?: {
        field_name: string;
        filename: string;
        content_type: string;
        data: string;
    }[] | undefined;
}, {
    project_id: string;
    version_id: string;
    endpoint_id: string;
    params?: Record<string, unknown> | undefined;
    json?: unknown;
    headers?: Record<string, string> | undefined;
    files?: {
        field_name: string;
        filename: string;
        content_type: string;
        data: string;
    }[] | undefined;
    lane?: "cpu" | "gpu" | undefined;
    timeout_seconds?: number | undefined;
}>;
export declare const artifactSchema: z.ZodObject<{
    name: z.ZodString;
    size: z.ZodNumber;
    mime_type: z.ZodString;
    download_url: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    size: number;
    mime_type: string;
    download_url: string;
}, {
    name: string;
    size: number;
    mime_type: string;
    download_url: string;
}>;
export declare const runResultSchema: z.ZodObject<{
    http_status: z.ZodNumber;
    content_type: z.ZodString;
    json: z.ZodOptional<z.ZodUnknown>;
    text_preview: z.ZodOptional<z.ZodString>;
    artifacts: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        size: z.ZodNumber;
        mime_type: z.ZodString;
        download_url: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        size: number;
        mime_type: string;
        download_url: string;
    }, {
        name: string;
        size: number;
        mime_type: string;
        download_url: string;
    }>, "many">;
    warnings: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    redactions_applied: z.ZodBoolean;
    error_class: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    error_message: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    suggested_fix: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    logs: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    content_type: string;
    http_status: number;
    artifacts: {
        name: string;
        size: number;
        mime_type: string;
        download_url: string;
    }[];
    redactions_applied: boolean;
    json?: unknown;
    text_preview?: string | undefined;
    warnings?: string[] | undefined;
    error_class?: string | null | undefined;
    error_message?: string | null | undefined;
    suggested_fix?: string | null | undefined;
    logs?: string | undefined;
}, {
    content_type: string;
    http_status: number;
    artifacts: {
        name: string;
        size: number;
        mime_type: string;
        download_url: string;
    }[];
    redactions_applied: boolean;
    json?: unknown;
    text_preview?: string | undefined;
    warnings?: string[] | undefined;
    error_class?: string | null | undefined;
    error_message?: string | null | undefined;
    suggested_fix?: string | null | undefined;
    logs?: string | undefined;
}>;
export declare const createRunResponseSchema: z.ZodObject<{
    run_id: z.ZodString;
    status: z.ZodEnum<["queued", "running", "success", "error", "timeout"]>;
    result: z.ZodOptional<z.ZodObject<{
        http_status: z.ZodNumber;
        content_type: z.ZodString;
        json: z.ZodOptional<z.ZodUnknown>;
        text_preview: z.ZodOptional<z.ZodString>;
        artifacts: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            size: z.ZodNumber;
            mime_type: z.ZodString;
            download_url: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            name: string;
            size: number;
            mime_type: string;
            download_url: string;
        }, {
            name: string;
            size: number;
            mime_type: string;
            download_url: string;
        }>, "many">;
        warnings: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        redactions_applied: z.ZodBoolean;
        error_class: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        error_message: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        suggested_fix: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        logs: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        content_type: string;
        http_status: number;
        artifacts: {
            name: string;
            size: number;
            mime_type: string;
            download_url: string;
        }[];
        redactions_applied: boolean;
        json?: unknown;
        text_preview?: string | undefined;
        warnings?: string[] | undefined;
        error_class?: string | null | undefined;
        error_message?: string | null | undefined;
        suggested_fix?: string | null | undefined;
        logs?: string | undefined;
    }, {
        content_type: string;
        http_status: number;
        artifacts: {
            name: string;
            size: number;
            mime_type: string;
            download_url: string;
        }[];
        redactions_applied: boolean;
        json?: unknown;
        text_preview?: string | undefined;
        warnings?: string[] | undefined;
        error_class?: string | null | undefined;
        error_message?: string | null | undefined;
        suggested_fix?: string | null | undefined;
        logs?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    status: "success" | "error" | "timeout" | "queued" | "running";
    run_id: string;
    result?: {
        content_type: string;
        http_status: number;
        artifacts: {
            name: string;
            size: number;
            mime_type: string;
            download_url: string;
        }[];
        redactions_applied: boolean;
        json?: unknown;
        text_preview?: string | undefined;
        warnings?: string[] | undefined;
        error_class?: string | null | undefined;
        error_message?: string | null | undefined;
        suggested_fix?: string | null | undefined;
        logs?: string | undefined;
    } | undefined;
}, {
    status: "success" | "error" | "timeout" | "queued" | "running";
    run_id: string;
    result?: {
        content_type: string;
        http_status: number;
        artifacts: {
            name: string;
            size: number;
            mime_type: string;
            download_url: string;
        }[];
        redactions_applied: boolean;
        json?: unknown;
        text_preview?: string | undefined;
        warnings?: string[] | undefined;
        error_class?: string | null | undefined;
        error_message?: string | null | undefined;
        suggested_fix?: string | null | undefined;
        logs?: string | undefined;
    } | undefined;
}>;
export declare const getRunStatusResponseSchema: z.ZodObject<{
    run_id: z.ZodString;
    project_id: z.ZodString;
    version_id: z.ZodString;
    endpoint_id: z.ZodString;
    status: z.ZodEnum<["queued", "running", "success", "error", "timeout"]>;
    created_at: z.ZodString;
    started_at: z.ZodOptional<z.ZodString>;
    completed_at: z.ZodOptional<z.ZodString>;
    duration_ms: z.ZodOptional<z.ZodNumber>;
    result: z.ZodOptional<z.ZodObject<{
        http_status: z.ZodNumber;
        content_type: z.ZodString;
        json: z.ZodOptional<z.ZodUnknown>;
        text_preview: z.ZodOptional<z.ZodString>;
        artifacts: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            size: z.ZodNumber;
            mime_type: z.ZodString;
            download_url: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            name: string;
            size: number;
            mime_type: string;
            download_url: string;
        }, {
            name: string;
            size: number;
            mime_type: string;
            download_url: string;
        }>, "many">;
        warnings: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        redactions_applied: z.ZodBoolean;
        error_class: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        error_message: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        suggested_fix: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        logs: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        content_type: string;
        http_status: number;
        artifacts: {
            name: string;
            size: number;
            mime_type: string;
            download_url: string;
        }[];
        redactions_applied: boolean;
        json?: unknown;
        text_preview?: string | undefined;
        warnings?: string[] | undefined;
        error_class?: string | null | undefined;
        error_message?: string | null | undefined;
        suggested_fix?: string | null | undefined;
        logs?: string | undefined;
    }, {
        content_type: string;
        http_status: number;
        artifacts: {
            name: string;
            size: number;
            mime_type: string;
            download_url: string;
        }[];
        redactions_applied: boolean;
        json?: unknown;
        text_preview?: string | undefined;
        warnings?: string[] | undefined;
        error_class?: string | null | undefined;
        error_message?: string | null | undefined;
        suggested_fix?: string | null | undefined;
        logs?: string | undefined;
    }>>;
    created_by: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "success" | "error" | "timeout" | "queued" | "running";
    project_id: string;
    version_id: string;
    created_at: string;
    endpoint_id: string;
    run_id: string;
    created_by: string;
    result?: {
        content_type: string;
        http_status: number;
        artifacts: {
            name: string;
            size: number;
            mime_type: string;
            download_url: string;
        }[];
        redactions_applied: boolean;
        json?: unknown;
        text_preview?: string | undefined;
        warnings?: string[] | undefined;
        error_class?: string | null | undefined;
        error_message?: string | null | undefined;
        suggested_fix?: string | null | undefined;
        logs?: string | undefined;
    } | undefined;
    started_at?: string | undefined;
    completed_at?: string | undefined;
    duration_ms?: number | undefined;
}, {
    status: "success" | "error" | "timeout" | "queued" | "running";
    project_id: string;
    version_id: string;
    created_at: string;
    endpoint_id: string;
    run_id: string;
    created_by: string;
    result?: {
        content_type: string;
        http_status: number;
        artifacts: {
            name: string;
            size: number;
            mime_type: string;
            download_url: string;
        }[];
        redactions_applied: boolean;
        json?: unknown;
        text_preview?: string | undefined;
        warnings?: string[] | undefined;
        error_class?: string | null | undefined;
        error_message?: string | null | undefined;
        suggested_fix?: string | null | undefined;
        logs?: string | undefined;
    } | undefined;
    started_at?: string | undefined;
    completed_at?: string | undefined;
    duration_ms?: number | undefined;
}>;
export declare const listRunsResponseSchema: z.ZodObject<{
    runs: z.ZodArray<z.ZodObject<{
        run_id: z.ZodString;
        endpoint_id: z.ZodString;
        status: z.ZodString;
        created_at: z.ZodString;
        duration_ms: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        status: string;
        created_at: string;
        endpoint_id: string;
        run_id: string;
        duration_ms?: number | undefined;
    }, {
        status: string;
        created_at: string;
        endpoint_id: string;
        run_id: string;
        duration_ms?: number | undefined;
    }>, "many">;
    total: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    total: number;
    runs: {
        status: string;
        created_at: string;
        endpoint_id: string;
        run_id: string;
        duration_ms?: number | undefined;
    }[];
}, {
    total: number;
    runs: {
        status: string;
        created_at: string;
        endpoint_id: string;
        run_id: string;
        duration_ms?: number | undefined;
    }[];
}>;
export declare const createSecretRequestSchema: z.ZodObject<{
    project_id: z.ZodString;
    key: z.ZodString;
    value: z.ZodString;
}, "strip", z.ZodTypeAny, {
    value: string;
    project_id: string;
    key: string;
}, {
    value: string;
    project_id: string;
    key: string;
}>;
export declare const createSecretResponseSchema: z.ZodObject<{
    key: z.ZodString;
    created_at: z.ZodString;
}, "strip", z.ZodTypeAny, {
    created_at: string;
    key: string;
}, {
    created_at: string;
    key: string;
}>;
export declare const listSecretsResponseSchema: z.ZodObject<{
    secrets: z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        created_at: z.ZodString;
        updated_at: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        created_at: string;
        updated_at: string;
        key: string;
    }, {
        created_at: string;
        updated_at: string;
        key: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    secrets: {
        created_at: string;
        updated_at: string;
        key: string;
    }[];
}, {
    secrets: {
        created_at: string;
        updated_at: string;
        key: string;
    }[];
}>;
export declare const deleteSecretResponseSchema: z.ZodObject<{
    deleted: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    deleted: boolean;
}, {
    deleted: boolean;
}>;
export declare const fetchContextRequestSchema: z.ZodObject<{
    project_id: z.ZodString;
    url: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    url: string;
    project_id: string;
    name?: string | undefined;
}, {
    url: string;
    project_id: string;
    name?: string | undefined;
}>;
export declare const fetchContextResponseSchema: z.ZodObject<{
    id: z.ZodString;
    data: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    data: Record<string, unknown>;
    id: string;
}, {
    data: Record<string, unknown>;
    id: string;
}>;
export declare const contextSchema: z.ZodObject<{
    context_id: z.ZodString;
    url: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
    fetched_at: z.ZodString;
    size_bytes: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    url: string;
    context_id: string;
    fetched_at: string;
    size_bytes: number;
    name?: string | undefined;
}, {
    url: string;
    context_id: string;
    fetched_at: string;
    size_bytes: number;
    name?: string | undefined;
}>;
export declare const listContextResponseSchema: z.ZodObject<{
    contexts: z.ZodArray<z.ZodObject<{
        context_id: z.ZodString;
        url: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
        fetched_at: z.ZodString;
        size_bytes: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        url: string;
        context_id: string;
        fetched_at: string;
        size_bytes: number;
        name?: string | undefined;
    }, {
        url: string;
        context_id: string;
        fetched_at: string;
        size_bytes: number;
        name?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    contexts: {
        url: string;
        context_id: string;
        fetched_at: string;
        size_bytes: number;
        name?: string | undefined;
    }[];
}, {
    contexts: {
        url: string;
        context_id: string;
        fetched_at: string;
        size_bytes: number;
        name?: string | undefined;
    }[];
}>;
export declare const deleteContextResponseSchema: z.ZodObject<{
    deleted: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    deleted: boolean;
}, {
    deleted: boolean;
}>;
export declare const createShareLinkRequestSchema: z.ZodObject<{
    project_id: z.ZodString;
    target_type: z.ZodEnum<["endpoint_template", "run_result"]>;
    target_ref: z.ZodString;
}, "strip", z.ZodTypeAny, {
    project_id: string;
    target_type: "endpoint_template" | "run_result";
    target_ref: string;
}, {
    project_id: string;
    target_type: "endpoint_template" | "run_result";
    target_ref: string;
}>;
export declare const shareLinkStatsSchema: z.ZodObject<{
    run_count: z.ZodNumber;
    success_count: z.ZodNumber;
    last_run_at: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    run_count: number;
    success_count: number;
    last_run_at?: string | undefined;
}, {
    run_count: number;
    success_count: number;
    last_run_at?: string | undefined;
}>;
export declare const createShareLinkResponseSchema: z.ZodObject<{
    share_id: z.ZodString;
    share_url: z.ZodString;
    target_type: z.ZodString;
    target_ref: z.ZodString;
    created_at: z.ZodString;
}, "strip", z.ZodTypeAny, {
    created_at: string;
    target_type: string;
    target_ref: string;
    share_id: string;
    share_url: string;
}, {
    created_at: string;
    target_type: string;
    target_ref: string;
    share_id: string;
    share_url: string;
}>;
export declare const getShareLinkResponseSchema: z.ZodObject<{
    share_id: z.ZodString;
    target_type: z.ZodString;
    target_ref: z.ZodString;
    enabled: z.ZodBoolean;
    created_by: z.ZodString;
    created_at: z.ZodString;
    stats: z.ZodOptional<z.ZodObject<{
        run_count: z.ZodNumber;
        success_count: z.ZodNumber;
        last_run_at: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        run_count: number;
        success_count: number;
        last_run_at?: string | undefined;
    }, {
        run_count: number;
        success_count: number;
        last_run_at?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    enabled: boolean;
    created_at: string;
    created_by: string;
    target_type: string;
    target_ref: string;
    share_id: string;
    stats?: {
        run_count: number;
        success_count: number;
        last_run_at?: string | undefined;
    } | undefined;
}, {
    enabled: boolean;
    created_at: string;
    created_by: string;
    target_type: string;
    target_ref: string;
    share_id: string;
    stats?: {
        run_count: number;
        success_count: number;
        last_run_at?: string | undefined;
    } | undefined;
}>;
export declare const listShareLinksResponseSchema: z.ZodObject<{
    shares: z.ZodArray<z.ZodObject<{
        share_id: z.ZodString;
        share_url: z.ZodString;
        target_type: z.ZodString;
        target_ref: z.ZodString;
        enabled: z.ZodBoolean;
        created_at: z.ZodString;
        stats: z.ZodObject<{
            run_count: z.ZodNumber;
            success_count: z.ZodNumber;
            last_run_at: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            run_count: number;
            success_count: number;
            last_run_at?: string | undefined;
        }, {
            run_count: number;
            success_count: number;
            last_run_at?: string | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        created_at: string;
        target_type: string;
        target_ref: string;
        share_id: string;
        share_url: string;
        stats: {
            run_count: number;
            success_count: number;
            last_run_at?: string | undefined;
        };
    }, {
        enabled: boolean;
        created_at: string;
        target_type: string;
        target_ref: string;
        share_id: string;
        share_url: string;
        stats: {
            run_count: number;
            success_count: number;
            last_run_at?: string | undefined;
        };
    }>, "many">;
    total: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    total: number;
    shares: {
        enabled: boolean;
        created_at: string;
        target_type: string;
        target_ref: string;
        share_id: string;
        share_url: string;
        stats: {
            run_count: number;
            success_count: number;
            last_run_at?: string | undefined;
        };
    }[];
}, {
    total: number;
    shares: {
        enabled: boolean;
        created_at: string;
        target_type: string;
        target_ref: string;
        share_id: string;
        share_url: string;
        stats: {
            run_count: number;
            success_count: number;
            last_run_at?: string | undefined;
        };
    }[];
}>;
export declare const disableShareLinkResponseSchema: z.ZodObject<{
    disabled: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    disabled: boolean;
}, {
    disabled: boolean;
}>;
export declare const authSessionSchema: z.ZodObject<{
    user_id: z.ZodString;
    email: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
    avatar_url: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    user_id: string;
    email: string;
    name?: string | undefined;
    avatar_url?: string | undefined;
}, {
    user_id: string;
    email: string;
    name?: string | undefined;
    avatar_url?: string | undefined;
}>;
