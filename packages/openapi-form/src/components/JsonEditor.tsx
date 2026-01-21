/**
 * JSON Editor Component
 *
 * Textarea-based JSON editor for complex schemas
 */

'use client';

import type { JsonEditorProps } from '../types';

export function JsonEditor({
  value,
  onChange,
  placeholder = '{}',
  error,
}: JsonEditorProps) {
  return (
    <div className="openapi-form-json-editor space-y-1">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-48 px-3 py-2 bg-gray-50 border border-gray-300 rounded font-mono text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 transition-colors resize-none"
        placeholder={placeholder}
      />
      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}
