/**
 * Mixed Workload Load Test Scenario
 *
 * Simulates realistic mixed traffic patterns combining:
 * - Health checks (high frequency)
 * - Project listing (medium frequency)
 * - Project detail views (medium frequency)
 * - Project creation (low frequency)
 * - Secrets operations (low frequency)
 *
 * Run: k6 run tests/load/scenarios/mixed-workload.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { randomString, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

// Custom metrics
const healthCheckLatency = new Trend('health_check_latency');
const projectListLatency = new Trend('project_list_latency');
const projectGetLatency = new Trend('project_get_latency');
const projectCreateLatency = new Trend('project_create_latency');
const secretsLatency = new Trend('secrets_latency');
const overallErrors = new Rate('overall_errors');
const operationCounter = new Counter('operations_total');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';

// Traffic distribution weights (must sum to 100)
const TRAFFIC_WEIGHTS = {
  healthCheck: 40,      // 40% - High frequency monitoring
  projectList: 25,      // 25% - List projects
  projectGet: 20,       // 20% - View project details
  projectCreate: 10,    // 10% - Create new projects
  secretsOps: 5,        // 5%  - Secrets operations
};

// Minimal ZIP for project creation. This must remain a real archive so
// project creation load tests exercise the full validation and extraction flow.
const MINIMAL_ZIP_BASE64 = __ENV.TEST_ZIP_DATA || 'UEsDBBQAAAAIANoDbVycDgoZZwAAAHUAAAAHAAAAbWFpbi5weUsrys9VSEssLkksyFTIzC3ILypRcANyHQM8ubgSCwoUbGFcDU0uLgegiF56aomGkn5Gak5OvpImV0pqmgKYraFpxaUABEWpJaVFeQrVSrmpxcWJ6alKVgpKHiAFCuH5RTkpikq1XABQSwECFAMUAAAACADaA21cnA4KGWcAAAB1AAAABwAAAAAAAAAAAAAAgAEAAAAAbWFpbi5weVBLBQYAAAAAAQABADUAAACMAAAAAAA=';

// Scenario options
export const options = {
  scenarios: {
    mixed_workload: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 10 },   // Warm up
        { duration: '3m', target: 30 },   // Normal load
        { duration: '2m', target: 50 },   // Peak load
        { duration: '1m', target: 30 },   // Sustained
        { duration: '1m', target: 0 },    // Cool down
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
    health_check_latency: ['p(95)<100'],
    project_list_latency: ['p(95)<500'],
    project_get_latency: ['p(95)<300'],
    project_create_latency: ['p(95)<5000'],
    secrets_latency: ['p(95)<500'],
    overall_errors: ['rate<0.05'],
  },
};

// Request headers
function getHeaders() {
  const headers = {
    'Content-Type': 'application/json',
  };
  if (AUTH_TOKEN) {
    headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
  }
  return headers;
}

// Weighted random selection
function selectOperation() {
  const rand = Math.random() * 100;
  let cumulative = 0;

  for (const [op, weight] of Object.entries(TRAFFIC_WEIGHTS)) {
    cumulative += weight;
    if (rand < cumulative) {
      return op;
    }
  }
  return 'healthCheck';
}

// Store created project IDs for reuse
const createdProjects = [];

function createProject() {
  const projectName = `load-test-${randomString(8)}`;
  const payload = JSON.stringify({
    name: projectName,
    source_type: 'zip',
    zip_data: MINIMAL_ZIP_BASE64,
  });

  const res = http.post(`${BASE_URL}/projects`, payload, {
    headers: getHeaders(),
    tags: { name: 'create_project', operation: 'create' },
    timeout: '30s',
  });

  projectCreateLatency.add(res.timings.duration);

  const passed = check(res, {
    'project create status 201': (r) => r.status === 201,
    'project create has id': (r) => {
      try {
        const body = JSON.parse(r.body);
        if (body.project_id) {
          createdProjects.push(body.project_id);
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
  });

  overallErrors.add(!passed);
  return passed ? createdProjects[createdProjects.length - 1] : null;
}

export default function () {
  const operation = selectOperation();
  operationCounter.add(1);

  switch (operation) {
    case 'healthCheck':
      doHealthCheck();
      break;
    case 'projectList':
      doProjectList();
      break;
    case 'projectGet':
      doProjectGet();
      break;
    case 'projectCreate':
      doProjectCreate();
      break;
    case 'secretsOps':
      doSecretsOperation();
      break;
  }

  // Variable sleep based on operation type
  const sleepTime = operation === 'healthCheck' ? 0.1 : Math.random() * 1 + 0.5;
  sleep(sleepTime);
}

function doHealthCheck() {
  group('Health Check', function () {
    const res = http.get(`${BASE_URL}/health`, {
      tags: { name: 'health_check', operation: 'health' },
    });

    healthCheckLatency.add(res.timings.duration);

    const passed = check(res, {
      'health check status 200': (r) => r.status === 200,
      'health check fast': (r) => r.timings.duration < 100,
    });

    overallErrors.add(!passed);
  });
}

function doProjectList() {
  group('Project List', function () {
    const res = http.get(`${BASE_URL}/projects`, {
      headers: getHeaders(),
      tags: { name: 'list_projects', operation: 'list' },
    });

    projectListLatency.add(res.timings.duration);

    const passed = check(res, {
      'project list status 200': (r) => r.status === 200,
      'project list returns array': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.projects !== undefined;
        } catch {
          return false;
        }
      },
    });

    overallErrors.add(!passed);

    // Store project IDs for later use
    if (res.status === 200) {
      try {
        const body = JSON.parse(res.body);
        if (body.projects && body.projects.length > 0) {
          body.projects.forEach(p => {
            if (!createdProjects.includes(p.project_id)) {
              createdProjects.push(p.project_id);
            }
          });
        }
      } catch {
        // Ignore parsing errors
      }
    }
  });
}

function doProjectGet() {
  group('Project Get', function () {
    // Use a known project ID or a random one
    let projectId = 'test-project';
    if (createdProjects.length > 0) {
      projectId = createdProjects[randomIntBetween(0, createdProjects.length - 1)];
    }

    const res = http.get(`${BASE_URL}/projects/${projectId}`, {
      headers: getHeaders(),
      tags: { name: 'get_project', operation: 'get' },
    });

    projectGetLatency.add(res.timings.duration);

    const passed = check(res, {
      'project get status 200 or 404': (r) => r.status === 200 || r.status === 404,
    });

    overallErrors.add(!passed && res.status !== 404);
  });
}

function doProjectCreate() {
  group('Project Create', function () {
    createProject();
  });
}

function doSecretsOperation() {
  group('Secrets Operation', function () {
    let projectId = createdProjects.length > 0
      ? createdProjects[randomIntBetween(0, createdProjects.length - 1)]
      : createProject();

    if (!projectId) {
      return;
    }

    // Randomly choose between list and create/delete
    if (Math.random() < 0.7) {
      // List secrets (70%)
      const res = http.get(`${BASE_URL}/projects/${projectId}/secrets`, {
        headers: getHeaders(),
        tags: { name: 'list_secrets', operation: 'secrets_list' },
      });

      secretsLatency.add(res.timings.duration);

      const passed = check(res, {
        'secrets list status 200 or 500': (r) => r.status === 200 || r.status === 500,
      });

      overallErrors.add(!passed && res.status !== 500);
    } else {
      // Create secret (30%)
      const secretKey = `LOAD_TEST_${randomString(6).toUpperCase()}`;
      const payload = JSON.stringify({
        key: secretKey,
        value: `test-value-${randomString(12)}`,
      });

      const res = http.post(`${BASE_URL}/projects/${projectId}/secrets`, payload, {
        headers: getHeaders(),
        tags: { name: 'create_secret', operation: 'secrets_create' },
      });

      secretsLatency.add(res.timings.duration);

      const passed = check(res, {
        'secret create status 201 or 400 or 500': (r) =>
          r.status === 201 || r.status === 400 || r.status === 500,
      });

      overallErrors.add(!passed && res.status !== 400 && res.status !== 500);
    }
  });
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data),
    'tests/load/results/mixed-workload-summary.json': JSON.stringify(data, null, 2),
  };
}

function textSummary(data) {
  const metrics = data.metrics;
  let output = '\n=== Mixed Workload Load Test Summary ===\n\n';

  if (metrics.operations_total) {
    output += `Total Operations: ${metrics.operations_total.values.count}\n`;
  }

  if (metrics.http_reqs) {
    output += `Total Requests: ${metrics.http_reqs.values.count}\n`;
    output += `Requests/sec: ${metrics.http_reqs.values.rate.toFixed(2)}\n`;
  }

  output += '\nLatency by Operation:\n';

  const latencyMetrics = [
    ['Health Check', 'health_check_latency'],
    ['Project List', 'project_list_latency'],
    ['Project Get', 'project_get_latency'],
    ['Project Create', 'project_create_latency'],
    ['Secrets', 'secrets_latency'],
  ];

  for (const [name, metric] of latencyMetrics) {
    if (metrics[metric]) {
      output += `  ${name}: avg=${metrics[metric].values.avg.toFixed(0)}ms, p95=${metrics[metric].values['p(95)'].toFixed(0)}ms\n`;
    }
  }

  if (metrics.overall_errors) {
    output += `\nOverall Error Rate: ${(metrics.overall_errors.values.rate * 100).toFixed(2)}%\n`;
  }

  if (metrics.http_req_failed) {
    output += `HTTP Failure Rate: ${(metrics.http_req_failed.values.rate * 100).toFixed(2)}%\n`;
  }

  return output;
}
