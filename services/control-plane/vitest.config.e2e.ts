import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // E2E test configuration
    include: ['tests/e2e/**/*.e2e.test.ts'],
    exclude: ['node_modules/**'],
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      OTEL_TRACING_ENABLED: 'false',
    },
    silent: 'passed-only',
    globals: false,

    // Longer timeouts for E2E tests (database operations)
    testTimeout: 30000,
    hookTimeout: 30000,

    // Run tests sequentially to avoid database conflicts
    sequence: {
      concurrent: false,
    },

    // Retry failed tests once (network flakiness)
    retry: 1,

    // Setup file for environment preparation
    setupFiles: ['./tests/e2e/setup.ts'],

    // Pool configuration
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // Run all tests in a single fork for database consistency
      },
    },
  },
});
