import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.config.{ts,js}',
        '**/*.d.ts',
        '**/tests/**',
        '**/__tests__/**',
      ],
    },
    include: ['**/*.test.{ts,tsx}', '**/__tests__/**/*.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@runtime-ai/shared': path.resolve(__dirname, './packages/shared/src'),
      '@runtime-ai/ui': path.resolve(__dirname, './packages/ui/src'),
      '@runtime-ai/openapi-form': path.resolve(__dirname, './packages/openapi-form/src'),
    },
  },
});
