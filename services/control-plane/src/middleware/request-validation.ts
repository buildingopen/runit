/**
 * Request validation middleware for API security
 * Handles body size limits, content-type, and JSON parsing errors
 */

import type { Context, Next } from 'hono';
import { VALIDATION_LIMITS, VALIDATION_ERRORS } from '../config/validation.js';

/**
 * Body size limit middleware
 * Must be applied BEFORE routes attempt to parse body
 */
export async function bodySizeLimitMiddleware(c: Context, next: Next) {
  const contentLength = c.req.header('content-length');

  if (contentLength) {
    const size = parseInt(contentLength, 10);
    if (size > VALIDATION_LIMITS.MAX_BODY_SIZE_BYTES) {
      return c.json({
        error: VALIDATION_ERRORS.BODY_TOO_LARGE,
        max_size_bytes: VALIDATION_LIMITS.MAX_BODY_SIZE_BYTES,
        received_size_bytes: size,
      }, 413);
    }
  }

  return next();
}

/**
 * Content-Type validation middleware for POST/PUT/PATCH requests
 */
export async function contentTypeMiddleware(c: Context, next: Next) {
  const method = c.req.method;

  // Only validate content-type for methods with bodies
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    const contentType = c.req.header('content-type');

    // Allow empty body for some requests
    const contentLength = c.req.header('content-length');
    if (contentLength === '0') {
      return next();
    }

    if (!contentType) {
      return c.json({
        error: VALIDATION_ERRORS.INVALID_CONTENT_TYPE,
        expected: 'application/json',
      }, 400);
    }

    // Extract media type (ignore charset, boundary, etc.)
    const mediaType = contentType.split(';')[0].trim().toLowerCase();

    if (!(VALIDATION_LIMITS.ALLOWED_CONTENT_TYPES as readonly string[]).includes(mediaType)) {
      return c.json({
        error: VALIDATION_ERRORS.INVALID_CONTENT_TYPE,
        expected: 'application/json',
        received: mediaType,
      }, 415);
    }
  }

  return next();
}
