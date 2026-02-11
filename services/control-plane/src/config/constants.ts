/**
 * Control Plane Configuration Constants
 *
 * Centralized configuration values for the control plane
 * Prevents magic numbers and ensures consistency across routes
 */

// === Context Limits ===
/**
 * Maximum size for a single context data payload (in bytes)
 * Applied when fetching context from URL and when refreshing
 */
export const CONTEXT_MAX_SIZE_BYTES = 1024 * 1024; // 1MB

/**
 * Maximum total context size per project (in bytes)
 * Sum of all context data for a single project
 */
export const PROJECT_CONTEXT_MAX_TOTAL_BYTES = 1024 * 1024; // 1MB

// === Secrets Configuration ===
/**
 * Reserved prefix for system secrets
 * User secrets cannot start with this prefix
 */
export const SECRETS_RESERVED_PREFIX = 'EL_';

// === Error Codes ===
/**
 * Structured error codes for API responses
 * Format: CATEGORY_NNN where CATEGORY is 3-letter code
 */
export const ERROR_CODES = {
  // Context errors (CTX_xxx)
  CONTEXT_SIZE_EXCEEDED: 'CTX_001',
  CONTEXT_TOTAL_SIZE_EXCEEDED: 'CTX_002',
  CONTEXT_NOT_FOUND: 'CTX_003',
  CONTEXT_FETCH_FAILED: 'CTX_004',

  // Secret errors (SEC_xxx)
  SECRET_STORE_FAILED: 'SEC_001',
  SECRET_LIST_FAILED: 'SEC_002',
  SECRET_DELETE_FAILED: 'SEC_003',
  SECRET_RESERVED_PREFIX: 'SEC_004',
  SECRET_INVALID_FORMAT: 'SEC_005',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];
