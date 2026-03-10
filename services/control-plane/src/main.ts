// ABOUTME: Thin entrypoint that boots the control-plane server using createApp().
// ABOUTME: Handles env loading, Sentry init, startup health checks, graceful shutdown, and process error capture.

// IMPORTANT: Tracing must be imported BEFORE any other imports
// to ensure proper instrumentation of HTTP clients and servers
import { shutdownTracing } from './lib/tracing.js';

import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env from package directory (not cwd which may be monorepo root)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { validateEnv } from './lib/env.js';
import { initSentry, captureException, isSentryInitialized } from './lib/sentry.js';
import { logger } from './lib/logger.js';
import { testSupabaseConnection, isSupabaseConfigured } from './db/supabase.js';
import { setDraining } from './lib/server-state.js';
import { activeConnections } from './lib/metrics.js';
import { shutdownRateLimit } from './middleware/rate-limit.js';
import { features } from './config/features.js';
import { closeSQLiteDB } from './db/sqlite.js';

// Validate environment variables at boot
validateEnv();

// Initialize Sentry (blocking in production)
const isProduction = process.env.NODE_ENV === 'production';
if (isProduction) {
  await initSentry();
} else {
  initSentry().catch((err) => {
    logger.warn('Sentry init failed in development', { error: String(err) });
  });
}

// Startup health check - verify critical dependencies
async function startupHealthCheck(): Promise<void> {
  logger.info('[Startup] Running health checks...');

  if (isSupabaseConfigured()) {
    const supabaseCheck = await testSupabaseConnection();
    if (!supabaseCheck.connected) {
      logger.warn('[Startup] Supabase connectivity check failed (continuing - may recover)', {
        error: supabaseCheck.error,
      });
    } else {
      logger.info(`[Startup] Supabase connected (${supabaseCheck.latencyMs}ms)`);
    }
  } else {
    logger.warn('[Startup] Supabase not configured');
  }

  const hasModal = !!(process.env.MODAL_TOKEN_ID && process.env.MODAL_TOKEN_SECRET);
  if (hasModal) {
    logger.info('[Startup] Modal credentials configured');
  } else {
    logger.warn('[Startup] Modal credentials not configured (deployments will fail)');
  }

  if (isSentryInitialized()) {
    logger.info('[Startup] Sentry initialized');
  } else {
    logger.warn('[Startup] Sentry not initialized (running without error tracking)');
  }

  logger.info('[Startup] Health checks complete');
}

await startupHealthCheck();

// Run database migrations (async, non-blocking)
import('./db/migrate-boot.js').catch((err) => {
  logger.error('Boot migration failed', err instanceof Error ? err : new Error(String(err)));
});

// Create the app using the factory
const app = createApp();

const port = process.env.PORT ? parseInt(process.env.PORT) : 3001;

console.log(`
┌─────────────────────────────────────────────────────────────┐
│  RunIt Control Plane                                        │
│  Port: ${String(port).padEnd(52)}│
│  Mode: ${features.mode.toUpperCase().padEnd(52)}│
│  Auth: ${features.authMode.padEnd(52)}│
│  Env:  ${(isProduction ? 'PRODUCTION' : 'development').padEnd(52)}│
│  API:  /v1/* (versioned) or /* (legacy)                     │
└─────────────────────────────────────────────────────────────┘

Routes (all available at /v1/* and /*):
  System:
    GET  /health           Health check
    GET  /health/deep      Deep health check (dependencies)
    GET  /metrics          Prometheus metrics
    GET  /v1/openapi.json  OpenAPI 3.0 specification (full)

  Projects:
    POST /v1/projects      Create project (ZIP/GitHub)
    GET  /v1/projects      List projects
    GET  /v1/projects/:id  Get project details
    DEL  /v1/projects/:id  Delete project

  Endpoints:
    GET  /v1/projects/:id/endpoints                  List endpoints
    POST /v1/projects/:id/versions/:vid/extract-openapi  Extract OpenAPI

  Deploy:
    POST /v1/deploy        One-call deploy (code -> URL)

  Runs:
    POST /v1/runs          Execute endpoint
    GET  /v1/runs/:id      Get run status/result

  Secrets:
    POST /v1/projects/:id/secrets      Create secret
    GET  /v1/projects/:id/secrets      List secrets (masked)
    PUT  /v1/projects/:id/secrets/:key Update secret
    DEL  /v1/projects/:id/secrets/:key Delete secret

  Storage:
    PUT  /v1/projects/:id/storage/:key Upsert value
    GET  /v1/projects/:id/storage/:key Get value
    DEL  /v1/projects/:id/storage/:key Delete value
    GET  /v1/projects/:id/storage      List keys

  Sharing:
    POST /v1/projects/:id/share        Create share link
    GET  /v1/projects/:id/shares       List share links
    DEL  /v1/projects/:id/share/:sid   Disable share link
    GET  /v1/share/:share_id           Access shared endpoint
`);

const server = serve({
  fetch: app.fetch,
  port,
});

// Graceful shutdown handler
let isShuttingDown = false;
async function shutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n[${signal}] Shutting down gracefully...`);

  setDraining(true);
  await shutdownRateLimit();
  closeSQLiteDB();
  await shutdownTracing();

  let exited = false;
  function exitOnce(code: number, reason: string) {
    if (exited) return;
    exited = true;
    console.log(reason);
    process.exit(code);
  }

  server.close(() => {
    exitOnce(0, 'Server closed. Exiting.');
  });

  const drainInterval = setInterval(() => {
    const current = (activeConnections as any).hashMap?.get('')?.value ?? 0;
    if (current <= 0) {
      clearInterval(drainInterval);
      exitOnce(0, 'All connections drained. Exiting.');
    }
  }, 1000);

  setTimeout(() => {
    clearInterval(drainInterval);
    exitOnce(1, 'Forced shutdown after timeout');
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', reason instanceof Error ? reason : new Error(String(reason)));
  captureException(reason instanceof Error ? reason : new Error(String(reason)));
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error);
  captureException(error);
  process.exit(1);
});
