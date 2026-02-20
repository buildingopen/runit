// ABOUTME: Hono middleware adding security headers: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy.
// ABOUTME: In production, also sets HSTS (1 year) and a restrictive Content-Security-Policy.
/**
 * Security Headers Middleware
 *
 * Adds standard security headers to all responses.
 */

import type { Context, Next } from 'hono';

/**
 * Security headers middleware
 */
export async function securityHeadersMiddleware(c: Context, next: Next) {
  await next();

  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('X-XSS-Protection', '1; mode=block');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  if (process.env.NODE_ENV === 'production') {
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

    const cspDirectives = [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
    ];

    c.header('Content-Security-Policy', cspDirectives.join('; '));
  }
}
