/**
 * EndpointSelector component tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EndpointSelector } from '@/components/run-page/EndpointSelector';

const mockEndpoints = [
  {
    endpoint_id: 'post--generate',
    method: 'POST',
    path: '/generate',
    summary: 'Generate Paper',
    description: 'Generate a research paper on a given topic',
  },
  {
    endpoint_id: 'get--health',
    method: 'GET',
    path: '/health',
    summary: 'Health Check',
  },
  {
    endpoint_id: 'get--root',
    method: 'GET',
    path: '/',
    // No summary - should show formatted path
  },
];

describe('EndpointSelector', () => {
  it('renders loading state', () => {
    render(
      <EndpointSelector
        endpoints={[]}
        selectedId={null}
        onSelect={vi.fn()}
        isLoading={true}
      />
    );
    // Should show skeleton loaders
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders empty state when no endpoints', () => {
    render(
      <EndpointSelector
        endpoints={[]}
        selectedId={null}
        onSelect={vi.fn()}
      />
    );
    expect(screen.getByText(/no actions found/i)).toBeInTheDocument();
  });

  it('renders endpoints with friendly names', () => {
    render(
      <EndpointSelector
        endpoints={mockEndpoints}
        selectedId={null}
        onSelect={vi.fn()}
      />
    );

    // Should show summary as display name
    expect(screen.getByText('Generate Paper')).toBeInTheDocument();
    expect(screen.getByText('Health Check')).toBeInTheDocument();
  });

  it('shows formatted path when no summary', () => {
    render(
      <EndpointSelector
        endpoints={mockEndpoints}
        selectedId={null}
        onSelect={vi.fn()}
      />
    );

    // Root endpoint has no summary, should show path formatted
    // "/" -> special case, might show as "Root" or similar
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBe(3);
  });

  it('calls onSelect when endpoint is clicked', () => {
    const onSelect = vi.fn();
    render(
      <EndpointSelector
        endpoints={mockEndpoints}
        selectedId={null}
        onSelect={onSelect}
      />
    );

    fireEvent.click(screen.getByText('Generate Paper'));
    expect(onSelect).toHaveBeenCalledWith('post--generate');
  });

  it('highlights selected endpoint', () => {
    render(
      <EndpointSelector
        endpoints={mockEndpoints}
        selectedId="post--generate"
        onSelect={vi.fn()}
      />
    );

    // Selected item container should have accent styling
    const containers = document.querySelectorAll('[class*="bg-[var(--accent)]"]');
    expect(containers.length).toBeGreaterThan(0);
  });

  it('shows description when available', () => {
    render(
      <EndpointSelector
        endpoints={mockEndpoints}
        selectedId={null}
        onSelect={vi.fn()}
      />
    );

    expect(screen.getByText(/generate a research paper/i)).toBeInTheDocument();
  });

  it('shows GPU badge for GPU endpoints', () => {
    const gpuEndpoints = [
      {
        endpoint_id: 'post--inference',
        method: 'POST',
        path: '/inference',
        summary: 'Run Inference',
        requires_gpu: true,
      },
    ];

    render(
      <EndpointSelector
        endpoints={gpuEndpoints}
        selectedId={null}
        onSelect={vi.fn()}
      />
    );

    expect(screen.getByText('GPU')).toBeInTheDocument();
  });

  it('shows quick run button for GET endpoints without params', () => {
    const onQuickRun = vi.fn();
    render(
      <EndpointSelector
        endpoints={mockEndpoints}
        selectedId={null}
        onSelect={vi.fn()}
        onQuickRun={onQuickRun}
      />
    );

    // GET /health should have quick run button
    const quickRunButtons = document.querySelectorAll('[title^="Run"]');
    expect(quickRunButtons.length).toBeGreaterThan(0);
  });

  it('calls onQuickRun when quick run button is clicked', () => {
    const onSelect = vi.fn();
    const onQuickRun = vi.fn();
    render(
      <EndpointSelector
        endpoints={mockEndpoints}
        selectedId={null}
        onSelect={onSelect}
        onQuickRun={onQuickRun}
      />
    );

    const quickRunButtons = document.querySelectorAll('[title^="Run"]');
    expect(quickRunButtons.length).toBeGreaterThan(0);

    fireEvent.click(quickRunButtons[0]);
    expect(onQuickRun).toHaveBeenCalled();
    // Should NOT trigger onSelect (stopPropagation)
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('formats path segment as display name when no summary', () => {
    const endpoints = [
      {
        endpoint_id: 'get--users',
        method: 'GET',
        path: '/users',
      },
    ];

    render(
      <EndpointSelector
        endpoints={endpoints}
        selectedId={null}
        onSelect={vi.fn()}
      />
    );

    // /users -> "Users" (capitalized first segment)
    expect(screen.getByText('Users')).toBeInTheDocument();
  });

  it('shows running state for running endpoint', () => {
    render(
      <EndpointSelector
        endpoints={mockEndpoints}
        selectedId="get--health"
        onSelect={vi.fn()}
        onQuickRun={vi.fn()}
        isRunning={true}
        runningEndpointId="get--health"
      />
    );

    // Running spinner should be visible on the quick run button
    const spinners = document.querySelectorAll('.animate-spin');
    expect(spinners.length).toBeGreaterThan(0);
  });
});
