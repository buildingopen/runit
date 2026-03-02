// ABOUTME: Hono routes exposing GET /metrics for Prometheus scraping and GET /metrics/health for circuit breaker status.
// ABOUTME: Updates circuit breaker gauge metrics on each scrape before serializing the registry.
/**
 * Prometheus Metrics Endpoint
 *
 * Exposes /metrics endpoint for Prometheus scraping.
 * Metric definitions are in lib/metrics.ts
 */

import { Hono } from 'hono';
import { metricsRegistry, recordCircuitBreakerState } from '../lib/metrics';
import { getCircuitBreakerStats, hasOpenCircuit } from '../lib/circuit-breaker';

/**
 * Update circuit breaker metrics
 */
function updateCircuitBreakerMetrics() {
  const stats = getCircuitBreakerStats();
  for (const [name, stat] of Object.entries(stats)) {
    recordCircuitBreakerState(name, stat.state as 'closed' | 'half-open' | 'open');
  }
}

// Metrics routes
const metrics = new Hono();

/**
 * GET /metrics - Prometheus metrics endpoint
 * Restricted: requires METRICS_TOKEN bearer auth or localhost origin in production.
 */
metrics.get('/', async (c) => {
  const authErr = requireMetricsAuth(c);
  if (authErr) return authErr;

  // Update circuit breaker metrics before serving
  updateCircuitBreakerMetrics();

  c.header('Content-Type', metricsRegistry.contentType);
  return c.text(await metricsRegistry.metrics());
});

/**
 * Verify METRICS_TOKEN for metrics sub-routes
 */
function requireMetricsAuth(c: any): Response | null {
  if (process.env.NODE_ENV === 'production') {
    const metricsToken = process.env.METRICS_TOKEN;
    if (!metricsToken) return c.json({ error: 'Metrics disabled' }, 503);
    if (c.req.header('authorization') !== `Bearer ${metricsToken}`) return c.json({ error: 'Unauthorized' }, 401);
  } else if (process.env.METRICS_TOKEN) {
    if (c.req.header('authorization') !== `Bearer ${process.env.METRICS_TOKEN}`) return c.json({ error: 'Unauthorized' }, 401);
  }
  return null;
}

/**
 * GET /metrics/health - Quick health check based on metrics
 */
metrics.get('/health', (c) => {
  const authErr = requireMetricsAuth(c);
  if (authErr) return authErr;

  const circuitOpen = hasOpenCircuit();

  return c.json({
    status: circuitOpen ? 'degraded' : 'healthy',
    serviceHealth: getCircuitBreakerStats(),
  });
});

export default metrics;
