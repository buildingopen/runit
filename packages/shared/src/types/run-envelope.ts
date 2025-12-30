// ABOUTME: RunEnvelope type - standardized run result format for UI consumption
// ABOUTME: Provides stable contract for UI to display run results regardless of content type

/**
 * Artifact with signed download URL
 */
export interface Artifact {
  name: string;
  size: number;
  mime: string;
  url: string;  // Signed URL (24h expiry)
}

/**
 * Standardized run result envelope for UI consumption
 */
export interface RunEnvelope {
  // Identity
  run_id: string;
  status: "success" | "error" | "timeout";
  duration_ms: number;

  // HTTP response
  http_status: number;
  content_type: string;

  // Content (pick one based on content_type)
  json?: unknown;
  text_preview?: string;  // First 10KB

  // Artifacts
  artifacts: Artifact[];

  // Warnings (non-fatal issues)
  warnings: string[];

  // Redactions
  redactions_applied: boolean;

  // Metadata
  version_hash: string;
  base_image_version: string;

  // Error info (if status=error or timeout)
  error_class?: string;
  error_message?: string;
  suggested_fix?: string;
}
