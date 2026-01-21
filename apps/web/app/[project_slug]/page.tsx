// ABOUTME: Project Run Page - main UI for selecting endpoints, filling forms, and viewing results
// ABOUTME: Integrates EndpointSelector, DynamicForm, ResultViewer, and RunHistory components

'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EndpointSelector } from '@/components/run-page/EndpointSelector';
import { OpenAPIFormThemed } from '@/components/OpenAPIFormThemed';
import { ResultViewer } from '@/components/run-page/ResultViewer';
import { RunHistory } from '@/components/run-page/RunHistory';
import {
  useEndpoints,
  useEndpointSchema,
  useRunExecution,
  useRunStatus,
  useRunsList,
} from '@/lib/hooks/useRunExecution';

const queryClient = new QueryClient();

interface PageProps {
  params: Promise<{
    project_slug: string;
  }>;
}

function ProjectRunPage({ params }: { params: Promise<{ project_slug: string }> }) {
  const resolvedParams = use(params);
  const [selectedEndpointId, setSelectedEndpointId] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // For demo purposes, using hardcoded project_id and version_id
  // In production, these would come from API or database
  const projectId = 'demo-project-id';
  const versionId = 'demo-version-id';

  // Fetch endpoints
  const {
    data: endpointsData,
    isLoading: endpointsLoading,
    error: endpointsError,
  } = useEndpoints(projectId, versionId);

  // Fetch schema for selected endpoint
  const {
    data: schemaData,
    isLoading: schemaLoading,
    error: schemaError,
  } = useEndpointSchema(projectId, versionId, selectedEndpointId);

  // Fetch run history
  const { data: runsData, isLoading: runsLoading } = useRunsList(
    projectId,
    selectedEndpointId || undefined
  );

  // Fetch selected run status
  const { data: runData } = useRunStatus(selectedRunId);

  // Fetch current run status (auto-polling)
  const { data: currentRunData } = useRunStatus(currentRunId);

  // Execute run mutation
  const executeRun = useRunExecution();

  // Auto-select first endpoint
  useEffect(() => {
    if (endpointsData?.endpoints?.length && !selectedEndpointId) {
      setSelectedEndpointId(endpointsData.endpoints[0].endpoint_id);
    }
  }, [endpointsData, selectedEndpointId]);

  const handleSubmit = async (formData: Record<string, unknown>) => {
    if (!selectedEndpointId) return;

    try {
      const result = await executeRun.mutateAsync({
        project_id: projectId,
        version_id: versionId,
        endpoint_id: selectedEndpointId,
        json: formData,
        lane: 'cpu',
        timeout_seconds: 60,
      });

      // Set current run ID to enable polling
      setCurrentRunId(result.run_id);
      setSelectedRunId(result.run_id);
    } catch (error) {
      console.error('Failed to execute run:', error);
    }
  };

  const handleSelectRun = (runId: string) => {
    setSelectedRunId(runId);
    setCurrentRunId(null); // Stop polling current run
  };

  if (endpointsError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)] p-6">
        <div className="max-w-md text-center">
          <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--error)]/20 p-8">
            <div className="w-12 h-12 rounded-full bg-[var(--error-subtle)] flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-[var(--error)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
              Failed to load endpoints
            </h2>
            <p className="text-[var(--text-secondary)]">
              {endpointsError instanceof Error
                ? endpointsError.message
                : 'Unknown error'}
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 mt-6 px-4 py-2 text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-md transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              Back to Projects
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const endpoints = endpointsData?.endpoints || [];
  const runs = runsData?.runs || [];
  const displayRun = runData || currentRunData;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Header */}
      <header className="border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-md transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
              </Link>
              <div>
                <h1 className="text-xl sm:text-2xl font-semibold text-[var(--text-primary)]">
                  {resolvedParams.project_slug}
                </h1>
                <p className="text-sm text-[var(--text-tertiary)] mt-0.5">
                  Select an endpoint to run
                </p>
              </div>
            </div>
            {/* Mobile history toggle */}
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="lg:hidden p-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-md"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Left Column - Endpoints & Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Endpoint Selector */}
            <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)] p-4 sm:p-6">
              <h2 className="text-[15px] font-semibold text-[var(--text-primary)] mb-4">
                Endpoints
              </h2>
              <EndpointSelector
                endpoints={endpoints}
                selectedId={selectedEndpointId}
                onSelect={setSelectedEndpointId}
                isLoading={endpointsLoading}
              />
            </div>

            {/* Form */}
            {selectedEndpointId && (
              <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)] p-4 sm:p-6">
                <h2 className="text-[15px] font-semibold text-[var(--text-primary)] mb-4">
                  Run Endpoint
                </h2>
                {schemaLoading ? (
                  <div className="animate-pulse space-y-4">
                    <div className="h-10 bg-[var(--bg-tertiary)] rounded" />
                    <div className="h-10 bg-[var(--bg-tertiary)] rounded" />
                    <div className="h-10 bg-[var(--bg-tertiary)] rounded" />
                  </div>
                ) : schemaError ? (
                  <div className="p-4 bg-[var(--error-subtle)] border border-[var(--error)]/20 rounded-lg">
                    <p className="text-sm text-[var(--error)]">
                      Failed to load endpoint schema
                    </p>
                  </div>
                ) : schemaData?.request_schema ? (
                  <OpenAPIFormThemed
                    schema={schemaData.request_schema as Record<string, unknown>}
                    onSubmit={handleSubmit}
                    isSubmitting={executeRun.isPending}
                    submitLabel="Run"
                    loadingLabel="Running..."
                  />
                ) : (
                  <p className="text-sm text-[var(--text-tertiary)]">No schema available</p>
                )}
              </div>
            )}

            {/* Result */}
            {displayRun && displayRun.result && (
              <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)] p-4 sm:p-6">
                <h2 className="text-[15px] font-semibold text-[var(--text-primary)] mb-4">
                  Result
                </h2>
                <ResultViewer
                  result={displayRun.result}
                  status={displayRun.status}
                  duration_ms={displayRun.duration_ms}
                />
              </div>
            )}

            {/* Loading State for Current Run */}
            {currentRunId &&
              currentRunData &&
              (currentRunData.status === 'queued' ||
                currentRunData.status === 'running') && (
                <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)] p-4 sm:p-6">
                  <div className="flex items-center gap-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[var(--accent)]" />
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        {currentRunData.status === 'queued'
                          ? 'Run queued...'
                          : 'Running...'}
                      </p>
                      <p className="text-xs text-[var(--text-tertiary)] font-mono">
                        Run ID: {currentRunId}
                      </p>
                    </div>
                  </div>
                </div>
              )}
          </div>

          {/* Right Column - Run History */}
          <div className={`lg:col-span-1 ${showHistory ? 'block' : 'hidden lg:block'}`}>
            <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)] p-4 sm:p-6 sticky top-8">
              <RunHistory
                runs={runs}
                selectedRunId={selectedRunId}
                onSelectRun={handleSelectRun}
                isLoading={runsLoading}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Page(props: PageProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ProjectRunPage params={props.params} />
    </QueryClientProvider>
  );
}
