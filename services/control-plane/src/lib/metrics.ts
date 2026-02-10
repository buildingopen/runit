/**
 * Prometheus Metrics Definitions
 *
 * Centralized metric definitions used across the application.
 * The /metrics endpoint is defined in routes/metrics.ts
 */

import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

// Create a new registry (don't use default to avoid conflicts)
export const metricsRegistry = new Registry();

// Collect default Node.js metrics (memory, CPU, etc.)
collectDefaultMetrics({ register: metricsRegistry });

// Request metrics
export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status'],
  registers: [metricsRegistry],
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry],
});

// Rate limiting metrics
export const rateLimitHitsTotal = new Counter({
  name: 'rate_limit_hits_total',
  help: 'Total number of rate limit hits',
  labelNames: ['type', 'key_type'],
  registers: [metricsRegistry],
});

// Quota metrics
export const quotaExceededTotal = new Counter({
  name: 'quota_exceeded_total',
  help: 'Total number of quota exceeded events',
  labelNames: ['user_id', 'quota_type'],
  registers: [metricsRegistry],
});

export const quotaUsageGauge = new Gauge({
  name: 'quota_usage_ratio',
  help: 'Current quota usage ratio (0-1)',
  labelNames: ['user_id', 'quota_type'],
  registers: [metricsRegistry],
});

// Run metrics
export const runsTotal = new Counter({
  name: 'runs_total',
  help: 'Total number of execution runs',
  labelNames: ['status', 'lane'],
  registers: [metricsRegistry],
});

export const runDuration = new Histogram({
  name: 'run_duration_seconds',
  help: 'Execution run duration in seconds',
  labelNames: ['status', 'lane'],
  buckets: [0.1, 0.5, 1, 2.5, 5, 10, 30, 60, 120],
  registers: [metricsRegistry],
});

// Circuit breaker metrics
export const circuitBreakerState = new Gauge({
  name: 'circuit_breaker_state',
  help: 'Circuit breaker state (0=closed, 1=half-open, 2=open)',
  labelNames: ['name'],
  registers: [metricsRegistry],
});

// Error metrics
export const errorsTotal = new Counter({
  name: 'errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'code'],
  registers: [metricsRegistry],
});

// Authentication metrics
export const authAttemptsTotal = new Counter({
  name: 'auth_attempts_total',
  help: 'Total number of authentication attempts',
  labelNames: ['result'],
  registers: [metricsRegistry],
});

// Secrets metrics
export const secretsOperationsTotal = new Counter({
  name: 'secrets_operations_total',
  help: 'Total number of secrets operations',
  labelNames: ['operation', 'result'],
  registers: [metricsRegistry],
});
