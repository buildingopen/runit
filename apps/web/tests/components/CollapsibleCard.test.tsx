/**
 * CollapsibleCard component tests
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CollapsibleCard } from '@/components/run-page/CollapsibleCard';

describe('CollapsibleCard', () => {
  it('renders label and preview when collapsed', () => {
    render(
      <CollapsibleCard label="Details" preview="3 fields">
        <p>Hidden content</p>
      </CollapsibleCard>
    );

    expect(screen.getByText('Details')).toBeInTheDocument();
    expect(screen.getByText('3 fields')).toBeInTheDocument();
    expect(screen.queryByText('Hidden content')).not.toBeInTheDocument();
  });

  it('shows children when defaultOpen is true', () => {
    render(
      <CollapsibleCard label="Open" defaultOpen>
        <p>Visible content</p>
      </CollapsibleCard>
    );

    expect(screen.getByText('Visible content')).toBeInTheDocument();
  });

  it('toggles open/closed on click', () => {
    render(
      <CollapsibleCard label="Toggle" preview="preview text">
        <p>Toggled content</p>
      </CollapsibleCard>
    );

    // Initially closed
    expect(screen.queryByText('Toggled content')).not.toBeInTheDocument();
    expect(screen.getByText('preview text')).toBeInTheDocument();

    // Click to open
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Toggled content')).toBeInTheDocument();

    // Click to close again
    fireEvent.click(screen.getByRole('button'));
    expect(screen.queryByText('Toggled content')).not.toBeInTheDocument();
  });

  it('hides preview when open', () => {
    render(
      <CollapsibleCard label="Card" preview="summary">
        <p>Content</p>
      </CollapsibleCard>
    );

    expect(screen.getByText('summary')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button'));
    expect(screen.queryByText('summary')).not.toBeInTheDocument();
  });

  it('renders without preview', () => {
    render(
      <CollapsibleCard label="No Preview">
        <p>Content</p>
      </CollapsibleCard>
    );

    expect(screen.getByText('No Preview')).toBeInTheDocument();
  });
});
