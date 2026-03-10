// ABOUTME: Hono app factory function that wires up all middleware and routes.
// ABOUTME: Exported as createApp() so cloud-plane can import and extend with custom auth, routes, and features.

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { bodyLimit } from 'hono/body-limit';
import type { Context, Next } from 'hono';
import projects from './routes/projects.js';
import endpoints from './routes/endpoints.js';
import runs from './routes/runs.js';
import openapi from './routes/openapi.js';
import secrets from './routes/secrets.js';
import storageRoutes from './routes/storage.js';
import contextRoutes from './routes/context.js';
import { projectShare, shareLinks } from './routes/share.js';
import deploy from './routes/deploy.js';
import oneClickDeploy from './routes/one-click-deploy.js';
import billing from './routes/billing.js';
import templates from './routes/templates.js';
import metrics from './routes/metrics.js';
import versionsRoutes from './routes/versions.js';
import { rateLimitMiddleware, shutdownRateLimit } from './middleware/rate-limit.js';
import { quotaMiddleware } from './middleware/quota.js';
import { cloudIPFilterMiddleware } from './middleware/ip-filter.js';
import { bodySizeLimitMiddleware, contentTypeMiddleware } from './middleware/request-validation.js';
import { VALIDATION_LIMITS } from './config/validation.js';
import { authMiddleware } from './middleware/auth.js';
import { loggerMiddleware, devLoggerMiddleware } from './middleware/logger.js';
import { securityHeadersMiddleware } from './middleware/security-headers.js';
import { requestTimeoutMiddleware } from './middleware/request-timeout.js';
import { httpsRedirectMiddleware } from './middleware/https-redirect.js';
import { metricsMiddleware } from './middleware/metrics.js';
import { captureException } from './lib/sentry.js';
import { logger } from './lib/logger.js';
import { testSupabaseConnection, isSupabaseConfigured } from './db/supabase.js';
import { getCircuitBreakerStats, hasOpenCircuit } from './lib/circuit-breaker.js';
import { openAPISpec } from './lib/openapi-spec.js';
import { isDraining } from './lib/server-state.js';
import { features as defaultFeatures, type FeatureFlags } from './config/features.js';
import { isSentryInitialized } from './lib/sentry.js';

export type MiddlewareHandler = (c: Context, next: Next) => Promise<Response | void>;

export interface AppConfig {
  /** Replace the default auth middleware (e.g. with Supabase JWT in cloud) */
  authMiddleware?: MiddlewareHandler;
  /** Mount additional route groups under /v1 */
  extraRoutes?: Array<{ path: string; router: Hono }>;
  /** Override default feature flags */
  features?: Partial<FeatureFlags>;
}

function mergeFeatures(overrides?: Partial<FeatureFlags>): FeatureFlags {
  if (!overrides) return defaultFeatures;
  return { ...defaultFeatures, ...overrides };
}

export function createApp(config?: AppConfig): Hono {
  const feats = mergeFeatures(config?.features);
  const isProduction = process.env.NODE_ENV === 'production';

  const app = new Hono();

  // Global error handler for JSON parse errors and other exceptions
  app.onError((err, c) => {
    if (err instanceof SyntaxError && err.message.includes('JSON')) {
      return c.json({
        error: 'Invalid JSON in request body',
        ...(isProduction ? {} : { details: err.message }),
      }, 400);
    }

    logger.error('Unhandled error', err);
    captureException(err instanceof Error ? err : new Error(String(err)));
    return c.json({ error: 'Internal server error' }, 500);
  });

  // HTTPS redirect (production only)
  app.use('/*', httpsRedirectMiddleware);

  // Request timeout (30s default)
  app.use('/*', requestTimeoutMiddleware(30_000));

  // CORS - production-aware origin allowlist
  const allowedOrigins = (() => {
    const envOrigins = process.env.CORS_ORIGINS;
    if (envOrigins) {
      return envOrigins.split(',').map((o) => o.trim()).filter(Boolean);
    }
    return [];
  })();

  app.use('/*', cors({
    origin: (origin) => {
      if (!origin) return isProduction ? null : '*';
      if (allowedOrigins.includes(origin)) return origin;
      if (!isProduction) {
        if (origin.startsWith('http://localhost:')) return origin;
        if (origin.startsWith('http://127.0.0.1:')) return origin;
      }
      return null;
    },
    credentials: true,
  }));

  // Security headers
  app.use('/*', securityHeadersMiddleware);

  // Request logging
  app.use('/*', isProduction ? loggerMiddleware : devLoggerMiddleware);

  // Request metrics tracking
  app.use('/*', metricsMiddleware);

  // Body size limit
  app.use('/*', bodySizeLimitMiddleware);
  app.use('/*', bodyLimit({
    maxSize: VALIDATION_LIMITS.MAX_BODY_SIZE_BYTES,
    onError: (c) => c.json({ error: 'Request body exceeds maximum allowed size' }, 413),
  }));

  // Content-Type validation
  app.use('/*', contentTypeMiddleware);

  // Authentication middleware (replaceable by cloud)
  const AUTH_EXCLUDED_EXACT = ['/health', '/openapi.json', '/v1/openapi.json', '/v1/billing/webhook', '/billing/webhook'];
  const AUTH_EXCLUDED_PREFIXES = ['/metrics'];
  const auth = config?.authMiddleware ?? authMiddleware;

  app.use('/*', async (c, next) => {
    if (AUTH_EXCLUDED_EXACT.includes(c.req.path)) return next();
    if (AUTH_EXCLUDED_PREFIXES.some(prefix => c.req.path === prefix || c.req.path.startsWith(prefix + '/'))) return next();
    if (c.req.method === 'GET' && (c.req.path.startsWith('/templates') || c.req.path.startsWith('/v1/templates'))) return next();
    return auth(c, next);
  });

  // Rate limiting (cloud mode only)
  if (feats.rateLimiting) {
    app.use('/*', async (c, next) => {
      if (c.req.path === '/metrics' || c.req.path.startsWith('/metrics/')) {
        return next();
      }
      return rateLimitMiddleware(c, next);
    });
  }

  // IP filtering (cloud mode only)
  if (feats.ipFiltering) {
    app.use('/runs/*', cloudIPFilterMiddleware);
    app.use('/v1/runs/*', cloudIPFilterMiddleware);
  }

  // Quota enforcement (cloud mode only)
  if (feats.quotas) {
    app.use('/runs/*', quotaMiddleware);
    app.use('/v1/runs/*', quotaMiddleware);
  }

  // Root info endpoint
  app.get('/', (c) => {
    return c.json({
      name: 'RunIt Control Plane',
      version: '0.1.0',
      status: 'operational',
      features: ['projects', 'runs', 'secrets', 'context', 'rate-limiting', 'quotas', 'metrics'],
      endpoints: {
        projects: '/projects',
        runs: '/runs',
        health: '/health',
        metrics: '/metrics',
      },
    });
  });

  // Health check
  app.get('/health', (c) => {
    if (isDraining()) {
      return c.json({
        status: 'draining',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      }, 503);
    }
    const tunnelUrl = process.env.TUNNEL_URL || null;
    return c.json({
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      ...(tunnelUrl ? { tunnel_url: tunnelUrl } : {}),
    });
  });

  // Deep health check
  app.get('/health/deep', async (c) => {
    const checks: Record<string, { status: string; latency_ms?: number; error?: string }> = {};

    if (isSupabaseConfigured()) {
      const supabaseCheck = await testSupabaseConnection();
      checks.supabase = supabaseCheck.connected
        ? { status: 'healthy', latency_ms: supabaseCheck.latencyMs }
        : { status: 'unhealthy', latency_ms: supabaseCheck.latencyMs, error: supabaseCheck.error };
    } else {
      checks.supabase = { status: 'not_configured' };
    }

    const hasModal = !!(process.env.MODAL_TOKEN_ID && process.env.MODAL_TOKEN_SECRET);
    checks.modal = hasModal ? { status: 'configured' } : { status: 'not_configured' };
    checks.sentry = isSentryInitialized() ? { status: 'healthy' } : { status: 'not_configured' };

    const circuitStats = getCircuitBreakerStats();
    checks.circuit_breakers = hasOpenCircuit()
      ? { status: 'degraded', error: 'One or more services are temporarily unavailable' }
      : { status: 'healthy' };

    const overall = Object.values(checks).every((ch) => ch.status === 'healthy' || ch.status === 'configured' || ch.status === 'not_configured')
      ? 'healthy'
      : Object.values(checks).some((ch) => ch.status === 'unhealthy')
        ? 'unhealthy'
        : 'degraded';

    return c.json({
      status: overall,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      checks,
      serviceHealth: circuitStats,
    }, overall === 'unhealthy' ? 503 : 200);
  });

  // OpenAPI spec
  app.get('/openapi.json', (c) => c.json(openAPISpec));
  app.get('/v1/openapi.json', (c) => c.json(openAPISpec));

  // =========================================================================
  // API Routes
  // =========================================================================

  const apiRouter = new Hono();
  apiRouter.route('/projects', projects);
  apiRouter.route('/projects', endpoints);
  apiRouter.route('/projects', openapi);
  apiRouter.route('/projects', secrets);
  apiRouter.route('/projects', storageRoutes);
  apiRouter.route('/projects', contextRoutes);
  apiRouter.route('/projects', projectShare);
  apiRouter.route('/projects', deploy);
  apiRouter.route('/projects', versionsRoutes);
  apiRouter.route('/share', shareLinks);
  apiRouter.route('/deploy', oneClickDeploy);
  apiRouter.route('/runs', runs);
  if (feats.billing) {
    apiRouter.route('/billing', billing);
  }
  apiRouter.route('/templates', templates);

  // Cloud adds extra routes (billing, etc.)
  config?.extraRoutes?.forEach(({ path, router }) => {
    apiRouter.route(path, router);
  });

  // Mount v1 API (recommended)
  app.route('/v1', apiRouter);

  // Mount legacy routes (deprecated)
  app.use('/projects/*', async (c, next) => {
    await next();
    c.header('Deprecation', 'true');
    c.header('Sunset', '2026-12-31');
    c.header('Link', '</v1/projects>; rel="successor-version"');
  });
  app.route('/projects', projects);
  app.route('/projects', endpoints);
  app.route('/projects', openapi);
  app.route('/projects', secrets);
  app.route('/projects', storageRoutes);
  app.route('/projects', contextRoutes);
  app.route('/projects', projectShare);
  app.route('/projects', deploy);
  app.route('/projects', versionsRoutes);
  app.use('/share/*', async (c, next) => {
    await next();
    c.header('Deprecation', 'true');
    c.header('Sunset', '2026-12-31');
    c.header('Link', '</v1/share>; rel="successor-version"');
  });
  app.route('/share', shareLinks);
  app.use('/runs/*', async (c, next) => {
    await next();
    c.header('Deprecation', 'true');
    c.header('Sunset', '2026-12-31');
    c.header('Link', '</v1/runs>; rel="successor-version"');
  });
  app.route('/deploy', oneClickDeploy);
  app.route('/runs', runs);
  if (feats.billing) {
    app.route('/billing', billing);
  }
  app.route('/templates', templates);

  // Metrics always at root (Prometheus convention)
  app.route('/metrics', metrics);

  return app;
}
