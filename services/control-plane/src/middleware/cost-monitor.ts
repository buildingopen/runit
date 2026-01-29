/**
 * Cost monitoring middleware
 *
 * Tracks basic metrics for cost analysis:
 * - Run count by lane (CPU/GPU)
 * - Duration aggregates
 * - Resource usage patterns
 *
 * Logs metrics to console/file for analysis
 */

interface RunMetric {
  runId: string;
  userId: string;
  projectId: string;
  lane: 'cpu' | 'gpu';
  duration: number;
  status: 'success' | 'error' | 'timeout';
  timestamp: number;
}

interface AggregateMetrics {
  cpu: {
    totalRuns: number;
    totalDuration: number;
    successRate: number;
    avgDuration: number;
    p50Duration: number;
    p95Duration: number;
    p99Duration: number;
  };
  gpu: {
    totalRuns: number;
    totalDuration: number;
    successRate: number;
    avgDuration: number;
    p50Duration: number;
    p95Duration: number;
    p99Duration: number;
  };
  period: {
    start: string;
    end: string;
  };
}

// In-memory metrics buffer
const metricsBuffer: RunMetric[] = [];
const MAX_BUFFER_SIZE = 10000;

/**
 * Track run metric
 */
export function trackRunMetric(metric: RunMetric) {
  metricsBuffer.push(metric);

  // Prevent unbounded growth
  if (metricsBuffer.length > MAX_BUFFER_SIZE) {
    // Remove oldest 1000 entries
    metricsBuffer.splice(0, 1000);
  }

  // Log metric (structured logging)
  logMetric(metric);
}

/**
 * Log metric to console/file
 */
function logMetric(metric: RunMetric) {
  const logEntry = {
    type: 'run_metric',
    timestamp: new Date(metric.timestamp).toISOString(),
    run_id: metric.runId,
    user_id: metric.userId,
    project_id: metric.projectId,
    lane: metric.lane,
    duration_ms: metric.duration,
    status: metric.status,
  };

  // Log to console (structured JSON)
  console.log(JSON.stringify(logEntry));

  // v1 enhancement: Integrate with monitoring service (DataDog, CloudWatch, etc.)
}

/**
 * Calculate percentile from sorted array
 */
function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;

  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Get aggregate metrics for a time period
 */
export function getAggregateMetrics(
  startTime?: number,
  endTime?: number
): AggregateMetrics {
  const now = Date.now();
  const start = startTime || now - 3600000; // Last hour by default
  const end = endTime || now;

  // Filter metrics in time range
  const metrics = metricsBuffer.filter(
    (m) => m.timestamp >= start && m.timestamp <= end
  );

  // Split by lane
  const cpuMetrics = metrics.filter((m) => m.lane === 'cpu');
  const gpuMetrics = metrics.filter((m) => m.lane === 'gpu');

  // Calculate CPU stats
  const cpuDurations = cpuMetrics.map((m) => m.duration);
  const cpuSuccesses = cpuMetrics.filter((m) => m.status === 'success').length;

  const cpuStats = {
    totalRuns: cpuMetrics.length,
    totalDuration: cpuDurations.reduce((sum, d) => sum + d, 0),
    successRate: cpuMetrics.length > 0 ? (cpuSuccesses / cpuMetrics.length) * 100 : 0,
    avgDuration: cpuDurations.length > 0
      ? cpuDurations.reduce((sum, d) => sum + d, 0) / cpuDurations.length
      : 0,
    p50Duration: percentile(cpuDurations, 50),
    p95Duration: percentile(cpuDurations, 95),
    p99Duration: percentile(cpuDurations, 99),
  };

  // Calculate GPU stats
  const gpuDurations = gpuMetrics.map((m) => m.duration);
  const gpuSuccesses = gpuMetrics.filter((m) => m.status === 'success').length;

  const gpuStats = {
    totalRuns: gpuMetrics.length,
    totalDuration: gpuDurations.reduce((sum, d) => sum + d, 0),
    successRate: gpuMetrics.length > 0 ? (gpuSuccesses / gpuMetrics.length) * 100 : 0,
    avgDuration: gpuDurations.length > 0
      ? gpuDurations.reduce((sum, d) => sum + d, 0) / gpuDurations.length
      : 0,
    p50Duration: percentile(gpuDurations, 50),
    p95Duration: percentile(gpuDurations, 95),
    p99Duration: percentile(gpuDurations, 99),
  };

  return {
    cpu: cpuStats,
    gpu: gpuStats,
    period: {
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString(),
    },
  };
}

/**
 * Get metrics by user
 */
export function getUserMetrics(userId: string, hours = 24): any {
  const now = Date.now();
  const start = now - hours * 3600000;

  const userMetrics = metricsBuffer.filter(
    (m) => m.userId === userId && m.timestamp >= start
  );

  const cpuMetrics = userMetrics.filter((m) => m.lane === 'cpu');
  const gpuMetrics = userMetrics.filter((m) => m.lane === 'gpu');

  return {
    userId,
    period: {
      hours,
      start: new Date(start).toISOString(),
      end: new Date(now).toISOString(),
    },
    cpu: {
      runs: cpuMetrics.length,
      totalDuration: cpuMetrics.reduce((sum, m) => sum + m.duration, 0),
      avgDuration: cpuMetrics.length > 0
        ? cpuMetrics.reduce((sum, m) => sum + m.duration, 0) / cpuMetrics.length
        : 0,
    },
    gpu: {
      runs: gpuMetrics.length,
      totalDuration: gpuMetrics.reduce((sum, m) => sum + m.duration, 0),
      avgDuration: gpuMetrics.length > 0
        ? gpuMetrics.reduce((sum, m) => sum + m.duration, 0) / gpuMetrics.length
        : 0,
    },
    totalRuns: userMetrics.length,
  };
}

/**
 * Get metrics by project
 */
export function getProjectMetrics(projectId: string, hours = 24): any {
  const now = Date.now();
  const start = now - hours * 3600000;

  const projectMetrics = metricsBuffer.filter(
    (m) => m.projectId === projectId && m.timestamp >= start
  );

  const cpuMetrics = projectMetrics.filter((m) => m.lane === 'cpu');
  const gpuMetrics = projectMetrics.filter((m) => m.lane === 'gpu');

  return {
    projectId,
    period: {
      hours,
      start: new Date(start).toISOString(),
      end: new Date(now).toISOString(),
    },
    cpu: {
      runs: cpuMetrics.length,
      totalDuration: cpuMetrics.reduce((sum, m) => sum + m.duration, 0),
    },
    gpu: {
      runs: gpuMetrics.length,
      totalDuration: gpuMetrics.reduce((sum, m) => sum + m.duration, 0),
    },
    totalRuns: projectMetrics.length,
  };
}

/**
 * Express middleware to track run completion
 */
export function costMonitorMiddleware(req: any, res: any, next: any) {
  // Add tracking hook to response
  const originalJson = res.json.bind(res);

  res.json = function (data: any) {
    // Track metric if this is a run result
    if (data.run_id && data.duration_ms) {
      trackRunMetric({
        runId: data.run_id,
        userId: req.user?.id || 'anonymous',
        projectId: data.project_id || 'unknown',
        lane: data.lane || 'cpu',
        duration: data.duration_ms,
        status: data.status || 'success',
        timestamp: Date.now(),
      });
    }

    return originalJson(data);
  };

  next();
}

/**
 * Generate cost report
 */
export function generateCostReport(hours = 24): string {
  const metrics = getAggregateMetrics(Date.now() - hours * 3600000);

  const report = `
Cost Report (Last ${hours} hours)
=====================================

CPU Lane:
  - Total Runs: ${metrics.cpu.totalRuns}
  - Total Duration: ${(metrics.cpu.totalDuration / 1000).toFixed(2)}s
  - Avg Duration: ${(metrics.cpu.avgDuration / 1000).toFixed(2)}s
  - Success Rate: ${metrics.cpu.successRate.toFixed(1)}%
  - P50: ${(metrics.cpu.p50Duration / 1000).toFixed(2)}s
  - P95: ${(metrics.cpu.p95Duration / 1000).toFixed(2)}s
  - P99: ${(metrics.cpu.p99Duration / 1000).toFixed(2)}s

GPU Lane:
  - Total Runs: ${metrics.gpu.totalRuns}
  - Total Duration: ${(metrics.gpu.totalDuration / 1000).toFixed(2)}s
  - Avg Duration: ${(metrics.gpu.avgDuration / 1000).toFixed(2)}s
  - Success Rate: ${metrics.gpu.successRate.toFixed(1)}%
  - P50: ${(metrics.gpu.p50Duration / 1000).toFixed(2)}s
  - P95: ${(metrics.gpu.p95Duration / 1000).toFixed(2)}s
  - P99: ${(metrics.gpu.p99Duration / 1000).toFixed(2)}s

Period: ${metrics.period.start} to ${metrics.period.end}
`;

  return report;
}

/**
 * Clear metrics buffer (for testing)
 */
export function clearMetrics() {
  metricsBuffer.length = 0;
}

export default {
  trackRunMetric,
  getAggregateMetrics,
  getUserMetrics,
  getProjectMetrics,
  costMonitorMiddleware,
  generateCostReport,
  clearMetrics,
};
