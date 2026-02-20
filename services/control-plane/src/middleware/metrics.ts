// ABOUTME: Hono middleware recording HTTP request metrics (count, duration histogram, active connections) for Prometheus.
// ABOUTME: Normalizes URL paths (replaces UUIDs with :id) and optionally excludes /metrics, /health from tracking.
/**
 * Metrics Middleware
 *
 * Tracks HTTP request metrics for Prometheus monitoring.
 * Records request duration, count, and active connections.
 */

import type { Context, Next } from 'hono';
import {
  recordHttpRequest,
  incrementActiveConnections,
  decrementActiveConnections,
  normalizePath,
} from '../lib/metrics.js';

/**
 * Middleware to track HTTP request metrics
 *
 * Records:
 * - Total request count by method, route, and status
 * - Request duration histogram by method, route, and status
 * - Active connections gauge
 */
export async function metricsMiddleware(c: Context, next: Next): Promise<void | Response> {
  const start = Date.now();

  // Increment active connections
  incrementActiveConnections();

  try {
    await next();
  } finally {
    // Decrement active connections
    decrementActiveConnections();

    // Calculate duration in seconds
    const durationSeconds = (Date.now() - start) / 1000;

    // Normalize the path (replace UUIDs with :id)
    const route = normalizePath(c.req.path);

    // Record the request metrics
    recordHttpRequest(
      c.req.method,
      route,
      c.res.status,
      durationSeconds
    );
  }
}

/**
 * Paths that should be excluded from metrics tracking
 * (to avoid metric cardinality issues and reduce noise)
 */
const EXCLUDED_PATHS = [
  '/metrics',
  '/health',
  '/favicon.ico',
];

/**
 * Middleware to track HTTP request metrics with path exclusion
 *
 * Same as metricsMiddleware but excludes certain paths from tracking
 */
export async function metricsMiddlewareWithExclusions(c: Context, next: Next): Promise<void | Response> {
  // Skip tracking for excluded paths
  if (EXCLUDED_PATHS.some(path => c.req.path === path || c.req.path.startsWith(path + '/'))) {
    return next();
  }

  return metricsMiddleware(c, next);
}

export default metricsMiddleware;
