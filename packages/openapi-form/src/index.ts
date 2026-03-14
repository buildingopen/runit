// ABOUTME: Barrel export for the @buildingopen/openapi-form package.
// ABOUTME: Exports form components, hooks, schema utilities, example generators, and types for OpenAPI-driven forms.
/**
 * @buildingopen/openapi-form
 *
 * OpenAPI-driven form generation for RunIt.
 * Renders forms from OpenAPI schemas with automatic field rendering,
 * file uploads, and JSON editor fallback for complex schemas.
 */

export const VERSION = '0.1.0';

// Components
export { OpenAPIForm } from './components/OpenAPIForm';
export { FieldRenderer, renderSchemaFields } from './components/FieldRenderer';
export { FileUploader } from './components/FileUploader';
export { JsonEditor } from './components/JsonEditor';

// Hooks
export { useFormState } from './hooks/useFormState';
export type { UseFormStateOptions, UseFormStateReturn } from './hooks/useFormState';
export { useSchemaAnalysis } from './hooks/useSchemaAnalysis';
export type { UseSchemaAnalysisReturn } from './hooks/useSchemaAnalysis';

// Utilities
export {
  checkSchemaComplexity,
  getSchemaDepth,
  analyzeSchema,
  formatFieldName,
  getTypeLabel,
  isFileField,
  isEnumField,
  getRequiredFields,
  isFieldRequired,
} from './utils/schema-helpers';

export {
  generateExample,
  generateFullExample,
  generateExampleJson,
} from './utils/example-generator';

// Types
export type {
  OpenAPISchema,
  FileUpload,
  OpenAPIFormProps,
  FieldRendererProps,
  FileUploaderProps,
  JsonEditorProps,
  SchemaAnalysis,
  FormState,
} from './types';
