/**
 * k6 Load Test Configuration
 *
 * This file defines the load test scenarios for the control-plane service.
 * Run with: k6 run tests/load/k6-config.js --env SCENARIO=<scenario-name>
 */

// Environment variables
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const SCENARIO = __ENV.SCENARIO || 'smoke';

// Shared thresholds for all scenarios
const baseThresholds = {
  // The mixed-workload scenario intentionally exercises some tolerated 4xx/5xx
  // paths, so gate on its explicit logical error metric instead of raw HTTP codes.
  overall_errors: ['rate<0.05'],
  http_req_duration: ['p(95)<500'],    // 95th percentile <500ms
};

// Scenario configurations
export const scenarios = {
  /**
   * Smoke Test
   * Quick validation that the service is working
   * - 1 virtual user
   * - 30 seconds duration
   * - Used for quick sanity checks
   */
  smoke: {
    executor: 'constant-vus',
    vus: 1,
    duration: '30s',
    tags: { scenario: 'smoke' },
  },

  /**
   * Load Test
   * Sustained load to measure typical performance
   * - 50 virtual users
   * - 5 minutes duration
   * - Simulates normal production traffic
   */
  load: {
    executor: 'constant-vus',
    vus: 50,
    duration: '5m',
    tags: { scenario: 'load' },
  },

  /**
   * Stress Test
   * Gradually increase load to find breaking points
   * - Ramps up to 100 virtual users
   * - 10 minutes total duration
   * - Identifies performance degradation thresholds
   */
  stress: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '2m', target: 20 },   // Warm up
      { duration: '3m', target: 50 },   // Normal load
      { duration: '2m', target: 100 },  // Peak load
      { duration: '2m', target: 100 },  // Stay at peak
      { duration: '1m', target: 0 },    // Cool down
    ],
    tags: { scenario: 'stress' },
  },

  /**
   * Spike Test
   * Sudden traffic spike to test autoscaling and recovery
   * - Sudden jump to 200 virtual users
   * - Tests system behavior under sudden load
   */
  spike: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '30s', target: 10 },   // Baseline
      { duration: '10s', target: 200 },  // Spike!
      { duration: '2m', target: 200 },   // Hold spike
      { duration: '30s', target: 10 },   // Recovery
      { duration: '1m', target: 10 },    // Verify recovery
    ],
    tags: { scenario: 'spike' },
  },
};

// Threshold configurations per scenario
const scenarioThresholds = {
  smoke: {
    ...baseThresholds,
    overall_errors: ['rate<0.01'],
    http_req_duration: ['p(95)<200'],  // Stricter for smoke
  },
  load: {
    ...baseThresholds,
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
  },
  stress: {
    ...baseThresholds,
    overall_errors: ['rate<0.05'],
    http_req_duration: ['p(95)<1000'],  // More relaxed under stress
  },
  spike: {
    ...baseThresholds,
    overall_errors: ['rate<0.10'],
    http_req_duration: ['p(95)<2000'],  // Very relaxed during spike
  },
};

// Export configuration
export const options = {
  scenarios: {
    [SCENARIO]: scenarios[SCENARIO] || scenarios.smoke,
  },
  thresholds: scenarioThresholds[SCENARIO] || scenarioThresholds.smoke,
};

// Export BASE_URL for use in scenario files
export { BASE_URL };

// Default test function (imports actual scenarios)
export { default } from './scenarios/mixed-workload.js';
