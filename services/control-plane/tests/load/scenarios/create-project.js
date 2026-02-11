/**
 * Create Project Load Test Scenario
 *
 * Tests the project creation flow under load.
 * This includes ZIP upload and OpenAPI extraction.
 *
 * Run: k6 run tests/load/scenarios/create-project.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

// Custom metrics
const projectCreationErrors = new Rate('project_creation_errors');
const projectCreationDuration = new Trend('project_creation_duration');
const projectsCreated = new Counter('projects_created');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';

// Minimal valid ZIP file (base64 encoded) - empty FastAPI app
// This is a minimal ZIP containing a simple Python file
const MINIMAL_ZIP_BASE64 = __ENV.TEST_ZIP_DATA || 'UEsDBBQAAAAIAAAAAACPT0YfKwAAAC8AAAAHABwAbWFpbi5weVVUCQADAAAAAAAAAAAAdXgLAAEE6AMAAAToAwAAKypKTc7PS8nMS1eyUCguSUzKSizJzM+zAgBQSwECHgMUAAAACAAAAAAEj09GHysAAAAvAAAABwAYAAAAAAAAAQAAAKSBAAAAAG1haW4ucHlVVAUAAwAAAAB1eAsAAQToAwAABOgDAABQSwUGAAAAAAEAAQBNAAAAZgAAAAAA';

// Scenario options
export const options = {
  scenarios: {
    create_project: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 5 },   // Warm up
        { duration: '2m', target: 10 },   // Sustained load
        { duration: '30s', target: 0 },   // Cool down
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    project_creation_duration: ['p(95)<5000', 'p(99)<10000'],  // Project creation can be slow
    project_creation_errors: ['rate<0.05'],
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

export default function () {
  group('Project Creation Flow', function () {
    const projectName = `load-test-project-${randomString(8)}`;

    // Step 1: Create a new project
    const createPayload = JSON.stringify({
      name: projectName,
      source_type: 'zip',
      zip_data: MINIMAL_ZIP_BASE64,
    });

    const createStart = Date.now();
    const createRes = http.post(`${BASE_URL}/projects`, createPayload, {
      headers: getHeaders(),
      tags: { name: 'create_project' },
      timeout: '30s',
    });
    const createDuration = Date.now() - createStart;

    // Record metrics
    projectCreationDuration.add(createDuration);

    const createPassed = check(createRes, {
      'create project status is 201': (r) => r.status === 201,
      'create project response has project_id': (r) => {
        try {
          const body = JSON.parse(r.body);
          return !!body.project_id;
        } catch {
          return false;
        }
      },
      'create project response time < 5s': (r) => r.timings.duration < 5000,
    });

    projectCreationErrors.add(!createPassed);

    if (createPassed) {
      projectsCreated.add(1);
      const projectData = JSON.parse(createRes.body);
      const projectId = projectData.project_id;

      // Step 2: Verify project exists by fetching it
      const getRes = http.get(`${BASE_URL}/projects/${projectId}`, {
        headers: getHeaders(),
        tags: { name: 'get_project' },
      });

      check(getRes, {
        'get project status is 200': (r) => r.status === 200,
        'get project returns correct id': (r) => {
          try {
            const body = JSON.parse(r.body);
            return body.project_id === projectId;
          } catch {
            return false;
          }
        },
      });

      // Step 3: List endpoints (if OpenAPI extraction worked)
      const endpointsRes = http.get(`${BASE_URL}/projects/${projectId}/endpoints`, {
        headers: getHeaders(),
        tags: { name: 'list_endpoints' },
      });

      check(endpointsRes, {
        'list endpoints returns 200 or 400': (r) => r.status === 200 || r.status === 400,
      });

      // Step 4: Clean up - delete the project
      const deleteRes = http.del(`${BASE_URL}/projects/${projectId}`, null, {
        headers: getHeaders(),
        tags: { name: 'delete_project' },
      });

      check(deleteRes, {
        'delete project status is 200 or 401': (r) => r.status === 200 || r.status === 401,
      });
    }
  });

  // Pause between iterations to simulate realistic usage
  sleep(Math.random() * 2 + 1); // 1-3 seconds
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data),
    'tests/load/results/create-project-summary.json': JSON.stringify(data, null, 2),
  };
}

function textSummary(data) {
  const metrics = data.metrics;
  let output = '\n=== Create Project Load Test Summary ===\n\n';

  if (metrics.projects_created) {
    output += `Projects Created: ${metrics.projects_created.values.count}\n`;
  }

  if (metrics.project_creation_duration) {
    output += `\nProject Creation Duration:\n`;
    output += `  avg: ${metrics.project_creation_duration.values.avg.toFixed(2)}ms\n`;
    output += `  p95: ${metrics.project_creation_duration.values['p(95)'].toFixed(2)}ms\n`;
  }

  if (metrics.project_creation_errors) {
    output += `\nError Rate: ${(metrics.project_creation_errors.values.rate * 100).toFixed(2)}%\n`;
  }

  return output;
}
