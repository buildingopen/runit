// ABOUTME: Exports shared platform types: run envelopes, OpenAPI types, and context metadata interfaces.
// ABOUTME: Defines ContextMetadata and ContextValidationError used by the control plane context system.
/**
 * Shared Types
 *
 * Common types used across the platform.
 */

export * from './run-envelope';
export * from './openapi';

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

// FetchContextRequest and FetchContextResponse moved to contracts/control-plane.ts
// to avoid duplicate exports

export interface ContextValidationError {
  key: string;
  reason: string;
}

export const TYPES_VERSION = '1.0.0';
