// ABOUTME: Defines all Prometheus counters, histograms, and gauges for the control plane (HTTP, Modal, secrets, quotas, auth).
// ABOUTME: Provides helper functions to record metrics and a custom registry with default Node.js collectors.
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

// =============================================================================
// HTTP Request Metrics
// =============================================================================

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [metricsRegistry],
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry],
});

export const activeConnections = new Gauge({
  name: 'http_active_connections',
  help: 'Number of active HTTP connections',
  registers: [metricsRegistry],
});

// =============================================================================
// Modal Execution Metrics
// =============================================================================

export const modalExecutionDuration = new Histogram({
  name: 'modal_execution_duration_seconds',
  help: 'Modal function execution duration in seconds',
  labelNames: ['lane', 'status'],
  buckets: [0.1, 0.5, 1, 2.5, 5, 10, 30, 60, 120, 300],
  registers: [metricsRegistry],
});

// =============================================================================
// Secrets Metrics
// =============================================================================

export const secretsOperationsTotal = new Counter({
  name: 'secrets_operations_total',
  help: 'Total number of secrets operations',
  labelNames: ['operation', 'status'],
  registers: [metricsRegistry],
});

// =============================================================================
// Circuit Breaker Metrics
// =============================================================================

export const circuitBreakerState = new Gauge({
  name: 'circuit_breaker_state',
  help: 'Circuit breaker state (0=closed, 1=half-open, 2=open)',
  labelNames: ['name', 'state'],
  registers: [metricsRegistry],
});

// =============================================================================
// Rate Limiting Metrics
// =============================================================================

export const rateLimitHitsTotal = new Counter({
  name: 'rate_limit_hits_total',
  help: 'Total number of rate limit hits',
  labelNames: ['type', 'key_type'],
  registers: [metricsRegistry],
});

// =============================================================================
// Quota Metrics
// =============================================================================

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

// =============================================================================
// Run Metrics (legacy, use modalExecutionDuration for new code)
// =============================================================================

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

// =============================================================================
// Error Metrics
// =============================================================================

export const errorsTotal = new Counter({
  name: 'errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'code'],
  registers: [metricsRegistry],
});

// =============================================================================
// Authentication Metrics
// =============================================================================

export const authAttemptsTotal = new Counter({
  name: 'auth_attempts_total',
  help: 'Total number of authentication attempts',
  labelNames: ['result'],
  registers: [metricsRegistry],
});

// =============================================================================
// Helper Functions for Recording Metrics
// =============================================================================

/**
 * Record an HTTP request metric
 */
export function recordHttpRequest(
  method: string,
  route: string,
  status: number,
  durationSeconds: number
): void {
  const labels = { method, route, status: status.toString() };
  httpRequestsTotal.inc(labels);
  httpRequestDuration.observe(labels, durationSeconds);
}

/**
 * Increment active connections
 */
export function incrementActiveConnections(): void {
  activeConnections.inc();
}

/**
 * Decrement active connections
 */
export function decrementActiveConnections(): void {
  activeConnections.dec();
}

/**
 * Record a Modal execution metric
 */
export function recordModalExecution(
  lane: 'cpu' | 'gpu',
  status: 'success' | 'error' | 'timeout',
  durationSeconds: number
): void {
  modalExecutionDuration.observe({ lane, status }, durationSeconds);
}

/**
 * Record a secrets operation metric
 */
export function recordSecretsOperation(
  operation: 'create' | 'read' | 'update' | 'delete' | 'list',
  status: 'success' | 'error'
): void {
  secretsOperationsTotal.inc({ operation, status });
}

/**
 * Record circuit breaker state change
 */
export function recordCircuitBreakerState(
  name: string,
  state: 'closed' | 'half-open' | 'open'
): void {
  const stateValue = state === 'closed' ? 0 : state === 'half-open' ? 1 : 2;
  circuitBreakerState.set({ name, state }, stateValue);
}

/**
 * Normalize a URL path by replacing UUIDs and numeric IDs with placeholders
 */
export function normalizePath(path: string): string {
  return path
    .replace(/\/[a-f0-9-]{36}/gi, '/:id') // UUID
    .replace(/\/\d+/g, '/:id'); // Numeric ID
}
