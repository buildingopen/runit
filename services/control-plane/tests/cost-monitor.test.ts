import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearMetrics,
  costMonitorMiddleware,
  generateCostReport,
  getAggregateMetrics,
  getProjectMetrics,
  getUserMetrics,
  trackRunMetric,
} from '../src/middleware/cost-monitor';

describe('cost-monitor', () => {
  beforeEach(() => {
    clearMetrics();
    vi.restoreAllMocks();
  });

  it('tracks metrics and computes aggregate percentiles/success rates', () => {
    const now = Date.now();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    trackRunMetric({
      runId: 'r1',
      userId: 'u1',
      projectId: 'p1',
      lane: 'cpu',
      duration: 1000,
      status: 'success',
      timestamp: now - 10,
    });
    trackRunMetric({
      runId: 'r2',
      userId: 'u1',
      projectId: 'p1',
      lane: 'cpu',
      duration: 3000,
      status: 'error',
      timestamp: now - 5,
    });
    trackRunMetric({
      runId: 'r3',
      userId: 'u2',
      projectId: 'p2',
      lane: 'gpu',
      duration: 5000,
      status: 'success',
      timestamp: now - 1,
    });

    const aggregate = getAggregateMetrics(now - 60_000, now + 60_000);
    expect(aggregate.cpu.totalRuns).toBe(2);
    expect(aggregate.cpu.totalDuration).toBe(4000);
    expect(aggregate.cpu.successRate).toBe(50);
    expect(aggregate.cpu.avgDuration).toBe(2000);
    expect(aggregate.cpu.p50Duration).toBe(1000);
    expect(aggregate.cpu.p95Duration).toBe(3000);
    expect(aggregate.gpu.totalRuns).toBe(1);
    expect(aggregate.gpu.successRate).toBe(100);
    expect(aggregate.period.start).toContain('T');

    expect(logSpy).toHaveBeenCalled();
  });

  it('returns zero aggregate values when no metrics are present in range', () => {
    const now = Date.now();
    const aggregate = getAggregateMetrics(now - 10_000, now - 5_000);
    expect(aggregate.cpu.totalRuns).toBe(0);
    expect(aggregate.cpu.p99Duration).toBe(0);
    expect(aggregate.gpu.totalRuns).toBe(0);
    expect(aggregate.gpu.avgDuration).toBe(0);
  });

  it('computes user/project metrics and report output', () => {
    const now = Date.now();
    trackRunMetric({
      runId: 'r1',
      userId: 'u1',
      projectId: 'p1',
      lane: 'cpu',
      duration: 2000,
      status: 'success',
      timestamp: now - 1000,
    });
    trackRunMetric({
      runId: 'r2',
      userId: 'u1',
      projectId: 'p1',
      lane: 'gpu',
      duration: 6000,
      status: 'success',
      timestamp: now - 900,
    });
    trackRunMetric({
      runId: 'r3',
      userId: 'u2',
      projectId: 'p2',
      lane: 'cpu',
      duration: 3000,
      status: 'error',
      timestamp: now - 800,
    });

    const user = getUserMetrics('u1', 24);
    expect(user.totalRuns).toBe(2);
    expect(user.cpu.runs).toBe(1);
    expect(user.gpu.runs).toBe(1);

    const project = getProjectMetrics('p1', 24);
    expect(project.totalRuns).toBe(2);
    expect(project.cpu.totalDuration).toBe(2000);
    expect(project.gpu.totalDuration).toBe(6000);

    const report = generateCostReport(24);
    expect(report).toContain('Cost Report (Last 24 hours)');
    expect(report).toContain('CPU Lane:');
    expect(report).toContain('GPU Lane:');
  });

  it('tracks run from express middleware response hook', () => {
    const next = vi.fn();
    const req = { body: { run_id: 'ignored' }, user: { id: 'u1' } };
    const originalJson = vi.fn().mockImplementation((d: unknown) => d);
    const res = { json: originalJson };

    costMonitorMiddleware(req, res, next);
    expect(next).toHaveBeenCalledOnce();

    const payload = {
      run_id: 'r1',
      project_id: 'p1',
      duration_ms: 1234,
      lane: 'gpu' as const,
      status: 'timeout' as const,
    };
    const returned = res.json(payload);
    expect(returned).toBe(payload);

    const aggregate = getAggregateMetrics(Date.now() - 60_000, Date.now() + 60_000);
    expect(aggregate.gpu.totalRuns).toBe(1);
    expect(aggregate.gpu.totalDuration).toBe(1234);
  });

  it('trims old metrics when buffer exceeds max size', () => {
    const now = Date.now();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    for (let i = 0; i < 10005; i++) {
      trackRunMetric({
        runId: `r-${i}`,
        userId: 'u1',
        projectId: 'p1',
        lane: 'cpu',
        duration: 1,
        status: 'success',
        timestamp: now - i,
      });
    }

    const aggregate = getAggregateMetrics(now - 100_000, now + 100_000);
    expect(aggregate.cpu.totalRuns).toBeLessThanOrEqual(10000);
    expect(logSpy).toHaveBeenCalled();
  });
});
