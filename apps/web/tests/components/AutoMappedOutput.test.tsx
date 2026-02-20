/**
 * AutoMappedOutput component tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AutoMappedOutput } from '@/components/run-page/AutoMappedOutput';

describe('AutoMappedOutput', () => {
  it('renders null/undefined as dash', () => {
    render(<AutoMappedOutput data={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders strings', () => {
    render(<AutoMappedOutput data="Hello World" />);
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('renders numbers', () => {
    render(<AutoMappedOutput data={42} />);
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders booleans with badges', () => {
    const { rerender } = render(<AutoMappedOutput data={true} />);
    expect(screen.getByText('Yes')).toBeInTheDocument();

    rerender(<AutoMappedOutput data={false} />);
    expect(screen.getByText('No')).toBeInTheDocument();
  });

  it('renders arrays as tag list when strings', () => {
    render(<AutoMappedOutput data={['tag1', 'tag2', 'tag3']} />);
    expect(screen.getByText('tag1')).toBeInTheDocument();
    expect(screen.getByText('tag2')).toBeInTheDocument();
    expect(screen.getByText('tag3')).toBeInTheDocument();
  });

  it('renders objects with humanized labels', () => {
    render(<AutoMappedOutput data={{ word_count: 1000, citation_count: 50 }} />);
    expect(screen.getByText('Word Count')).toBeInTheDocument();
    expect(screen.getByText(/1000|1,000/)).toBeInTheDocument();
    expect(screen.getByText('Citation Count')).toBeInTheDocument();
    expect(screen.getByText(/50/)).toBeInTheDocument();
  });

  it('renders URLs as clickable links', () => {
    render(<AutoMappedOutput data={{ link: 'https://example.com' }} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('renders nested objects', () => {
    render(
      <AutoMappedOutput
        data={{
          result: {
            success: true,
            count: 10,
          },
        }}
      />
    );
    // Should render the nested object label
    expect(screen.getByText('Result')).toBeInTheDocument();
    // Nested objects are collapsed by default - just verify structure exists
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('handles complex OpenDraft-like output', () => {
    const openDraftOutput = {
      success: true,
      topic: 'AI in Healthcare',
      word_count: 8976,
      citation_count: 148,
      artifacts: ['draft.md', 'outline.md', 'research.zip'],
    };

    render(<AutoMappedOutput data={openDraftOutput} />);

    expect(screen.getByText('Yes')).toBeInTheDocument(); // success
    expect(screen.getByText('AI in Healthcare')).toBeInTheDocument();
    // Numbers might be formatted differently
    expect(screen.getByText(/8976|8,976/)).toBeInTheDocument();
    expect(screen.getByText(/148/)).toBeInTheDocument();
    expect(screen.getByText('draft.md')).toBeInTheDocument();
  });

  it('handles empty objects', () => {
    render(<AutoMappedOutput data={{}} />);
    // Should render something, not crash
    expect(document.body).toBeInTheDocument();
  });

  it('handles empty arrays', () => {
    render(<AutoMappedOutput data={[]} />);
    expect(screen.getByText('[ ]')).toBeInTheDocument();
  });

  it('renders empty object as "Empty object"', () => {
    render(<AutoMappedOutput data={{}} />);
    expect(screen.getByText('Empty object')).toBeInTheDocument();
  });

  it('renders arrays of primitives (numbers) inline', () => {
    render(<AutoMappedOutput data={[1, 2, null, 3]} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders arrays of objects as collapsible items', () => {
    render(
      <AutoMappedOutput
        data={[
          { name: 'Alice', age: 30 },
          { name: 'Bob', age: 25 },
        ]}
      />
    );

    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();

    // Expand first item
    fireEvent.click(screen.getByText('Item 1'));
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('renders decimal numbers with formatting', () => {
    render(<AutoMappedOutput data={{ pi: 3.141593 }} />);
    expect(screen.getByText(/3\.141/)).toBeInTheDocument();
  });

  it('renders nested object at depth > 0 as collapsible card', () => {
    render(
      <AutoMappedOutput
        data={{
          metadata: {
            author: 'Test',
            nested: { deep: true },
          },
        }}
      />
    );

    // metadata is a nested object, rendered as collapsible
    expect(screen.getByText('Metadata')).toBeInTheDocument();
    // Expand it
    fireEvent.click(screen.getByText('Metadata'));
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('renders empty nested object with label', () => {
    render(
      <AutoMappedOutput
        data={{
          info: {},
        }}
      />
    );
    // Label renders even when value is empty
    expect(screen.getByText('Info')).toBeInTheDocument();
  });

  it('handles copy-to-clipboard on number hover/click', () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: writeTextMock } });

    render(<AutoMappedOutput data={{ count: 42 }} />);
    const numberEl = screen.getByText('42');

    // Hover to show copy hint
    fireEvent.mouseEnter(numberEl);
    expect(screen.getByText('copy')).toBeInTheDocument();

    // Click to copy
    fireEvent.click(numberEl);
    expect(writeTextMock).toHaveBeenCalledWith('42');

    // Mouse leave hides copy hint
    fireEvent.mouseLeave(numberEl);
  });

  it('handles copy-to-clipboard on string hover/click', () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: writeTextMock } });

    render(<AutoMappedOutput data={{ name: 'hello' }} />);
    const strEl = screen.getByText('hello');

    fireEvent.mouseEnter(strEl);
    expect(screen.getByText('copy')).toBeInTheDocument();

    fireEvent.click(strEl);
    expect(writeTextMock).toHaveBeenCalledWith('hello');

    fireEvent.mouseLeave(strEl);
  });

  it('renders object field values as null dash', () => {
    render(<AutoMappedOutput data={{ missing: null }} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders nested array of objects inside object field', () => {
    render(
      <AutoMappedOutput
        data={{
          items: [
            { id: 1, label: 'First' },
            { id: 2, label: 'Second' },
          ],
        }}
      />
    );

    // items is an array with objects, shown as collapsible
    expect(screen.getByText('Items')).toBeInTheDocument();
  });

  it('handles camelCase key humanization', () => {
    render(<AutoMappedOutput data={{ firstName: 'John' }} />);
    expect(screen.getByText('First Name')).toBeInTheDocument();
  });
});
