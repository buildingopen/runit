// ABOUTME: Themed wrapper for @runtime-ai/openapi-form package
// ABOUTME: Overrides Tailwind colors with CSS custom properties to match app theme

'use client';

import { OpenAPIForm } from '@runtime-ai/openapi-form';
import type { OpenAPIFormProps } from '@runtime-ai/openapi-form';

export function OpenAPIFormThemed(props: OpenAPIFormProps) {
  return (
    <div className="openapi-form-themed">
      <OpenAPIForm {...props} />
      <style jsx global>{`
        /* Theme adapter: Override package Tailwind colors with CSS variables */

        /* Form container */
        .openapi-form-themed .openapi-form {
          color: var(--text-primary);
        }

        /* Text inputs, selects, and textareas */
        .openapi-form-themed .openapi-form input[type="text"],
        .openapi-form-themed .openapi-form input[type="number"],
        .openapi-form-themed .openapi-form select,
        .openapi-form-themed .openapi-form textarea {
          background-color: var(--bg-tertiary);
          border-color: var(--border);
          color: var(--text-primary);
        }

        .openapi-form-themed .openapi-form input::placeholder,
        .openapi-form-themed .openapi-form textarea::placeholder {
          color: var(--text-tertiary);
        }

        .openapi-form-themed .openapi-form input:focus,
        .openapi-form-themed .openapi-form select:focus,
        .openapi-form-themed .openapi-form textarea:focus {
          border-color: var(--accent);
          outline: none;
        }

        /* Checkboxes */
        .openapi-form-themed .openapi-form input[type="checkbox"] {
          background-color: var(--bg-tertiary);
          border-color: var(--border);
          accent-color: var(--accent);
        }

        /* Labels */
        .openapi-form-themed .openapi-form label {
          color: var(--text-secondary);
        }

        /* Description text */
        .openapi-form-themed .openapi-form p {
          color: var(--text-tertiary);
        }

        /* Error text */
        .openapi-form-themed .openapi-form .text-red-500,
        .openapi-form-themed .openapi-form .text-red-600 {
          color: var(--error) !important;
        }

        /* Submit button - primary state */
        .openapi-form-themed .openapi-form button[type="submit"] {
          background-color: var(--accent);
          color: white;
        }

        .openapi-form-themed .openapi-form button[type="submit"]:hover:not(:disabled) {
          background-color: var(--accent-hover);
        }

        /* Submit button - disabled state */
        .openapi-form-themed .openapi-form button[type="submit"]:disabled {
          background-color: var(--bg-tertiary);
          color: var(--text-tertiary);
        }

        /* Secondary buttons (Switch to JSON editor, etc.) */
        .openapi-form-themed .openapi-form button[type="button"] {
          color: var(--text-tertiary);
        }

        .openapi-form-themed .openapi-form button[type="button"]:hover {
          color: var(--text-secondary);
        }

        /* Blue link text (Switch to form) - override Tailwind blue */
        .openapi-form-themed .openapi-form .text-blue-500,
        .openapi-form-themed .openapi-form .text-blue-600 {
          color: var(--accent) !important;
        }

        .openapi-form-themed .openapi-form .hover\\:text-blue-600:hover {
          color: var(--accent-hover) !important;
        }

        /* Gray text - map to theme */
        .openapi-form-themed .openapi-form .text-gray-500 {
          color: var(--text-tertiary) !important;
        }

        .openapi-form-themed .openapi-form .text-gray-600 {
          color: var(--text-secondary) !important;
        }

        .openapi-form-themed .openapi-form .hover\\:text-gray-600:hover {
          color: var(--text-secondary) !important;
        }

        /* Blue background buttons - map to accent */
        .openapi-form-themed .openapi-form .bg-blue-500 {
          background-color: var(--accent) !important;
        }

        .openapi-form-themed .openapi-form .hover\\:bg-blue-600:hover {
          background-color: var(--accent-hover) !important;
        }

        /* Disabled gray backgrounds */
        .openapi-form-themed .openapi-form .disabled\\:bg-gray-300:disabled {
          background-color: var(--bg-tertiary) !important;
        }

        .openapi-form-themed .openapi-form .disabled\\:text-gray-500:disabled {
          color: var(--text-tertiary) !important;
        }

        /* File uploader styling */
        .openapi-form-themed .openapi-form .file-uploader {
          background-color: var(--bg-tertiary);
          border-color: var(--border);
        }

        .openapi-form-themed .openapi-form .file-uploader:hover {
          border-color: var(--accent);
        }
      `}</style>
    </div>
  );
}

export type { OpenAPIFormProps };
