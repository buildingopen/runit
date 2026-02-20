// ABOUTME: Zod validation schemas for every control plane API contract: projects, endpoints, runs, secrets, contexts, shares.
// ABOUTME: Defines common primitives (uuid, slug, timestamp) and request/response schemas used for runtime validation.
/**
 * Zod Schemas for Control Plane API
 *
 * Runtime validation schemas for all control plane contracts
 */

import { z } from 'zod';

// ============================================================================
// COMMON SCHEMAS
// ============================================================================

export const uuidSchema = z.string().uuid();
export const timestampSchema = z.string().datetime();
export const slugSchema = z.string().regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/);
export const secretKeySchema = z.string()
  .min(1)
  .max(64)
  .regex(/^[A-Z][A-Z0-9_]*$/, 'Secret key must be uppercase with underscores');

export const sourceTypeSchema = z.enum(['zip', 'github']);
export const projectStatusSchema = z.enum(['building', 'ready', 'failed']);
export const runStatusSchema = z.enum(['queued', 'running', 'success', 'error', 'timeout']);
export const laneSchema = z.enum(['cpu', 'gpu']);
export const shareTargetTypeSchema = z.enum(['endpoint_template', 'run_result']);

// ============================================================================
// PROJECT SCHEMAS
// ============================================================================

export const createProjectRequestSchema = z.object({
  name: z.string().min(1).max(128),
  source_type: sourceTypeSchema,
  zip_data: z.string().optional(),
  github_url: z.string().url().optional(),
  github_ref: z.string().optional(),
}).refine(
  (data) => {
    if (data.source_type === 'zip') return !!data.zip_data;
    if (data.source_type === 'github') return !!data.github_url;
    return false;
  },
  { message: 'zip_data required for zip source, github_url required for github source' }
);

export const createProjectResponseSchema = z.object({
  project_id: uuidSchema,
  project_slug: z.string(),
  version_id: uuidSchema,
  version_hash: z.string(),
  status: projectStatusSchema,
  error: z.string().optional(),
});

export const projectVersionSchema = z.object({
  version_id: uuidSchema,
  version_hash: z.string(),
  created_at: timestampSchema,
  status: projectStatusSchema,
});

export const projectSchema = z.object({
  project_id: uuidSchema,
  project_slug: z.string(),
  name: z.string(),
  owner_id: uuidSchema,
  versions: z.array(projectVersionSchema).optional(),
  latest_version: z.string().optional(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const listProjectsResponseSchema = z.object({
  projects: z.array(projectSchema.omit({ versions: true })),
  total: z.number().int().nonnegative(),
});

export const getProjectResponseSchema = projectSchema;

// ============================================================================
// ENDPOINT SCHEMAS
// ============================================================================

export const endpointSchema = z.object({
  endpoint_id: z.string(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  path: z.string(),
  summary: z.string().optional(),
  description: z.string().optional(),
  requires_gpu: z.boolean().optional(),
  schema_ref: z.string().optional(),
});

export const listEndpointsResponseSchema = z.object({
  project_id: uuidSchema,
  version_id: uuidSchema,
  endpoints: z.array(endpointSchema),
});

export const getEndpointSchemaResponseSchema = z.object({
  endpoint_id: z.string(),
  method: z.string(),
  path: z.string(),
  summary: z.string().optional(),
  description: z.string().optional(),
  request_schema: z.unknown(),
  response_schema: z.unknown(),
  parameters: z.unknown().optional(),
});

// ============================================================================
// RUN SCHEMAS
// ============================================================================

export const fileUploadSchema = z.object({
  field_name: z.string(),
  filename: z.string(),
  content_type: z.string(),
  data: z.string(), // base64 encoded
});

export const createRunRequestSchema = z.object({
  project_id: uuidSchema,
  version_id: uuidSchema,
  endpoint_id: z.string(),
  params: z.record(z.unknown()).optional(),
  json: z.unknown().optional(),
  headers: z.record(z.string()).optional(),
  files: z.array(fileUploadSchema).optional(),
  lane: laneSchema.optional().default('cpu'),
  timeout_seconds: z.number().int().min(1).max(300).optional().default(60),
});

export const artifactSchema = z.object({
  name: z.string(),
  size: z.number().int().nonnegative(),
  mime_type: z.string(),
  download_url: z.string().url(),
});

export const runResultSchema = z.object({
  http_status: z.number().int(),
  content_type: z.string(),
  json: z.unknown().optional(),
  text_preview: z.string().optional(),
  artifacts: z.array(artifactSchema),
  warnings: z.array(z.string()).optional(),
  redactions_applied: z.boolean(),
  error_class: z.string().nullable().optional(),
  error_message: z.string().nullable().optional(),
  suggested_fix: z.string().nullable().optional(),
  logs: z.string().optional(),
});

export const createRunResponseSchema = z.object({
  run_id: uuidSchema,
  status: runStatusSchema,
  result: runResultSchema.optional(),
});

export const getRunStatusResponseSchema = z.object({
  run_id: uuidSchema,
  project_id: uuidSchema,
  version_id: uuidSchema,
  endpoint_id: z.string(),
  status: runStatusSchema,
  created_at: timestampSchema,
  started_at: timestampSchema.optional(),
  completed_at: timestampSchema.optional(),
  duration_ms: z.number().int().nonnegative().optional(),
  result: runResultSchema.optional(),
  created_by: uuidSchema,
});

export const listRunsResponseSchema = z.object({
  runs: z.array(z.object({
    run_id: uuidSchema,
    endpoint_id: z.string(),
    status: z.string(),
    created_at: timestampSchema,
    duration_ms: z.number().int().nonnegative().optional(),
  })),
  total: z.number().int().nonnegative(),
});

// ============================================================================
// SECRET SCHEMAS
// ============================================================================

export const createSecretRequestSchema = z.object({
  project_id: uuidSchema,
  key: secretKeySchema,
  value: z.string().min(1),
});

export const createSecretResponseSchema = z.object({
  key: z.string(),
  created_at: timestampSchema,
});

export const listSecretsResponseSchema = z.object({
  secrets: z.array(z.object({
    key: z.string(),
    created_at: timestampSchema,
    updated_at: timestampSchema,
  })),
});

export const deleteSecretResponseSchema = z.object({
  deleted: z.boolean(),
});

// ============================================================================
// CONTEXT SCHEMAS
// ============================================================================

export const fetchContextRequestSchema = z.object({
  project_id: uuidSchema,
  url: z.string().url(),
  name: z.string().max(100).optional(),
});

export const fetchContextResponseSchema = z.object({
  id: uuidSchema,
  data: z.record(z.unknown()),
});

export const contextSchema = z.object({
  context_id: uuidSchema,
  url: z.string().url(),
  name: z.string().optional(),
  fetched_at: timestampSchema,
  size_bytes: z.number().int().nonnegative(),
});

export const listContextResponseSchema = z.object({
  contexts: z.array(contextSchema),
});

export const deleteContextResponseSchema = z.object({
  deleted: z.boolean(),
});

// ============================================================================
// SHARE LINK SCHEMAS
// ============================================================================

export const createShareLinkRequestSchema = z.object({
  project_id: uuidSchema,
  target_type: shareTargetTypeSchema,
  target_ref: z.string(),
});

export const shareLinkStatsSchema = z.object({
  run_count: z.number().int().nonnegative(),
  success_count: z.number().int().nonnegative(),
  last_run_at: timestampSchema.optional(),
});

export const createShareLinkResponseSchema = z.object({
  share_id: uuidSchema,
  share_url: z.string().url(),
  target_type: z.string(),
  target_ref: z.string(),
  created_at: timestampSchema,
});

export const getShareLinkResponseSchema = z.object({
  share_id: uuidSchema,
  target_type: z.string(),
  target_ref: z.string(),
  enabled: z.boolean(),
  created_by: uuidSchema,
  created_at: timestampSchema,
  stats: shareLinkStatsSchema.optional(),
});

export const listShareLinksResponseSchema = z.object({
  shares: z.array(z.object({
    share_id: uuidSchema,
    share_url: z.string().url(),
    target_type: z.string(),
    target_ref: z.string(),
    enabled: z.boolean(),
    created_at: timestampSchema,
    stats: shareLinkStatsSchema,
  })),
  total: z.number().int().nonnegative(),
});

export const disableShareLinkResponseSchema = z.object({
  disabled: z.boolean(),
});

// ============================================================================
// AUTH SCHEMAS
// ============================================================================

export const authSessionSchema = z.object({
  user_id: uuidSchema,
  email: z.string().email(),
  name: z.string().optional(),
  avatar_url: z.string().url().optional(),
});

// ============================================================================
// TYPE INFERENCE HELPERS
// ============================================================================
// Note: Types are defined in contracts/control-plane.ts
// Use z.infer<typeof schema> when you need the inferred type from a schema
