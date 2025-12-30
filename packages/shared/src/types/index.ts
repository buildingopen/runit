/**
 * Shared Types
 *
 * Common types used across the platform.
 */

// TODO: Agent 1 (ARCHITECT) will define:
// - RunEnvelope
// - OpenAPIEndpointMeta
// - FormModel
// - ErrorResponse
// - Artifact

/**
 * Context Types (Agent 6 - MEMORY)
 */

export interface ContextMetadata {
  id: string;
  project_id: string;
  name: string;
  url?: string;
  data: Record<string, any>;
  created_at: string;
  updated_at: string;
  fetched_at?: string;
}

export interface FetchContextRequest {
  url: string;
  name: string;
}

export interface FetchContextResponse {
  id: string;
  name: string;
  data: {
    title?: string;
    description?: string;
    url: string;
    fetched_at: string;
  };
}

export interface ContextValidationError {
  key: string;
  reason: string;
}

export const TYPES_VERSION = '1.0.0';
