/**
 * Health Check Load Test Scenario
 *
 * Tests the health endpoint under load.
 * This is the simplest scenario and useful for baseline measurements.
 *
 * Run: k6 run tests/load/scenarios/health-check.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const healthCheckErrors = new Rate('health_check_errors');
const healthCheckDuration = new Trend('health_check_duration');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

// Scenario options (can be overridden by k6-config.js)
export const options = {
  scenarios: {
    health_check: {
      executor: __ENV.SCENARIO === 'load' ? 'constant-vus' : 'constant-vus',
      vus: __ENV.VUS ? parseInt(__ENV.VUS) : 1,
      duration: __ENV.DURATION || '30s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<100', 'p(99)<200'],
    health_check_errors: ['rate<0.01'],
    health_check_duration: ['p(95)<100'],
  },
};

export default function () {
  // Health check endpoint
  const healthRes = http.get(`${BASE_URL}/health`, {
    tags: { name: 'health_check' },
  });

  // Record custom metrics
  healthCheckDuration.add(healthRes.timings.duration);

  // Validate response
  const healthCheckPassed = check(healthRes, {
    'health status is 200': (r) => r.status === 200,
    'health response time < 100ms': (r) => r.timings.duration < 100,
    'health body contains status': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.status === 'ok' || body.status === 'healthy';
      } catch {
        return false;
      }
    },
  });

  healthCheckErrors.add(!healthCheckPassed);

  // Optional: Also test readiness endpoint if it exists
  const readyRes = http.get(`${BASE_URL}/ready`, {
    tags: { name: 'readiness_check' },
  });

  check(readyRes, {
    'ready status is 200 or 503': (r) => r.status === 200 || r.status === 503,
  });

  // Small sleep to prevent overwhelming the server during sustained tests
  sleep(0.1);
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'tests/load/results/health-check-summary.json': JSON.stringify(data, null, 2),
  };
}

// Simple text summary (k6 built-in is better, this is a fallback)
function textSummary(data, options) {
  const metrics = data.metrics;
  let output = '\n=== Health Check Load Test Summary ===\n\n';

  if (metrics.http_req_duration) {
    output += `Request Duration:\n`;
    output += `  avg: ${metrics.http_req_duration.values.avg.toFixed(2)}ms\n`;
    output += `  p95: ${metrics.http_req_duration.values['p(95)'].toFixed(2)}ms\n`;
    output += `  p99: ${metrics.http_req_duration.values['p(99)'].toFixed(2)}ms\n`;
  }

  if (metrics.http_reqs) {
    output += `\nTotal Requests: ${metrics.http_reqs.values.count}\n`;
    output += `Requests/sec: ${metrics.http_reqs.values.rate.toFixed(2)}\n`;
  }

  if (metrics.http_req_failed) {
    output += `\nError Rate: ${(metrics.http_req_failed.values.rate * 100).toFixed(2)}%\n`;
  }

  return output;
}
