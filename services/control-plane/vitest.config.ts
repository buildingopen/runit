import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Default configuration for unit tests
    include: ['tests/**/*.test.ts', 'src/**/__tests__/**/*.test.ts'],
    exclude: ['tests/e2e/**', 'tests/load/**', 'node_modules/**'],
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      OTEL_TRACING_ENABLED: 'false',
    },
    silent: 'passed-only',
    globals: false,
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
