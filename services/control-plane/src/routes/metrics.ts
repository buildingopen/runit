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
 */
metrics.get('/', async (c) => {
  // Update circuit breaker metrics before serving
  updateCircuitBreakerMetrics();

  c.header('Content-Type', metricsRegistry.contentType);
  return c.text(await metricsRegistry.metrics());
});

/**
 * GET /metrics/health - Quick health check based on metrics
 */
metrics.get('/health', (c) => {
  const circuitOpen = hasOpenCircuit();

  return c.json({
    status: circuitOpen ? 'degraded' : 'healthy',
    circuitBreakers: getCircuitBreakerStats(),
  });
});

export default metrics;
