import { defineConfig } from 'vitest/config';
import { randomBytes } from 'crypto';

const testRunId = randomBytes(4).toString('hex');

export default defineConfig({
  test: {
    // Default configuration for unit tests
    include: ['tests/**/*.test.ts', 'src/**/__tests__/**/*.test.ts'],
    exclude: ['tests/e2e/**', 'tests/load/**', 'node_modules/**'],
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      OTEL_TRACING_ENABLED: 'false',
      RUNIT_DATA_DIR: `/tmp/runit-test-${testRunId}`,
    },
    silent: 'passed-only',
    globals: false,
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
