/**
 * @execution-layer/openapi-form tests
 */

import { describe, it, expect } from 'vitest';
import {
  VERSION,
  generateExample,
  generateFullExample,
  generateExampleJson,
  checkSchemaComplexity,
  getSchemaDepth,
  analyzeSchema,
  formatFieldName,
  isFileField,
  isEnumField,
  getRequiredFields,
} from '../index';

describe('openapi-form', () => {
  describe('VERSION', () => {
    it('exports VERSION', () => {
      expect(VERSION).toBe('0.1.0');
    });
  });

  describe('generateExample', () => {
    it('returns explicit example if provided', () => {
      const schema = { type: 'string', example: 'test-value' };
      expect(generateExample(schema)).toBe('test-value');
    });

    it('returns default if provided', () => {
      const schema = { type: 'string', default: 'default-value' };
      expect(generateExample(schema)).toBe('default-value');
    });

    it('returns first enum value', () => {
      const schema = { type: 'string', enum: ['a', 'b', 'c'] };
      expect(generateExample(schema)).toBe('a');
    });

    it('generates email format string', () => {
      const schema = { type: 'string', format: 'email' };
      expect(generateExample(schema)).toBe('user@example.com');
    });

    it('generates uri format string', () => {
      const schema = { type: 'string', format: 'uri' };
      expect(generateExample(schema)).toBe('https://example.com');
    });

    it('generates integer with minimum', () => {
      const schema = { type: 'integer', minimum: 5 };
      expect(generateExample(schema)).toBe(5);
    });

    it('generates boolean as false', () => {
      const schema = { type: 'boolean' };
      expect(generateExample(schema)).toBe(false);
    });

    it('generates array with one item', () => {
      const schema = { type: 'array', items: { type: 'string', format: 'email' } };
      expect(generateExample(schema)).toEqual(['user@example.com']);
    });

    it('generates object with required fields only', () => {
      const schema = {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', example: 'John' },
          age: { type: 'integer' },
        },
      };
      expect(generateExample(schema)).toEqual({ name: 'John' });
    });
  });

  describe('generateFullExample', () => {
    it('includes all fields including optional', () => {
      const schema = {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', example: 'John' },
          age: { type: 'integer', example: 30 },
        },
      };
      expect(generateFullExample(schema)).toEqual({ name: 'John', age: 30 });
    });
  });

  describe('generateExampleJson', () => {
    it('generates pretty JSON by default', () => {
      const schema = { type: 'object', required: ['a'], properties: { a: { type: 'string', example: 'b' } } };
      const json = generateExampleJson(schema);
      expect(json).toContain('\n');
    });

    it('generates compact JSON when pretty=false', () => {
      const schema = { type: 'object', required: ['a'], properties: { a: { type: 'string', example: 'b' } } };
      const json = generateExampleJson(schema, false);
      expect(json).not.toContain('\n');
    });
  });

  describe('schema-helpers', () => {
    it('checkSchemaComplexity returns false for simple schema', () => {
      const schema = {
        type: 'object',
        properties: { name: { type: 'string' } },
      };
      expect(checkSchemaComplexity(schema)).toBe(false);
    });

    it('getSchemaDepth returns correct depth', () => {
      const schema = {
        type: 'object',
        properties: {
          nested: {
            type: 'object',
            properties: { deep: { type: 'string' } },
          },
        },
      };
      expect(getSchemaDepth(schema)).toBeGreaterThan(1);
    });

    it('analyzeSchema returns analysis object', () => {
      const schema = {
        type: 'object',
        properties: { name: { type: 'string' } },
      };
      const analysis = analyzeSchema(schema);
      expect(analysis).toHaveProperty('depth');
      expect(analysis).toHaveProperty('fieldCount');
    });

    it('formatFieldName formats snake_case', () => {
      expect(formatFieldName('user_name')).toBe('User name');
    });

    it('isFileField detects binary format', () => {
      expect(isFileField({ type: 'string', format: 'binary' })).toBe(true);
      expect(isFileField({ type: 'string' })).toBe(false);
    });

    it('isEnumField detects enum', () => {
      expect(isEnumField({ type: 'string', enum: ['a', 'b'] })).toBe(true);
      expect(isEnumField({ type: 'string' })).toBe(false);
    });

    it('getRequiredFields returns required array', () => {
      const schema = { type: 'object', required: ['a', 'b'] };
      expect(getRequiredFields(schema)).toEqual(['a', 'b']);
    });

    it('getRequiredFields returns empty array if none', () => {
      const schema = { type: 'object' };
      expect(getRequiredFields(schema)).toEqual([]);
    });
  });
});
