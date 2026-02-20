// ABOUTME: React hook managing form state (values, errors, touched) driven by an OpenAPI schema.
// ABOUTME: Validates fields on change (required, type, enum, min/max, string length) and exposes getFieldProps helper.
/**
 * Form State Management Hook
 */

import { useState, useCallback, useMemo } from 'react';
import type { OpenAPISchema } from '../types';
import { getRequiredFields } from '../utils/schema-helpers';

export interface UseFormStateOptions {
  schema: OpenAPISchema;
  initialValues?: Record<string, unknown>;
  validateOnChange?: boolean;
}

export interface UseFormStateReturn {
  formData: Record<string, unknown>;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  isValid: boolean;
  isDirty: boolean;
  updateField: (name: string, value: unknown) => void;
  setFieldTouched: (name: string) => void;
  reset: () => void;
  validate: () => boolean;
  getFieldProps: (name: string) => {
    value: unknown;
    onChange: (value: unknown) => void;
    onBlur: () => void;
    error?: string;
  };
}

export function useFormState(options: UseFormStateOptions): UseFormStateReturn {
  const { schema, initialValues = {}, validateOnChange = true } = options;

  const [formData, setFormData] = useState<Record<string, unknown>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [initialData] = useState<Record<string, unknown>>(initialValues);

  const requiredFields = useMemo(() => getRequiredFields(schema), [schema]);

  const validateField = useCallback(
    (name: string, value: unknown): string | undefined => {
      const isRequired = requiredFields.includes(name);

      if (isRequired && (value === undefined || value === null || value === '')) {
        return `${name} is required`;
      }

      const fieldSchema = schema.properties?.[name];
      if (fieldSchema) {
        // Type validation
        if (fieldSchema.type === 'number' || fieldSchema.type === 'integer') {
          if (value !== '' && value !== undefined && isNaN(Number(value))) {
            return `${name} must be a valid number`;
          }
        }

        // Enum validation
        if (fieldSchema.enum && value !== '' && value !== undefined) {
          if (!fieldSchema.enum.includes(value)) {
            return `${name} must be one of: ${fieldSchema.enum.join(', ')}`;
          }
        }

        // Min/max validation for numbers
        if ((fieldSchema.type === 'number' || fieldSchema.type === 'integer') && value !== '' && value !== undefined) {
          const numValue = Number(value);
          if (typeof fieldSchema.minimum === 'number' && numValue < fieldSchema.minimum) {
            return `${name} must be at least ${fieldSchema.minimum}`;
          }
          if (typeof fieldSchema.maximum === 'number' && numValue > fieldSchema.maximum) {
            return `${name} must be at most ${fieldSchema.maximum}`;
          }
        }

        // String length validation
        if (fieldSchema.type === 'string' && typeof value === 'string') {
          if (typeof fieldSchema.minLength === 'number' && value.length < fieldSchema.minLength) {
            return `${name} must be at least ${fieldSchema.minLength} characters`;
          }
          if (typeof fieldSchema.maxLength === 'number' && value.length > fieldSchema.maxLength) {
            return `${name} must be at most ${fieldSchema.maxLength} characters`;
          }
        }
      }

      return undefined;
    },
    [schema, requiredFields]
  );

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (schema.properties) {
      for (const fieldName of Object.keys(schema.properties)) {
        const error = validateField(fieldName, formData[fieldName]);
        if (error) {
          newErrors[fieldName] = error;
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [schema, formData, validateField]);

  const updateField = useCallback(
    (name: string, value: unknown) => {
      setFormData((prev) => ({ ...prev, [name]: value }));

      if (validateOnChange) {
        const error = validateField(name, value);
        setErrors((prev) => {
          if (error) {
            return { ...prev, [name]: error };
          }
          const { [name]: _removed, ...rest } = prev;
          return rest;
        });
      }
    },
    [validateOnChange, validateField]
  );

  const setFieldTouched = useCallback((name: string) => {
    setTouched((prev) => ({ ...prev, [name]: true }));
  }, []);

  const reset = useCallback(() => {
    setFormData(initialData);
    setErrors({});
    setTouched({});
  }, [initialData]);

  const isValid = useMemo(() => {
    return Object.keys(errors).length === 0;
  }, [errors]);

  const isDirty = useMemo(() => {
    return JSON.stringify(formData) !== JSON.stringify(initialData);
  }, [formData, initialData]);

  const getFieldProps = useCallback(
    (name: string) => ({
      value: formData[name],
      onChange: (value: unknown) => updateField(name, value),
      onBlur: () => setFieldTouched(name),
      error: touched[name] ? errors[name] : undefined,
    }),
    [formData, errors, touched, updateField, setFieldTouched]
  );

  return {
    formData,
    errors,
    touched,
    isValid,
    isDirty,
    updateField,
    setFieldTouched,
    reset,
    validate,
    getFieldProps,
  };
}
