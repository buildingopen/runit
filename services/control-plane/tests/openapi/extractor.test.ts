/**
 * OpenAPI Extractor Tests
 *
 * ABOUTME: Tests for OpenAPI extraction from FastAPI apps
 * ABOUTME: Tests entrypoint detection, error classification, and schema extraction
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  OpenAPIExtractor,
  createExtractor,
  type ExtractOpenAPIRequest
} from '../../src/lib/openapi/extractor';
import {
  detectEntrypoint,
  validateEntrypoint,
  parseEntrypoint,
  COMMON_ENTRYPOINTS
} from '../../src/lib/openapi/entrypoint-detector';
import {
  classifyError,
  extractMissingPackage,
  extractSyntaxErrorLocation
} from '../../src/lib/openapi/classifier';

// Get fixtures directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesDir = resolve(__dirname, 'fixtures');

describe('OpenAPI Extractor', () => {
  let extractor: OpenAPIExtractor;

  beforeAll(() => {
    extractor = createExtractor({
      bridgeUrl: process.env.OPENAPI_BRIDGE_URL || 'http://localhost:8001'
    });
  });

  describe('Entrypoint Detection', () => {
    it('should detect entrypoint from simple_app.py', async () => {
      const result = await detectEntrypoint(fixturesDir);

      expect(result.entrypoint).toBeDefined();
      expect(result.confidence).toBe('high');
      expect(result.detectionMethod).toBe('scan');
    });

    it('should validate correct entrypoint formats', () => {
      expect(validateEntrypoint('main:app')).toBe(true);
      expect(validateEntrypoint('app:app')).toBe(true);
      expect(validateEntrypoint('src.main:app')).toBe(true);
      expect(validateEntrypoint('api.v1.main:application')).toBe(true);
    });

    it('should reject invalid entrypoint formats', () => {
      expect(validateEntrypoint('main')).toBe(false);
      expect(validateEntrypoint('main.app')).toBe(false);
      expect(validateEntrypoint(':app')).toBe(false);
      expect(validateEntrypoint('main:')).toBe(false);
      expect(validateEntrypoint('main:app:extra')).toBe(false);
    });

    it('should parse entrypoint correctly', () => {
      const parsed = parseEntrypoint('main:app');
      expect(parsed.module).toBe('main');
      expect(parsed.variable).toBe('app');

      const parsed2 = parseEntrypoint('src.api.main:application');
      expect(parsed2.module).toBe('src.api.main');
      expect(parsed2.variable).toBe('application');
    });

    it('should use custom entrypoint when provided', async () => {
      const result = await detectEntrypoint(
        fixturesDir,
        'custom_entrypoint:application'
      );

      expect(result.entrypoint).toBe('custom_entrypoint:application');
      expect(result.confidence).toBe('high');
      expect(result.detectionMethod).toBe('custom');
    });

    it('should have common entrypoint patterns defined', () => {
      expect(COMMON_ENTRYPOINTS).toContain('main:app');
      expect(COMMON_ENTRYPOINTS).toContain('app:app');
      expect(COMMON_ENTRYPOINTS).toContain('api:app');
    });
  });

  describe('Error Classification', () => {
    it('should classify import errors', () => {
      const error = 'ModuleNotFoundError: No module named "nonexistent_module"';
      const classified = classifyError(error);

      expect(classified.error_class).toBe('import_error');
      expect(classified.error_message).toBeDefined();
      expect(classified.suggested_fix).toBeDefined();
    });

    it('should classify timeout errors', () => {
      const error = 'Import exceeded 30s timeout';
      const classified = classifyError(error);

      expect(classified.error_class).toBe('timeout');
    });

    it('should classify syntax errors', () => {
      const error = 'SyntaxError: invalid syntax';
      const classified = classifyError(error);

      expect(classified.error_class).toBe('syntax_error');
    });

    it('should classify missing app errors', () => {
      const error =
        "AttributeError: module 'main' has no attribute 'app'";
      const classified = classifyError(error);

      expect(classified.error_class).toBe('no_fastapi_app');
    });

    it('should extract missing package name', () => {
      const error = 'ModuleNotFoundError: No module named "pandas"';
      const packageName = extractMissingPackage(error);

      expect(packageName).toBe('pandas');
    });

    it('should extract syntax error location', () => {
      const error = 'File "main.py", line 42, in <module>\nSyntaxError: invalid syntax';
      const location = extractSyntaxErrorLocation(error);

      expect(location).toBeDefined();
      expect(location?.file).toBe('main.py');
      expect(location?.line).toBe(42);
    });

    it('should handle circular import errors', () => {
      const error = 'ImportError: cannot import name "foo" from partially initialized module';
      const classified = classifyError(error);

      expect(classified.error_class).toBe('circular_import');
    });
  });

  describe('OpenAPI Extraction (Integration)', () => {
    // These tests require the Python bridge service to be running
    // Skip if OPENAPI_BRIDGE_URL is not set or bridge is not healthy

    it('should check bridge health', async () => {
      const isHealthy = await extractor.healthCheck();

      if (!isHealthy) {
        console.warn(
          'Python bridge service is not running. Skipping integration tests.\n' +
          'Start the bridge with: python services/control-plane/src/lib/openapi/bridge.py'
        );
      }

      // Don't fail the test if bridge is not running (for CI)
      expect(typeof isHealthy).toBe('boolean');
    });

    it.skip('should extract OpenAPI from simple_app.py', async () => {
      // Skip if bridge is not running
      const isHealthy = await extractor.healthCheck();
      if (!isHealthy) return;

      const request: ExtractOpenAPIRequest = {
        project_id: 'test-project',
        version_id: 'test-version',
        zip_path: fixturesDir
      };

      const response = await extractor.extract(request);

      expect(response.error).toBeUndefined();
      expect(response.openapi_schema).toBeDefined();
      expect(response.endpoints).toBeDefined();
      expect(response.endpoints.length).toBeGreaterThan(0);

      // Check endpoint structure
      const endpoint = response.endpoints[0];
      expect(endpoint.endpoint_id).toBeDefined();
      expect(endpoint.method).toBeDefined();
      expect(endpoint.path).toBeDefined();
    });

    it.skip('should handle no_app.py (no FastAPI instance)', async () => {
      const isHealthy = await extractor.healthCheck();
      if (!isHealthy) return;

      const request: ExtractOpenAPIRequest = {
        project_id: 'test-project',
        version_id: 'test-version',
        zip_path: fixturesDir,
        entrypoint: 'no_app:app'
      };

      const response = await extractor.extract(request);

      expect(response.error).toBeDefined();
      expect(response.error?.error_class).toBe('no_fastapi_app');
      expect(response.error?.suggested_fix).toBeDefined();
    });

    it.skip('should handle broken_import.py (import error)', async () => {
      const isHealthy = await extractor.healthCheck();
      if (!isHealthy) return;

      const request: ExtractOpenAPIRequest = {
        project_id: 'test-project',
        version_id: 'test-version',
        zip_path: fixturesDir,
        entrypoint: 'broken_import:app'
      };

      const response = await extractor.extract(request);

      expect(response.error).toBeDefined();
      expect(response.error?.error_class).toBe('import_error');
    });

    it.skip('should handle custom_entrypoint.py', async () => {
      const isHealthy = await extractor.healthCheck();
      if (!isHealthy) return;

      const request: ExtractOpenAPIRequest = {
        project_id: 'test-project',
        version_id: 'test-version',
        zip_path: fixturesDir,
        entrypoint: 'custom_entrypoint:application'
      };

      const response = await extractor.extract(request);

      expect(response.error).toBeUndefined();
      expect(response.entrypoint).toBe('custom_entrypoint:application');
      expect(response.endpoints.length).toBeGreaterThan(0);
    });

    it.skip('should detect GPU requirement from endpoint description', async () => {
      const isHealthy = await extractor.healthCheck();
      if (!isHealthy) return;

      // Would need a fixture with GPU-related keywords
      // This is a placeholder for now
      expect(true).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid entrypoint format', async () => {
      const request: ExtractOpenAPIRequest = {
        project_id: 'test-project',
        version_id: 'test-version',
        zip_path: fixturesDir,
        entrypoint: 'invalid_format' // Missing :variable
      };

      const response = await extractor.extract(request);

      expect(response.error).toBeDefined();
      expect(response.error?.error_class).toBe('entrypoint_not_found');
      expect(response.error?.error_message).toContain('Invalid');
    });

    it('should handle network errors gracefully', async () => {
      // Create extractor with invalid bridge URL
      const badExtractor = createExtractor({
        bridgeUrl: 'http://localhost:9999'
      });

      const request: ExtractOpenAPIRequest = {
        project_id: 'test-project',
        version_id: 'test-version',
        zip_path: fixturesDir
      };

      const response = await badExtractor.extract(request);

      expect(response.error).toBeDefined();
      expect(response.error?.error_class).toBe('import_error');
      expect(response.error?.error_message).toContain('bridge');
    });
  });
});
