// ABOUTME: TypeScript interfaces for the openapi-form package: OpenAPISchema, FileUpload, form/field/editor props.
// ABOUTME: Also defines SchemaAnalysis (complexity metrics) and FormState (data, errors, touched, validity).
/**
 * OpenAPI Form Types
 */

export interface OpenAPISchema {
  type?: string;
  properties?: Record<string, OpenAPISchema>;
  required?: string[];
  items?: OpenAPISchema;
  enum?: unknown[];
  default?: unknown;
  example?: unknown;
  description?: string;
  format?: string;
  oneOf?: OpenAPISchema[];
  anyOf?: OpenAPISchema[];
  allOf?: OpenAPISchema[];
  $ref?: string;
  [key: string]: unknown;
}

export interface FileUpload {
  field_name: string;
  filename: string;
  content_type: string;
  data: string; // base64
}

export interface OpenAPIFormProps {
  schema: OpenAPISchema;
  onSubmit: (data: Record<string, unknown>) => void;
  isSubmitting?: boolean;
  initialValues?: Record<string, unknown>;
  submitLabel?: string;
  loadingLabel?: string;
  hideSubmitButton?: boolean;
}

export interface FieldRendererProps {
  name: string;
  schema: OpenAPISchema;
  value: unknown;
  onChange: (value: unknown) => void;
  isRequired?: boolean;
}

export interface FileUploaderProps {
  onUpload: (files: FileUpload[]) => void;
  maxFiles?: number;
  maxSize?: number;
}

export interface JsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string | null;
}

export interface SchemaAnalysis {
  isComplex: boolean;
  depth: number;
  hasUnion: boolean;
  hasRef: boolean;
  fieldCount: number;
}

export interface FormState {
  data: Record<string, unknown>;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  isValid: boolean;
}
