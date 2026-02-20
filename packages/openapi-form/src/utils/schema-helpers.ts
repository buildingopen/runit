// ABOUTME: Utility functions to analyze OpenAPI schemas: complexity checks, depth calculation, field classification.
// ABOUTME: Provides helpers for field names, type labels, enum/file detection, and required-field extraction.
/**
 * Schema Helper Utilities
 */

import type { OpenAPISchema, SchemaAnalysis } from '../types';

/**
 * Check if a schema is too complex for form generation
 */
export function checkSchemaComplexity(schema: OpenAPISchema): boolean {
  if (schema.oneOf || schema.anyOf || schema.allOf) return true;
  if (schema.$ref) return true;

  const depth = getSchemaDepth(schema);
  if (depth > 2) return true;

  return false;
}

/**
 * Get the depth of nested objects/arrays in a schema
 */
export function getSchemaDepth(schema: OpenAPISchema, currentDepth = 0): number {
  if (currentDepth > 3) return currentDepth;

  if (schema.type === 'object' && schema.properties) {
    const depths = Object.values(schema.properties).map((prop) =>
      getSchemaDepth(prop, currentDepth + 1)
    );
    return Math.max(...depths, currentDepth);
  }

  if (schema.type === 'array' && schema.items) {
    return getSchemaDepth(schema.items, currentDepth + 1);
  }

  return currentDepth;
}

/**
 * Analyze a schema and return detailed information
 */
export function analyzeSchema(schema: OpenAPISchema): SchemaAnalysis {
  const depth = getSchemaDepth(schema);
  const hasUnion = !!(schema.oneOf || schema.anyOf || schema.allOf);
  const hasRef = !!schema.$ref;
  const fieldCount = schema.properties ? Object.keys(schema.properties).length : 0;

  return {
    isComplex: hasUnion || hasRef || depth > 2,
    depth,
    hasUnion,
    hasRef,
    fieldCount,
  };
}

/**
 * Format a field name for display
 */
export function formatFieldName(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

/**
 * Get the type label for a schema
 */
export function getTypeLabel(schema: OpenAPISchema): string {
  if (schema.enum) return 'enum';
  if (schema.format === 'binary' || schema.type === 'file') return 'file';
  if (schema.type === 'array') {
    const itemType = schema.items?.type || 'any';
    return `${itemType}[]`;
  }
  return schema.type || 'any';
}

/**
 * Check if a field should use file upload
 */
export function isFileField(schema: OpenAPISchema): boolean {
  return schema.format === 'binary' || schema.type === 'file';
}

/**
 * Check if a field is an enum
 */
export function isEnumField(schema: OpenAPISchema): boolean {
  return Array.isArray(schema.enum) && schema.enum.length > 0;
}

/**
 * Get required fields from a schema
 */
export function getRequiredFields(schema: OpenAPISchema): string[] {
  return schema.required || [];
}

/**
 * Check if a field is required
 */
export function isFieldRequired(schema: OpenAPISchema, fieldName: string): boolean {
  return schema.required?.includes(fieldName) || false;
}
