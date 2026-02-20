// ABOUTME: React hook that memoizes OpenAPI schema analysis: complexity, depth, field categorization.
// ABOUTME: Returns whether to use JSON editor fallback, and lists required/optional/file/enum fields.
/**
 * Schema Analysis Hook
 *
 * Analyzes OpenAPI schemas to determine complexity and rendering strategy
 */

import { useMemo } from 'react';
import type { OpenAPISchema, SchemaAnalysis } from '../types';
import { analyzeSchema, checkSchemaComplexity } from '../utils/schema-helpers';

export interface UseSchemaAnalysisReturn {
  analysis: SchemaAnalysis;
  isComplex: boolean;
  shouldUseJsonEditor: boolean;
  depth: number;
  fieldCount: number;
  hasFileFields: boolean;
  hasEnumFields: boolean;
  requiredFields: string[];
  optionalFields: string[];
}

export function useSchemaAnalysis(schema: OpenAPISchema): UseSchemaAnalysisReturn {
  return useMemo(() => {
    const analysis = analyzeSchema(schema);
    const isComplex = checkSchemaComplexity(schema);

    // Determine if we should use JSON editor
    const shouldUseJsonEditor = isComplex || analysis.depth > 2;

    // Count file and enum fields
    let hasFileFields = false;
    let hasEnumFields = false;
    const requiredFields: string[] = [];
    const optionalFields: string[] = [];

    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        // Check for file fields
        if (propSchema.format === 'binary' || propSchema.type === 'file') {
          hasFileFields = true;
        }

        // Check for enum fields
        if (Array.isArray(propSchema.enum) && propSchema.enum.length > 0) {
          hasEnumFields = true;
        }

        // Categorize required vs optional
        if (schema.required?.includes(key)) {
          requiredFields.push(key);
        } else {
          optionalFields.push(key);
        }
      }
    }

    return {
      analysis,
      isComplex,
      shouldUseJsonEditor,
      depth: analysis.depth,
      fieldCount: analysis.fieldCount,
      hasFileFields,
      hasEnumFields,
      requiredFields,
      optionalFields,
    };
  }, [schema]);
}
