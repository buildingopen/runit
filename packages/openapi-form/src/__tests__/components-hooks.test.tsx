import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, renderHook, act } from '@testing-library/react';
import { FieldRenderer, renderSchemaFields, OpenAPIForm, useFormState, useSchemaAnalysis } from '../index';
import type { OpenAPISchema } from '../types';

describe('openapi-form components and hooks', () => {
  it('renders enum FieldRenderer and emits selected value', () => {
    const onChange = vi.fn();
    render(
      <FieldRenderer
        name="status"
        schema={{ type: 'string', enum: ['open', 'closed'] }}
        value=""
        onChange={onChange}
      />
    );

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'closed' } });
    expect(onChange).toHaveBeenCalledWith('closed');
  });

  it('renders boolean FieldRenderer switch and toggles', () => {
    const onChange = vi.fn();
    render(
      <FieldRenderer
        name="enabled"
        schema={{ type: 'boolean', description: 'Enabled' }}
        value={false}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('renders array/object FieldRenderer and parses valid JSON only', () => {
    const onArray = vi.fn();
    const onObject = vi.fn();

    const { rerender } = render(
      <FieldRenderer name="arr" schema={{ type: 'array' }} value={[]} onChange={onArray} />
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '["a"]' } });
    expect(onArray).toHaveBeenCalledWith(['a']);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '[broken' } });
    expect(onArray).toHaveBeenCalledTimes(1);

    rerender(
      <FieldRenderer name="obj" schema={{ type: 'object' }} value={{}} onChange={onObject} />
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '{"x":1}' } });
    expect(onObject).toHaveBeenCalledWith({ x: 1 });
  });

  it('renders schema fields with required marker and description', () => {
    const schema: OpenAPISchema = {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string', description: 'Project name' },
      },
    };

    render(
      <div>{renderSchemaFields(schema, { name: '' }, () => {})}</div>
    );
    expect(screen.getByText('Name')).toBeTruthy();
    expect(screen.getByText('Project name')).toBeTruthy();
    expect(screen.getByText('*')).toBeTruthy();
  });

  it('submits OpenAPIForm in form mode after validation', () => {
    const onSubmit = vi.fn();
    const schema: OpenAPISchema = {
      type: 'object',
      required: ['name'],
      properties: { name: { type: 'string' } },
    };

    render(<OpenAPIForm schema={schema} onSubmit={onSubmit} />);

    fireEvent.submit(screen.getByRole('button', { name: 'Run' }).closest('form')!);
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Acme' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Run' }).closest('form')!);
    expect(onSubmit).toHaveBeenCalledWith({ name: 'Acme' });
  });

  it('uses OpenAPIForm JSON editor path and reports invalid JSON', () => {
    const onSubmit = vi.fn();
    const schema: OpenAPISchema = {
      oneOf: [{ type: 'object' }, { type: 'object' }],
    };

    render(<OpenAPIForm schema={schema} onSubmit={onSubmit} />);

    const jsonBox = screen.getByRole('textbox');
    fireEvent.change(jsonBox, { target: { value: '{invalid' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Run' }).closest('form')!);
    expect(screen.getByText('Invalid JSON format')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.change(jsonBox, { target: { value: '{"ok":true}' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Run' }).closest('form')!);
    expect(onSubmit).toHaveBeenCalledWith({ ok: true });
  });

  it('useFormState validates enum, numeric bounds and reset/dirty behavior', () => {
    const schema: OpenAPISchema = {
      type: 'object',
      required: ['age', 'status'],
      properties: {
        age: { type: 'integer', minimum: 18, maximum: 60 },
        status: { type: 'string', enum: ['active', 'inactive'] },
      },
    };

    const { result } = renderHook(() =>
      useFormState({ schema, initialValues: { age: 20, status: 'active' } })
    );

    expect(result.current.isDirty).toBe(false);
    act(() => result.current.updateField('status', 'bad'));
    expect(result.current.errors.status).toContain('must be one of');

    act(() => result.current.updateField('age', 10));
    expect(result.current.errors.age).toContain('at least');

    act(() => result.current.updateField('age', 70));
    expect(result.current.errors.age).toContain('at most');

    act(() => {
      result.current.updateField('age', 25);
      result.current.updateField('status', 'inactive');
      result.current.setFieldTouched('status');
    });
    expect(result.current.isDirty).toBe(true);
    expect(result.current.getFieldProps('status').error).toBeUndefined();

    act(() => result.current.reset());
    expect(result.current.formData).toEqual({ age: 20, status: 'active' });
    expect(result.current.isDirty).toBe(false);
  });

  it('useSchemaAnalysis reports complexity, required and optional fields', () => {
    const schema: OpenAPISchema = {
      type: 'object',
      required: ['avatar'],
      properties: {
        avatar: { type: 'string', format: 'binary' },
        mode: { type: 'string', enum: ['a', 'b'] },
      },
    };
    const { result } = renderHook(() => useSchemaAnalysis(schema));
    expect(result.current.hasFileFields).toBe(true);
    expect(result.current.hasEnumFields).toBe(true);
    expect(result.current.requiredFields).toEqual(['avatar']);
    expect(result.current.optionalFields).toEqual(['mode']);
  });

  it('FileUploader handles maxFiles and oversize limits', () => {
    const onUpload = vi.fn();
    render(<FieldRenderer name="file" schema={{ type: 'file' }} value={null} onChange={onUpload} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const twoFiles = [
      new File(['a'], 'a.txt', { type: 'text/plain' }),
      new File(['b'], 'b.txt', { type: 'text/plain' }),
    ];

    fireEvent.change(input, { target: { files: twoFiles } });
    expect(screen.getByText('Maximum 1 files allowed')).toBeTruthy();

    const big = new File([new Uint8Array(11 * 1024 * 1024)], 'big.bin', {
      type: 'application/octet-stream',
    });
    fireEvent.change(input, { target: { files: [big] } });
    expect(screen.getByText(/exceeds/i)).toBeTruthy();
  });

  it('FileUploader uploads and removes a file', async () => {
    const onUpload = vi.fn();
    class MockFileReader {
      onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => void) | null = null;
      onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => void) | null = null;
      result: string | ArrayBuffer | null = null;

      readAsDataURL() {
        this.result = 'data:text/plain;base64,QQ==';
        this.onload?.call(this as unknown as FileReader, {} as ProgressEvent<FileReader>);
      }
    }
    vi.stubGlobal('FileReader', MockFileReader as unknown as typeof FileReader);

    render(<FieldRenderer name="file" schema={{ type: 'file' }} value={null} onChange={onUpload} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const oneFile = new File(['A'], 'one.txt', { type: 'text/plain' });
    fireEvent.change(input, { target: { files: [oneFile] } });

    expect(await screen.findByText('one.txt')).toBeTruthy();
    expect(onUpload).toHaveBeenCalled();

    const removeButtons = screen.getAllByRole('button');
    fireEvent.click(removeButtons[removeButtons.length - 1]);
    expect(onUpload).toHaveBeenLastCalledWith([]);

    vi.unstubAllGlobals();
  });
});
