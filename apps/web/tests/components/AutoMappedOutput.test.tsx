/**
 * AutoMappedOutput component tests
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
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
    // Should render something, not crash
    expect(document.body).toBeInTheDocument();
  });
});
