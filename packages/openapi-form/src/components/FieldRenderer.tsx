/**
 * Field Renderer Component
 *
 * Renders individual form fields based on OpenAPI schema type
 */

'use client';

import type { FieldRendererProps, OpenAPISchema } from '../types';
import { FileUploader } from './FileUploader';
import { formatFieldName, isFileField, isEnumField } from '../utils/schema-helpers';

export function FieldRenderer({
  name,
  schema,
  value,
  onChange,
  isRequired = false,
}: FieldRendererProps) {
  const inputClasses =
    'w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 transition-colors';

  // Handle enum (dropdown)
  if (isEnumField(schema)) {
    return (
      <select
        value={value as string}
        onChange={(e) => onChange(e.target.value)}
        required={isRequired}
        className={inputClasses}
      >
        <option value="">Select...</option>
        {schema.enum?.map((option) => (
          <option key={String(option)} value={String(option)}>
            {String(option)}
          </option>
        ))}
      </select>
    );
  }

  // Handle file upload
  if (isFileField(schema)) {
    return <FileUploader onUpload={(files) => onChange(files)} maxFiles={1} />;
  }

  // Handle different types
  switch (schema.type) {
    case 'string':
      return (
        <input
          type="text"
          value={(value as string) || (schema.default as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          required={isRequired}
          placeholder={schema.default as string}
          className={inputClasses}
        />
      );

    case 'integer':
    case 'number':
      return (
        <input
          type="number"
          value={(value as number) ?? (schema.default as number) ?? ''}
          onChange={(e) =>
            onChange(e.target.value ? Number(e.target.value) : '')
          }
          required={isRequired}
          step={schema.type === 'integer' ? '1' : 'any'}
          placeholder={String(schema.default || '')}
          className={inputClasses}
        />
      );

    case 'boolean': {
      // Use nullish coalescing to properly handle false values
      const isChecked = value !== undefined ? Boolean(value) : Boolean(schema.default);
      return (
        <div className="flex items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={isChecked}
            onClick={() => onChange(!isChecked)}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              isChecked ? 'bg-blue-500' : 'bg-gray-300'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                isChecked ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
          <span className="text-sm text-gray-600">
            {schema.description || formatFieldName(name)}
          </span>
        </div>
      );
    }

    case 'array':
      return (
        <div className="space-y-1">
          <textarea
            value={JSON.stringify(value || [], null, 2)}
            onChange={(e) => {
              try {
                onChange(JSON.parse(e.target.value));
              } catch {
                // Invalid JSON, ignore
              }
            }}
            required={isRequired}
            placeholder="[]"
            className={`${inputClasses} h-20 font-mono resize-none`}
          />
          <p className="text-[10px] text-gray-400">Enter JSON array</p>
        </div>
      );

    case 'object':
      return (
        <div className="space-y-1">
          <textarea
            value={JSON.stringify(value || {}, null, 2)}
            onChange={(e) => {
              try {
                onChange(JSON.parse(e.target.value));
              } catch {
                // Invalid JSON, ignore
              }
            }}
            required={isRequired}
            placeholder="{}"
            className={`${inputClasses} h-24 font-mono resize-none`}
          />
          <p className="text-[10px] text-gray-400">Enter JSON object</p>
        </div>
      );

    default:
      return (
        <input
          type="text"
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          required={isRequired}
          className={inputClasses}
        />
      );
  }
}

/**
 * Render all fields from a schema
 */
export function renderSchemaFields(
  schema: OpenAPISchema,
  formData: Record<string, unknown>,
  updateField: (name: string, value: unknown) => void
): React.ReactNode {
  if (!schema.properties) return null;

  return Object.entries(schema.properties).map(([key, propSchema]) => {
    const isRequired = schema.required?.includes(key) || false;
    const value = formData[key];

    return (
      <div key={key} className="space-y-1.5">
        <label className="block text-xs font-medium text-gray-600">
          {formatFieldName(key)}
          {isRequired && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        {propSchema.description && (
          <p className="text-xs text-gray-400">{propSchema.description}</p>
        )}
        <FieldRenderer
          name={key}
          schema={propSchema}
          value={value}
          onChange={(v) => updateField(key, v)}
          isRequired={isRequired}
        />
      </div>
    );
  });
}
