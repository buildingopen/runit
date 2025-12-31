// ABOUTME: Dynamic form generator from OpenAPI schema - native inputs for simple types, JSON editor for complex
// ABOUTME: Supports primitives, objects (depth 2), enums, defaults, and file uploads

'use client';

import { useState } from 'react';
import { FileUploader } from './FileUploader';

interface OpenAPISchema {
  type?: string;
  properties?: Record<string, unknown>;
  required?: string[];
  items?: unknown;
  enum?: unknown[];
  default?: unknown;
  description?: string;
  format?: string;
  [key: string]: unknown;
}

interface DynamicFormProps {
  schema: OpenAPISchema;
  onSubmit: (data: Record<string, unknown>) => void;
  isSubmitting?: boolean;
  initialValues?: Record<string, unknown>;
}

export function DynamicForm({
  schema,
  onSubmit,
  isSubmitting,
  initialValues = {},
}: DynamicFormProps) {
  const [formData, setFormData] = useState<Record<string, unknown>>(initialValues);
  const [useJsonEditor, setUseJsonEditor] = useState(false);
  const [jsonValue, setJsonValue] = useState(
    JSON.stringify(initialValues, null, 2)
  );
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Check if schema is too complex for form generation
  const isComplexSchema = checkSchemaComplexity(schema);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (useJsonEditor) {
      try {
        const parsed = JSON.parse(jsonValue);
        setJsonError(null);
        onSubmit(parsed);
      } catch (error) {
        setJsonError('Invalid JSON format');
      }
    } else {
      onSubmit(formData);
    }
  };

  const updateField = (path: string, value: unknown) => {
    setFormData((prev) => ({
      ...prev,
      [path]: value,
    }));
  };

  if (isComplexSchema || useJsonEditor) {
    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-600">
            {isComplexSchema
              ? 'This endpoint uses advanced schema features. Use the JSON editor below:'
              : 'Editing as JSON'}
          </p>
          {!isComplexSchema && (
            <button
              type="button"
              onClick={() => setUseJsonEditor(false)}
              className="text-sm text-purple-600 hover:text-purple-700"
            >
              Switch to form
            </button>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Request Body (JSON)
          </label>
          <textarea
            value={jsonValue}
            onChange={(e) => {
              setJsonValue(e.target.value);
              setJsonError(null);
            }}
            className="w-full h-64 px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder={JSON.stringify(getExampleFromSchema(schema), null, 2)}
          />
          {jsonError && (
            <p className="mt-1 text-sm text-red-600">{jsonError}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? 'Running...' : 'Run'}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex justify-end mb-2">
        <button
          type="button"
          onClick={() => setUseJsonEditor(true)}
          className="text-sm text-gray-600 hover:text-gray-700"
        >
          Switch to JSON editor
        </button>
      </div>

      {schema.properties && renderFields(schema, formData, updateField)}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
      >
        {isSubmitting ? 'Running...' : 'Run'}
      </button>
    </form>
  );
}

function renderFields(
  schema: OpenAPISchema,
  formData: Record<string, unknown>,
  updateField: (path: string, value: unknown) => void
): React.ReactNode {
  if (!schema.properties) return null;

  return Object.entries(schema.properties).map(([key, propSchema]) => {
    const prop = propSchema as OpenAPISchema;
    const isRequired = schema.required?.includes(key) || false;
    const value = formData[key];

    return (
      <div key={key} className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          {formatFieldName(key)}
          {isRequired && <span className="text-red-500 ml-1">*</span>}
        </label>
        {prop.description && (
          <p className="text-sm text-gray-500">{prop.description}</p>
        )}
        {renderField(key, prop, value, updateField, isRequired)}
      </div>
    );
  });
}

function renderField(
  key: string,
  schema: OpenAPISchema,
  value: unknown,
  updateField: (path: string, value: unknown) => void,
  isRequired: boolean
): React.ReactNode {
  // Handle enum (dropdown)
  if (schema.enum) {
    return (
      <select
        value={value as string}
        onChange={(e) => updateField(key, e.target.value)}
        required={isRequired}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
      >
        <option value="">Select...</option>
        {schema.enum.map((option) => (
          <option key={String(option)} value={String(option)}>
            {String(option)}
          </option>
        ))}
      </select>
    );
  }

  // Handle file upload
  if (schema.format === 'binary' || schema.type === 'file') {
    return (
      <FileUploader
        onUpload={(files) => updateField(key, files)}
        maxFiles={1}
      />
    );
  }

  // Handle different types
  switch (schema.type) {
    case 'string':
      return (
        <input
          type="text"
          value={(value as string) || (schema.default as string) || ''}
          onChange={(e) => updateField(key, e.target.value)}
          required={isRequired}
          placeholder={schema.default as string}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        />
      );

    case 'integer':
    case 'number':
      return (
        <input
          type="number"
          value={(value as number) || (schema.default as number) || ''}
          onChange={(e) =>
            updateField(key, e.target.value ? Number(e.target.value) : '')
          }
          required={isRequired}
          step={schema.type === 'integer' ? '1' : 'any'}
          placeholder={String(schema.default || '')}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        />
      );

    case 'boolean':
      return (
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={(value as boolean) || (schema.default as boolean) || false}
            onChange={(e) => updateField(key, e.target.checked)}
            className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
          />
          <span className="text-sm text-gray-700">
            {schema.description || formatFieldName(key)}
          </span>
        </label>
      );

    case 'array':
      return (
        <div className="space-y-2">
          <textarea
            value={JSON.stringify(value || [], null, 2)}
            onChange={(e) => {
              try {
                updateField(key, JSON.parse(e.target.value));
              } catch {
                // Invalid JSON, ignore
              }
            }}
            required={isRequired}
            placeholder="[]"
            className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-500">Enter JSON array</p>
        </div>
      );

    case 'object':
      return (
        <div className="space-y-2">
          <textarea
            value={JSON.stringify(value || {}, null, 2)}
            onChange={(e) => {
              try {
                updateField(key, JSON.parse(e.target.value));
              } catch {
                // Invalid JSON, ignore
              }
            }}
            required={isRequired}
            placeholder="{}"
            className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-500">Enter JSON object</p>
        </div>
      );

    default:
      return (
        <input
          type="text"
          value={(value as string) || ''}
          onChange={(e) => updateField(key, e.target.value)}
          required={isRequired}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        />
      );
  }
}

function checkSchemaComplexity(schema: OpenAPISchema): boolean {
  // Check for complex schema features
  if (schema.oneOf || schema.anyOf || schema.allOf) return true;

  // Check nesting depth
  const depth = getSchemaDepth(schema);
  if (depth > 2) return true;

  return false;
}

function getSchemaDepth(schema: OpenAPISchema, currentDepth = 0): number {
  if (currentDepth > 3) return currentDepth; // Max depth check

  if (schema.type === 'object' && schema.properties) {
    const depths = Object.values(schema.properties).map((prop) =>
      getSchemaDepth(prop as OpenAPISchema, currentDepth + 1)
    );
    return Math.max(...depths, currentDepth);
  }

  if (schema.type === 'array' && schema.items) {
    return getSchemaDepth(schema.items as OpenAPISchema, currentDepth + 1);
  }

  return currentDepth;
}

function getExampleFromSchema(schema: OpenAPISchema): unknown {
  if (schema.example) return schema.example;
  if (schema.default) return schema.default;

  if (schema.type === 'object' && schema.properties) {
    const example: Record<string, unknown> = {};
    Object.entries(schema.properties).forEach(([key, prop]) => {
      example[key] = getExampleFromSchema(prop as OpenAPISchema);
    });
    return example;
  }

  if (schema.type === 'array') {
    return [];
  }

  return null;
}

function formatFieldName(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}
