// ABOUTME: Defines validation constants: max body/ZIP sizes, string length limits, name regex patterns, allowed content types.
// ABOUTME: Also defines user-facing validation error messages for invalid JSON, names, base64, and ZIP inputs.
/**
 * Centralized validation constants for API input validation
 * Defines limits for payloads, names, and data formats
 */

export const VALIDATION_LIMITS = {
  // Body size limits (global max; tier-specific enforcement at route level)
  MAX_BODY_SIZE_BYTES: 150 * 1024 * 1024,     // 150MB max payload (supports 100MB ZIP as base64)
  MAX_ZIP_DATA_SIZE_BYTES: 10 * 1024 * 1024,  // 10MB default for ZIP uploads (overridden by tier)

  // String length limits
  MAX_PROJECT_NAME_LENGTH: 128,
  MAX_SECRET_KEY_LENGTH: 64,
  MAX_CONTEXT_NAME_LENGTH: 64,

  // Regex patterns
  PROJECT_NAME_PATTERN: /^[a-zA-Z0-9][a-zA-Z0-9_\- ]{0,127}$/,

  // Content types
  ALLOWED_CONTENT_TYPES: ['application/json'],
} as const;

export const VALIDATION_ERRORS = {
  INVALID_JSON: 'Invalid JSON in request body',
  INVALID_CONTENT_TYPE: 'Content-Type must be application/json',
  BODY_TOO_LARGE: 'Request body exceeds maximum allowed size',
  NAME_TOO_LONG: 'Project name exceeds maximum length of 128 characters',
  INVALID_NAME_FORMAT: 'Project name must start with alphanumeric and contain only letters, numbers, spaces, hyphens, and underscores',
  INVALID_BASE64: 'Invalid base64-encoded ZIP data',
  INVALID_ZIP: 'ZIP data is not a valid ZIP archive',
} as const;
