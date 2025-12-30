// ABOUTME: OpenAPI types for schema parsing and endpoint metadata
// ABOUTME: Used by openapi-form package and UI components

/**
 * OpenAPI primitive types
 */
export type OpenAPIType = "string" | "number" | "integer" | "boolean" | "array" | "object";

/**
 * OpenAPI schema reference
 */
export interface SchemaReference {
  $ref: string;
}

/**
 * Base OpenAPI schema
 */
export interface OpenAPISchema {
  type?: OpenAPIType;
  format?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  required?: string[];

  // Object properties
  properties?: Record<string, OpenAPISchema | SchemaReference>;
  additionalProperties?: boolean | OpenAPISchema | SchemaReference;

  // Array items
  items?: OpenAPISchema | SchemaReference;

  // Validation
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;

  // Complex schemas (trigger JSON editor fallback)
  oneOf?: (OpenAPISchema | SchemaReference)[];
  anyOf?: (OpenAPISchema | SchemaReference)[];
  allOf?: (OpenAPISchema | SchemaReference)[];

  // Nullability
  nullable?: boolean;
}

/**
 * OpenAPI parameter location
 */
export type ParameterLocation = "query" | "path" | "header" | "cookie";

/**
 * OpenAPI parameter definition
 */
export interface OpenAPIParameter {
  name: string;
  in: ParameterLocation;
  description?: string;
  required?: boolean;
  schema: OpenAPISchema | SchemaReference;
}

/**
 * OpenAPI request body
 */
export interface OpenAPIRequestBody {
  description?: string;
  required?: boolean;
  content: Record<string, {
    schema: OpenAPISchema | SchemaReference;
  }>;
}

/**
 * OpenAPI response
 */
export interface OpenAPIResponse {
  description: string;
  content?: Record<string, {
    schema: OpenAPISchema | SchemaReference;
  }>;
}

/**
 * OpenAPI operation (endpoint)
 */
export interface OpenAPIOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  parameters?: OpenAPIParameter[];
  requestBody?: OpenAPIRequestBody;
  responses: Record<string, OpenAPIResponse>;
  tags?: string[];
}

/**
 * OpenAPI path item
 */
export interface OpenAPIPathItem {
  get?: OpenAPIOperation;
  post?: OpenAPIOperation;
  put?: OpenAPIOperation;
  patch?: OpenAPIOperation;
  delete?: OpenAPIOperation;
  options?: OpenAPIOperation;
  head?: OpenAPIOperation;
}

/**
 * OpenAPI components
 */
export interface OpenAPIComponents {
  schemas?: Record<string, OpenAPISchema>;
}

/**
 * OpenAPI specification (simplified)
 */
export interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  paths: Record<string, OpenAPIPathItem>;
  components?: OpenAPIComponents;
}

/**
 * Endpoint metadata extracted from OpenAPI
 */
export interface OpenAPIEndpointMeta {
  id: string;
  method: string;
  path: string;
  summary?: string;
  description?: string;
  requires_gpu?: boolean;
  schema: OpenAPIOperation;
}
