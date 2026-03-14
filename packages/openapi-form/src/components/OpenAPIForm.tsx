/**
 * OpenAPI Form Component
 *
 * Main form component that renders forms from OpenAPI schemas.
 * Automatically switches to JSON editor for complex schemas.
 */

'use client';

import { useState } from 'react';
import type { OpenAPIFormProps } from '../types';
import { useFormState } from '../hooks/useFormState';
import { useSchemaAnalysis } from '../hooks/useSchemaAnalysis';
import { renderSchemaFields } from './FieldRenderer';
import { JsonEditor } from './JsonEditor';
import { generateExampleJson } from '../utils/example-generator';

export function OpenAPIForm({
  schema,
  onSubmit,
  onChange,
  isSubmitting = false,
  initialValues = {},
  submitLabel = 'Run',
  loadingLabel = 'Running...',
  hideSubmitButton = false,
}: OpenAPIFormProps) {
  const { isComplex, shouldUseJsonEditor } = useSchemaAnalysis(schema);
  const [useJsonEditor, setUseJsonEditor] = useState(shouldUseJsonEditor);
  const [jsonValue, setJsonValue] = useState(
    JSON.stringify(initialValues, null, 2) || '{}'
  );
  const [jsonError, setJsonError] = useState<string | null>(null);

  const { formData, updateField: rawUpdateField, validate, isValid: _isValid } = useFormState({
    schema,
    initialValues,
  });

  // Wrap updateField to notify parent of changes
  const updateField = (name: string, value: unknown) => {
    rawUpdateField(name, value);
    if (onChange) {
      onChange({ ...formData, [name]: value });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (useJsonEditor) {
      try {
        const parsed = JSON.parse(jsonValue);
        setJsonError(null);
        onSubmit(parsed);
      } catch {
        setJsonError('Invalid JSON format');
      }
    } else {
      if (validate()) {
        onSubmit(formData);
      }
    }
  };

  // Render JSON editor mode
  if (isComplex || useJsonEditor) {
    return (
      <form onSubmit={handleSubmit} className="openapi-form space-y-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-gray-500">
            {isComplex
              ? 'This endpoint uses advanced schema features. Use JSON:'
              : 'Editing as JSON'}
          </p>
          {!isComplex && (
            <button
              type="button"
              onClick={() => setUseJsonEditor(false)}
              className="text-xs text-blue-500 hover:text-blue-600"
            >
              Switch to form
            </button>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">
            Request Body (JSON)
          </label>
          <JsonEditor
            value={jsonValue}
            onChange={(v) => {
              setJsonValue(v);
              setJsonError(null);
            }}
            placeholder={generateExampleJson(schema)}
            error={jsonError}
          />
        </div>

        {!hideSubmitButton && (
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:text-gray-500 text-white text-sm font-medium rounded transition-colors"
          >
            {isSubmitting ? loadingLabel : submitLabel}
          </button>
        )}
      </form>
    );
  }

  // Render form mode
  return (
    <form onSubmit={handleSubmit} className="openapi-form space-y-4">
      <div className="flex justify-end mb-2">
        <button
          type="button"
          onClick={() => setUseJsonEditor(true)}
          className="text-xs text-gray-500 hover:text-gray-600"
        >
          Switch to JSON editor
        </button>
      </div>

      {schema.properties && renderSchemaFields(schema, formData, updateField)}

      {!hideSubmitButton && (
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:text-gray-500 text-white text-sm font-medium rounded transition-colors"
        >
          {isSubmitting ? loadingLabel : submitLabel}
        </button>
      )}
    </form>
  );
}
