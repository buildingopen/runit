// ABOUTME: Run Result View Page - Read-only view of a completed run
// ABOUTME: Accessible via share links, shows results without edit capabilities

'use client';

import { use } from 'react';
import Link from 'next/link';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRunStatus } from '@/lib/hooks/useProject';
import { ResultViewer } from '@/components/run-page/ResultViewer';

const queryClient = new QueryClient();

interface PageProps {
  params: Promise<{
    run_id: string;
  }>;
}

function RunResultPage({ params }: { params: Promise<{ run_id: string }> }) {
  const resolvedParams = use(params);
  const runId = resolvedParams.run_id;

  // Fetch run data
  const { data: runData, isLoading, error } = useRunStatus(runId);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-[var(--border)] border-t-[var(--text-primary)] rounded-full animate-spin" />
          <p className="text-sm text-[var(--text-tertiary)]">Loading run result...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)] p-6">
        <div className="max-w-md text-center">
          <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--error)]/20 p-8">
            <div className="w-12 h-12 rounded-full bg-[var(--error-subtle)] flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-[var(--error)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
              Run not found
            </h2>
            <p className="text-[var(--text-secondary)]">
              {error instanceof Error ? error.message : 'This run does not exist or has been deleted'}
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 mt-6 px-4 py-2 text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-md transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              Back to Apps
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!runData) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Header */}
      <header className="bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)]">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-3 h-3 rounded-full ${
              runData.status === 'success' ? 'bg-[var(--success)]' :
              runData.status === 'error' ? 'bg-[var(--error)]' :
              runData.status === 'timeout' ? 'bg-[var(--warning)]' :
              'bg-[var(--warning)]'
            }`} />
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">
              Run Result
            </h1>
          </div>
          <p className="text-sm text-[var(--text-tertiary)] font-mono">
            Run ID: {runId}
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Loading State for Running Runs */}
        {(runData.status === 'queued' || runData.status === 'running') && (
          <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border)] p-8 mb-6">
            <div className="flex items-center gap-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]" />
              <div>
                <p className="text-lg font-medium text-[var(--text-primary)]">
                  {runData.status === 'queued' ? 'Run queued...' : 'Running...'}
                </p>
                <p className="text-sm text-[var(--text-tertiary)]">
                  This run is still in progress
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Result */}
        {runData.result && (
          <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border)] p-6">
            <ResultViewer
              result={runData.result}
              status={runData.status}
              duration_ms={runData.duration_ms}
            />
          </div>
        )}

        {/* Info Notice */}
        <div className="mt-6 bg-[var(--accent)]/10 border border-[var(--accent)]/20 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-[var(--accent)] mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div>
              <h3 className="text-sm font-medium text-[var(--text-primary)]">
                This is a read-only view
              </h3>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                This page shows the result of a completed run. The run was executed by someone who shared this link with you.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function Page(props: PageProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <RunResultPage params={props.params} />
    </QueryClientProvider>
  );
}
