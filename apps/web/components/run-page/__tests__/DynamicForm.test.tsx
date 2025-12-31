// ABOUTME: Tests for DynamicForm component - schema parsing, form generation, validation
// ABOUTME: Tests simple schemas -> native inputs and complex schemas -> JSON editor

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DynamicForm } from '../DynamicForm';

describe('DynamicForm', () => {
  it('renders simple string input', () => {
    const schema = {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Your name',
        },
      },
      required: ['name'],
    };

    const onSubmit = vi.fn();

    render(<DynamicForm schema={schema} onSubmit={onSubmit} />);

    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByText('Your name')).toBeInTheDocument();
  });

  it('renders number input with default value', () => {
    const schema = {
      type: 'object',
      properties: {
        count: {
          type: 'number',
          default: 10,
          description: 'Item count',
        },
      },
    };

    const onSubmit = vi.fn();

    render(<DynamicForm schema={schema} onSubmit={onSubmit} />);

    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    expect(input.value).toBe('10');
  });

  it('renders boolean checkbox', () => {
    const schema = {
      type: 'object',
      properties: {
        enabled: {
          type: 'boolean',
          description: 'Enable feature',
        },
      },
    };

    const onSubmit = vi.fn();

    render(<DynamicForm schema={schema} onSubmit={onSubmit} />);

    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('renders enum as dropdown', () => {
    const schema = {
      type: 'object',
      properties: {
        color: {
          type: 'string',
          enum: ['red', 'green', 'blue'],
        },
      },
    };

    const onSubmit = vi.fn();

    render(<DynamicForm schema={schema} onSubmit={onSubmit} />);

    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
    expect(screen.getByText('red')).toBeInTheDocument();
    expect(screen.getByText('green')).toBeInTheDocument();
    expect(screen.getByText('blue')).toBeInTheDocument();
  });

  it('falls back to JSON editor for complex schemas', () => {
    const schema = {
      type: 'object',
      oneOf: [
        { properties: { type: { const: 'A' } } },
        { properties: { type: { const: 'B' } } },
      ],
    };

    const onSubmit = vi.fn();

    render(<DynamicForm schema={schema} onSubmit={onSubmit} />);

    expect(screen.getByText(/advanced schema features/i)).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('submits form data', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
      },
    };

    const onSubmit = vi.fn();

    render(<DynamicForm schema={schema} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: 'John' },
    });
    fireEvent.change(screen.getByLabelText(/age/i), {
      target: { value: '30' },
    });

    fireEvent.click(screen.getByRole('button', { name: /run/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'John',
      age: 30,
    });
  });

  it('validates required fields', () => {
    const schema = {
      type: 'object',
      properties: {
        email: { type: 'string' },
      },
      required: ['email'],
    };

    const onSubmit = vi.fn();

    render(<DynamicForm schema={schema} onSubmit={onSubmit} />);

    const input = screen.getByLabelText(/email/i);
    expect(input).toHaveAttribute('required');
  });

  it('allows switching between form and JSON editor', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
      },
    };

    const onSubmit = vi.fn();

    render(<DynamicForm schema={schema} onSubmit={onSubmit} />);

    // Initially shows form
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();

    // Switch to JSON editor
    fireEvent.click(screen.getByText(/switch to json editor/i));

    // Now shows JSON textarea
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.queryByLabelText(/name/i)).not.toBeInTheDocument();
  });
});
