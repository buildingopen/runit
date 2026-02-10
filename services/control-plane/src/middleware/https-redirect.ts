/**
 * HTTPS Redirect Middleware
 *
 * Redirects HTTP requests to HTTPS in production.
 * Checks the x-forwarded-proto header (set by load balancers/proxies).
 */

import type { Context, Next } from 'hono';

/**
 * HTTPS redirect middleware
 * Only active in production - redirects HTTP to HTTPS
 */
export async function httpsRedirectMiddleware(c: Context, next: Next) {
  // Only enforce in production
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }

  // Skip health checks (allow load balancer health checks over HTTP)
  const path = c.req.path;
  if (path === '/health' || path === '/health/deep' || path === '/') {
    return next();
  }

  // Check x-forwarded-proto header (set by load balancers)
  const proto = c.req.header('x-forwarded-proto');

  // If the request is not HTTPS, redirect
  if (proto && proto !== 'https') {
    const host = c.req.header('host');
    const url = c.req.url;

    if (host) {
      // Build HTTPS URL
      const httpsUrl = `https://${host}${new URL(url).pathname}${new URL(url).search}`;

      return c.redirect(httpsUrl, 301);
    }
  }

  return next();
}
