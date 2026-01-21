/**
 * ABOUTME: Structured request logging middleware
 * ABOUTME: Logs HTTP requests with method, path, status, duration, and user info
 */

import type { Context, Next } from 'hono';
import { getAuthContext } from './auth.js';

interface LogEntry {
  timestamp: string;
  method: string;
  path: string;
  status: number;
  duration_ms: number;
  user_id?: string;
  ip?: string;
  error?: string;
}

/**
 * Format log entry as JSON for structured logging
 */
function formatLog(entry: LogEntry): string {
  return JSON.stringify(entry);
}

/**
 * Get client IP from request headers
 */
function getClientIp(c: Context): string {
  return (
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    c.req.header('x-real-ip') ||
    'unknown'
  );
}

/**
 * Request logging middleware
 * Logs each request with method, path, status, duration, and user info
 */
export async function loggerMiddleware(c: Context, next: Next) {
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;

  // Skip logging for health check to reduce noise
  if (path === '/health') {
    return next();
  }

  let error: string | undefined;

  try {
    await next();
  } catch (err) {
    error = err instanceof Error ? err.message : 'Unknown error';
    throw err;
  } finally {
    const duration_ms = Date.now() - start;
    const status = c.res.status;

    // Get user info if authenticated
    const authContext = getAuthContext(c);
    const user_id = authContext.user?.id;

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      method,
      path,
      status,
      duration_ms,
    };

    if (user_id) {
      logEntry.user_id = user_id;
    }

    // Only include IP for non-authenticated requests (privacy consideration)
    if (!user_id) {
      logEntry.ip = getClientIp(c);
    }

    if (error) {
      logEntry.error = error;
    }

    // Log with appropriate level based on status
    if (status >= 500) {
      console.error('[ERROR]', formatLog(logEntry));
    } else if (status >= 400) {
      console.warn('[WARN]', formatLog(logEntry));
    } else {
      console.log('[INFO]', formatLog(logEntry));
    }
  }
}

/**
 * Human-readable request logging (for development)
 */
export async function devLoggerMiddleware(c: Context, next: Next) {
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;

  // Skip logging for health check to reduce noise
  if (path === '/health') {
    return next();
  }

  await next();

  const duration = Date.now() - start;
  const status = c.res.status;

  // Color-coded status
  let statusColor = '\x1b[32m'; // green
  if (status >= 400) statusColor = '\x1b[33m'; // yellow
  if (status >= 500) statusColor = '\x1b[31m'; // red

  const reset = '\x1b[0m';
  const dim = '\x1b[2m';

  console.log(
    `${dim}${new Date().toISOString()}${reset} ${method.padEnd(6)} ${path} ${statusColor}${status}${reset} ${dim}${duration}ms${reset}`
  );
}
