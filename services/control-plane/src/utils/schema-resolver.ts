/**
 * Schema Resolver Utility
 *
 * Resolves $ref references in OpenAPI schemas to produce fully expanded schemas
 * that can be used directly for form generation and data rendering.
 */

export interface OpenAPISpec {
  components?: {
    schemas?: Record<string, unknown>;
  };
  [key: string]: unknown;
}

/**
 * Resolves all $ref references in a schema using the OpenAPI spec's components
 *
 * @param schema - The schema object that may contain $ref references
 * @param openapi - The full OpenAPI spec for component lookup
 * @param visited - Set of visited refs to detect circular references
 * @returns The resolved schema with all $refs expanded
 */
export function resolveSchemaRefs(
  schema: unknown,
  openapi: OpenAPISpec,
  visited = new Set<string>()
): unknown {
  // Handle null/undefined
  if (schema === null || schema === undefined) {
    return schema;
  }

  // Handle non-objects (primitives)
  if (typeof schema !== 'object') {
    return schema;
  }

  // Handle arrays
  if (Array.isArray(schema)) {
    return schema.map((item) => resolveSchemaRefs(item, openapi, visited));
  }

  const schemaObj = schema as Record<string, unknown>;

  // Handle $ref
  if ('$ref' in schemaObj && typeof schemaObj.$ref === 'string') {
    const ref = schemaObj.$ref;

    // Only handle internal component references
    if (ref.startsWith('#/components/schemas/')) {
      // Check for circular reference
      if (visited.has(ref)) {
        // Return a placeholder for circular references
        return {
          type: 'object',
          description: `[Circular reference to ${ref.split('/').pop()}]`,
        };
      }

      // Get the schema name from the ref
      const schemaName = ref.substring('#/components/schemas/'.length);
      const resolvedSchema = openapi.components?.schemas?.[schemaName];

      if (resolvedSchema) {
        // Add to visited set before recursing
        const newVisited = new Set(visited);
        newVisited.add(ref);

        // Recursively resolve any nested refs
        return resolveSchemaRefs(resolvedSchema, openapi, newVisited);
      }

      // If ref not found, return the original ref
      return schemaObj;
    }

    // For non-component refs, return as-is
    return schemaObj;
  }

  // Recursively resolve all properties in the object
  const resolved: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(schemaObj)) {
    resolved[key] = resolveSchemaRefs(value, openapi, visited);
  }

  return resolved;
}
