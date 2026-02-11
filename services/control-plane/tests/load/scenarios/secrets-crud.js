/**
 * Secrets CRUD Load Test Scenario
 *
 * Tests secrets management operations under load.
 * Includes create, list, and delete operations.
 *
 * Run: k6 run tests/load/scenarios/secrets-crud.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

// Custom metrics
const secretsCreateErrors = new Rate('secrets_create_errors');
const secretsListErrors = new Rate('secrets_list_errors');
const secretsDeleteErrors = new Rate('secrets_delete_errors');
const secretsCreateDuration = new Trend('secrets_create_duration');
const secretsListDuration = new Trend('secrets_list_duration');
const secretsDeleteDuration = new Trend('secrets_delete_duration');
const secretsOperations = new Counter('secrets_operations');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';
const TEST_PROJECT_ID = __ENV.TEST_PROJECT_ID || 'test-project-id';

// Scenario options
export const options = {
  scenarios: {
    secrets_crud: {
      executor: 'constant-vus',
      vus: __ENV.VUS ? parseInt(__ENV.VUS) : 10,
      duration: __ENV.DURATION || '2m',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    secrets_create_duration: ['p(95)<500', 'p(99)<1000'],
    secrets_list_duration: ['p(95)<200', 'p(99)<500'],
    secrets_delete_duration: ['p(95)<300', 'p(99)<600'],
    secrets_create_errors: ['rate<0.05'],
    secrets_list_errors: ['rate<0.02'],
    secrets_delete_errors: ['rate<0.05'],
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

export function setup() {
  // Create a test project if needed, or use existing one
  console.log(`Using project ID: ${TEST_PROJECT_ID}`);
  console.log(`Base URL: ${BASE_URL}`);
  return { projectId: TEST_PROJECT_ID };
}

export default function (data) {
  const projectId = data.projectId;
  const secretKey = `TEST_SECRET_${randomString(8).toUpperCase()}`;
  const secretValue = `test-value-${randomString(16)}`;

  group('Secrets CRUD Operations', function () {
    // Step 1: Create a secret
    group('Create Secret', function () {
      const createPayload = JSON.stringify({
        key: secretKey,
        value: secretValue,
      });

      const createStart = Date.now();
      const createRes = http.post(
        `${BASE_URL}/projects/${projectId}/secrets`,
        createPayload,
        {
          headers: getHeaders(),
          tags: { name: 'create_secret' },
        }
      );
      const createDuration = Date.now() - createStart;

      secretsCreateDuration.add(createDuration);
      secretsOperations.add(1);

      const createPassed = check(createRes, {
        'create secret status is 201 or 400': (r) => r.status === 201 || r.status === 400,
        'create secret response has key': (r) => {
          if (r.status !== 201) return true; // Skip check for failures
          try {
            const body = JSON.parse(r.body);
            return body.key === secretKey;
          } catch {
            return false;
          }
        },
        'create secret response time < 500ms': (r) => r.timings.duration < 500,
      });

      secretsCreateErrors.add(!createPassed && createRes.status !== 400);
    });

    // Step 2: List secrets
    group('List Secrets', function () {
      const listStart = Date.now();
      const listRes = http.get(
        `${BASE_URL}/projects/${projectId}/secrets`,
        {
          headers: getHeaders(),
          tags: { name: 'list_secrets' },
        }
      );
      const listDuration = Date.now() - listStart;

      secretsListDuration.add(listDuration);
      secretsOperations.add(1);

      const listPassed = check(listRes, {
        'list secrets status is 200': (r) => r.status === 200,
        'list secrets returns array': (r) => {
          try {
            const body = JSON.parse(r.body);
            return Array.isArray(body.secrets);
          } catch {
            return false;
          }
        },
        'list secrets response time < 200ms': (r) => r.timings.duration < 200,
      });

      secretsListErrors.add(!listPassed);
    });

    // Step 3: Delete the secret (cleanup)
    group('Delete Secret', function () {
      const deleteStart = Date.now();
      const deleteRes = http.del(
        `${BASE_URL}/projects/${projectId}/secrets/${secretKey}`,
        null,
        {
          headers: getHeaders(),
          tags: { name: 'delete_secret' },
        }
      );
      const deleteDuration = Date.now() - deleteStart;

      secretsDeleteDuration.add(deleteDuration);
      secretsOperations.add(1);

      const deletePassed = check(deleteRes, {
        'delete secret status is 200 or 404': (r) => r.status === 200 || r.status === 404,
        'delete secret response time < 300ms': (r) => r.timings.duration < 300,
      });

      secretsDeleteErrors.add(!deletePassed);
    });
  });

  // Pause between iterations
  sleep(Math.random() * 0.5 + 0.25); // 0.25-0.75 seconds
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data),
    'tests/load/results/secrets-crud-summary.json': JSON.stringify(data, null, 2),
  };
}

function textSummary(data) {
  const metrics = data.metrics;
  let output = '\n=== Secrets CRUD Load Test Summary ===\n\n';

  if (metrics.secrets_operations) {
    output += `Total Operations: ${metrics.secrets_operations.values.count}\n`;
  }

  output += '\nCreate Secret:\n';
  if (metrics.secrets_create_duration) {
    output += `  avg: ${metrics.secrets_create_duration.values.avg.toFixed(2)}ms\n`;
    output += `  p95: ${metrics.secrets_create_duration.values['p(95)'].toFixed(2)}ms\n`;
  }
  if (metrics.secrets_create_errors) {
    output += `  errors: ${(metrics.secrets_create_errors.values.rate * 100).toFixed(2)}%\n`;
  }

  output += '\nList Secrets:\n';
  if (metrics.secrets_list_duration) {
    output += `  avg: ${metrics.secrets_list_duration.values.avg.toFixed(2)}ms\n`;
    output += `  p95: ${metrics.secrets_list_duration.values['p(95)'].toFixed(2)}ms\n`;
  }
  if (metrics.secrets_list_errors) {
    output += `  errors: ${(metrics.secrets_list_errors.values.rate * 100).toFixed(2)}%\n`;
  }

  output += '\nDelete Secret:\n';
  if (metrics.secrets_delete_duration) {
    output += `  avg: ${metrics.secrets_delete_duration.values.avg.toFixed(2)}ms\n`;
    output += `  p95: ${metrics.secrets_delete_duration.values['p(95)'].toFixed(2)}ms\n`;
  }
  if (metrics.secrets_delete_errors) {
    output += `  errors: ${(metrics.secrets_delete_errors.values.rate * 100).toFixed(2)}%\n`;
  }

  return output;
}
