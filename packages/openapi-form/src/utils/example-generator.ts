/**
 * Example Generator Utilities
 *
 * Generates example values from OpenAPI schemas
 */

import type { OpenAPISchema } from '../types';

/**
 * Generate an example value from a schema
 */
export function generateExample(schema: OpenAPISchema): unknown {
  // Use explicit example if provided
  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;

  // Handle enum - use first value
  if (schema.enum && schema.enum.length > 0) {
    return schema.enum[0];
  }

  // Handle different types
  switch (schema.type) {
    case 'string':
      return generateStringExample(schema);
    case 'integer':
      return generateIntegerExample(schema);
    case 'number':
      return generateNumberExample(schema);
    case 'boolean':
      return false;
    case 'array':
      return generateArrayExample(schema);
    case 'object':
      return generateObjectExample(schema);
    default:
      return null;
  }
}

/**
 * Generate a string example based on format
 */
function generateStringExample(schema: OpenAPISchema): string {
  switch (schema.format) {
    case 'date':
      return new Date().toISOString().split('T')[0];
    case 'date-time':
      return new Date().toISOString();
    case 'time':
      return new Date().toISOString().split('T')[1].split('.')[0];
    case 'email':
      return 'user@example.com';
    case 'uri':
    case 'url':
      return 'https://example.com';
    case 'uuid':
      return '00000000-0000-0000-0000-000000000000';
    case 'binary':
      return '';
    case 'byte':
      return '';
    default:
      return '';
  }
}

/**
 * Generate an integer example
 */
function generateIntegerExample(schema: OpenAPISchema): number {
  if (typeof schema.minimum === 'number') return Math.ceil(schema.minimum);
  if (typeof schema.maximum === 'number') return Math.floor(schema.maximum);
  return 0;
}

/**
 * Generate a number example
 */
function generateNumberExample(schema: OpenAPISchema): number {
  if (typeof schema.minimum === 'number') return schema.minimum;
  if (typeof schema.maximum === 'number') return schema.maximum;
  return 0.0;
}

/**
 * Generate an array example
 */
function generateArrayExample(schema: OpenAPISchema): unknown[] {
  if (!schema.items) return [];

  // Generate one example item
  const itemExample = generateExample(schema.items);
  return itemExample !== null ? [itemExample] : [];
}

/**
 * Generate an object example
 */
function generateObjectExample(schema: OpenAPISchema): Record<string, unknown> {
  if (!schema.properties) return {};

  const example: Record<string, unknown> = {};
  const required = schema.required || [];

  for (const [key, propSchema] of Object.entries(schema.properties)) {
    // Always include required fields, optionally include others
    if (required.includes(key)) {
      example[key] = generateExample(propSchema);
    }
  }

  return example;
}

/**
 * Generate a full example object including optional fields
 */
export function generateFullExample(schema: OpenAPISchema): Record<string, unknown> {
  if (!schema.properties) return {};

  const example: Record<string, unknown> = {};

  for (const [key, propSchema] of Object.entries(schema.properties)) {
    example[key] = generateExample(propSchema);
  }

  return example;
}

/**
 * Generate example JSON string
 */
export function generateExampleJson(schema: OpenAPISchema, pretty = true): string {
  const example = generateExample(schema);
  return pretty ? JSON.stringify(example, null, 2) : JSON.stringify(example);
}
