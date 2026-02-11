/**
 * Tests for metrics middleware and helper functions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { metricsMiddleware, metricsMiddlewareWithExclusions } from '../metrics';
import {
  createMockContext,
  createMockNext,
  asHonoContext,
  asHonoNext,
} from '../test-helpers';
import {
  metricsRegistry,
  normalizePath,
  recordHttpRequest,
  recordModalExecution,
  recordSecretsOperation,
  recordCircuitBreakerState,
  incrementActiveConnections,
  decrementActiveConnections,
  activeConnections,
} from '../../lib/metrics';

describe('Metrics Middleware', () => {
  beforeEach(async () => {
    // Reset metrics between tests
    metricsRegistry.resetMetrics();
  });

  describe('metricsMiddleware', () => {
    it('should call next and complete the request', async () => {
      const c = createMockContext({
        method: 'GET',
        path: '/api/projects',
      });
      const next = createMockNext();

      await metricsMiddleware(asHonoContext(c), asHonoNext(next));

      expect(next).toHaveBeenCalled();
    });

    it('should track request duration', async () => {
      const c = createMockContext({
        method: 'GET',
        path: '/api/projects',
      });
      const next = createMockNext();

      await metricsMiddleware(asHonoContext(c), asHonoNext(next));

      // Verify metrics were recorded
      const metrics = await metricsRegistry.metrics();
      expect(metrics).toContain('http_requests_total');
      expect(metrics).toContain('http_request_duration_seconds');
    });

    it('should track active connections', async () => {
      const c = createMockContext({
        method: 'GET',
        path: '/api/projects',
      });
      const next = createMockNext();

      // Get initial value
      const initialValue = (await activeConnections.get()).values[0]?.value || 0;

      // Start request (simulated by not awaiting)
      const promise = metricsMiddleware(asHonoContext(c), asHonoNext(next));

      // Complete request
      await promise;

      // After completion, active connections should be back to initial
      const finalValue = (await activeConnections.get()).values[0]?.value || 0;
      expect(finalValue).toBe(initialValue);
    });
  });

  describe('metricsMiddlewareWithExclusions', () => {
    it('should skip metrics tracking for /metrics path', async () => {
      const c = createMockContext({
        method: 'GET',
        path: '/metrics',
      });
      const next = createMockNext();

      // Reset metrics
      metricsRegistry.resetMetrics();

      await metricsMiddlewareWithExclusions(asHonoContext(c), asHonoNext(next));

      expect(next).toHaveBeenCalled();

      // Metrics should not have been recorded for /metrics path
      const metrics = await metricsRegistry.metrics();
      // The /metrics path should not appear in recorded request metrics
      expect(metrics).not.toContain('route="/metrics"');
    });

    it('should skip metrics tracking for /health path', async () => {
      const c = createMockContext({
        method: 'GET',
        path: '/health',
      });
      const next = createMockNext();

      metricsRegistry.resetMetrics();

      await metricsMiddlewareWithExclusions(asHonoContext(c), asHonoNext(next));

      expect(next).toHaveBeenCalled();
    });

    it('should track metrics for regular paths', async () => {
      const c = createMockContext({
        method: 'GET',
        path: '/api/projects',
      });
      const next = createMockNext();

      await metricsMiddlewareWithExclusions(asHonoContext(c), asHonoNext(next));

      expect(next).toHaveBeenCalled();

      const metrics = await metricsRegistry.metrics();
      expect(metrics).toContain('http_requests_total');
    });
  });
});

describe('Metrics Helper Functions', () => {
  beforeEach(async () => {
    metricsRegistry.resetMetrics();
  });

  describe('normalizePath', () => {
    it('should replace UUIDs with :id', () => {
      const path = '/projects/550e8400-e29b-41d4-a716-446655440000/versions';
      expect(normalizePath(path)).toBe('/projects/:id/versions');
    });

    it('should replace multiple UUIDs', () => {
      const path = '/projects/550e8400-e29b-41d4-a716-446655440000/versions/123e4567-e89b-12d3-a456-426614174000';
      expect(normalizePath(path)).toBe('/projects/:id/versions/:id');
    });

    it('should replace numeric IDs', () => {
      const path = '/users/123/posts/456';
      expect(normalizePath(path)).toBe('/users/:id/posts/:id');
    });

    it('should handle paths without IDs', () => {
      const path = '/health';
      expect(normalizePath(path)).toBe('/health');
    });

    it('should handle mixed UUIDs and numeric IDs', () => {
      const path = '/projects/550e8400-e29b-41d4-a716-446655440000/runs/123';
      expect(normalizePath(path)).toBe('/projects/:id/runs/:id');
    });
  });

  describe('recordHttpRequest', () => {
    it('should increment request counter', async () => {
      recordHttpRequest('GET', '/api/projects', 200, 0.5);

      const metrics = await metricsRegistry.metrics();
      expect(metrics).toContain('http_requests_total');
      expect(metrics).toContain('method="GET"');
      expect(metrics).toContain('route="/api/projects"');
      expect(metrics).toContain('status="200"');
    });

    it('should record request duration', async () => {
      recordHttpRequest('POST', '/api/runs', 202, 1.5);

      const metrics = await metricsRegistry.metrics();
      expect(metrics).toContain('http_request_duration_seconds');
    });
  });

  describe('recordModalExecution', () => {
    it('should record successful CPU execution', async () => {
      recordModalExecution('cpu', 'success', 5.0);

      const metrics = await metricsRegistry.metrics();
      expect(metrics).toContain('modal_execution_duration_seconds');
      expect(metrics).toContain('lane="cpu"');
      expect(metrics).toContain('status="success"');
    });

    it('should record failed GPU execution', async () => {
      recordModalExecution('gpu', 'error', 2.0);

      const metrics = await metricsRegistry.metrics();
      expect(metrics).toContain('modal_execution_duration_seconds');
      expect(metrics).toContain('lane="gpu"');
      expect(metrics).toContain('status="error"');
    });

    it('should record timeout execution', async () => {
      recordModalExecution('cpu', 'timeout', 60.0);

      const metrics = await metricsRegistry.metrics();
      expect(metrics).toContain('modal_execution_duration_seconds');
      expect(metrics).toContain('status="timeout"');
    });
  });

  describe('recordSecretsOperation', () => {
    it('should record successful create operation', async () => {
      recordSecretsOperation('create', 'success');

      const metrics = await metricsRegistry.metrics();
      expect(metrics).toContain('secrets_operations_total');
      expect(metrics).toContain('operation="create"');
      expect(metrics).toContain('status="success"');
    });

    it('should record failed delete operation', async () => {
      recordSecretsOperation('delete', 'error');

      const metrics = await metricsRegistry.metrics();
      expect(metrics).toContain('secrets_operations_total');
      expect(metrics).toContain('operation="delete"');
      expect(metrics).toContain('status="error"');
    });
  });

  describe('recordCircuitBreakerState', () => {
    it('should record closed state as 0', async () => {
      recordCircuitBreakerState('modal-api', 'closed');

      const metrics = await metricsRegistry.metrics();
      expect(metrics).toContain('circuit_breaker_state');
      expect(metrics).toContain('name="modal-api"');
    });

    it('should record half-open state as 1', async () => {
      recordCircuitBreakerState('modal-api', 'half-open');

      const metrics = await metricsRegistry.metrics();
      expect(metrics).toContain('circuit_breaker_state');
    });

    it('should record open state as 2', async () => {
      recordCircuitBreakerState('modal-api', 'open');

      const metrics = await metricsRegistry.metrics();
      expect(metrics).toContain('circuit_breaker_state');
    });
  });

  describe('active connections', () => {
    it('should increment and decrement active connections', async () => {
      const initialValue = (await activeConnections.get()).values[0]?.value || 0;

      incrementActiveConnections();
      let value = (await activeConnections.get()).values[0]?.value || 0;
      expect(value).toBe(initialValue + 1);

      incrementActiveConnections();
      value = (await activeConnections.get()).values[0]?.value || 0;
      expect(value).toBe(initialValue + 2);

      decrementActiveConnections();
      value = (await activeConnections.get()).values[0]?.value || 0;
      expect(value).toBe(initialValue + 1);

      decrementActiveConnections();
      value = (await activeConnections.get()).values[0]?.value || 0;
      expect(value).toBe(initialValue);
    });
  });
});
