/**
 * Artifact with signed download URL
 */
export interface Artifact {
    name: string;
    size: number;
    mime: string;
    url: string;
}
/**
 * Standardized run result envelope for UI consumption
 */
export interface RunEnvelope {
    run_id: string;
    status: "success" | "error" | "timeout";
    duration_ms: number;
    http_status: number;
    content_type: string;
    json?: unknown;
    text_preview?: string;
    artifacts: Artifact[];
    warnings: string[];
    redactions_applied: boolean;
    version_hash: string;
    base_image_version: string;
    error_class?: string;
    error_message?: string;
    suggested_fix?: string;
}
//# sourceMappingURL=run-envelope.d.ts.map