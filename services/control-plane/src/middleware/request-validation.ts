// ABOUTME: Hono middleware enforcing request body size limits via Content-Length and Content-Type validation.
// ABOUTME: Requires Content-Length on POST/PUT/PATCH (except webhooks), rejects oversized payloads (413) and non-JSON (415).
/**
 * Request validation middleware for API security
 * Handles body size limits, content-type, and JSON parsing errors
 */

import type { Context, Next } from 'hono';
import { VALIDATION_LIMITS, VALIDATION_ERRORS } from '../config/validation.js';

// Paths exempt from Content-Length requirement (external webhooks use chunked transfer)
const BODY_CHECK_EXEMPT_PATHS = ['/v1/billing/webhook', '/billing/webhook'];

/**
 * Body size limit middleware
 * Must be applied BEFORE routes attempt to parse body.
 * Checks Content-Length header, requires it on POST/PUT/PATCH (except webhooks).
 */
export async function bodySizeLimitMiddleware(c: Context, next: Next) {
  const method = c.req.method;

  // Only enforce on methods that carry a body
  if (!['POST', 'PUT', 'PATCH'].includes(method)) {
    return next();
  }

  // Check if path is exempt (webhooks may use chunked transfer)
  const isExempt = BODY_CHECK_EXEMPT_PATHS.some(p => c.req.path === p || c.req.path.endsWith(p));

  // Fast reject via Content-Length header (if present)
  const contentLength = c.req.header('content-length');
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    if (!isNaN(size) && size > VALIDATION_LIMITS.MAX_BODY_SIZE_BYTES) {
      return c.json({
        error: VALIDATION_ERRORS.BODY_TOO_LARGE,
        max_size_bytes: VALIDATION_LIMITS.MAX_BODY_SIZE_BYTES,
        received_size_bytes: size,
      }, 413);
    }
  }

  // Require Content-Length for non-exempt POST/PUT/PATCH to prevent streaming bypass
  if (!contentLength && !isExempt) {
    return c.json({
      error: 'Content-Length header is required',
    }, 411);
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
    // Skip content-type check for webhook paths (Stripe sends its own content type)
    const isWebhook = BODY_CHECK_EXEMPT_PATHS.some(p => c.req.path === p || c.req.path.endsWith(p));
    if (isWebhook) {
      return next();
    }

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
