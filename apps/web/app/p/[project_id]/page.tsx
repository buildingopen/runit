// ABOUTME: Project Run Page - main UI for selecting endpoints, filling forms, and viewing results
// ABOUTME: Integrates EndpointSelector, DynamicForm, ResultViewer, and RunHistory components

'use client';

import { useState, use, useEffect, useRef } from 'react';
import Link from 'next/link';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EndpointSelector } from '@/components/run-page/EndpointSelector';
import { OpenAPIFormThemed } from '@/components/OpenAPIFormThemed';
import { ResultViewer } from '@/components/run-page/ResultViewer';
import { RunHistory } from '@/components/run-page/RunHistory';
import { ShareModal } from '@/components/ShareModal';
import {
  useProject,
  useEndpoints,
  useEndpointSchema,
  useCreateRun,
  useRunStatus,
  useRunsList,
} from '@/lib/hooks/useProject';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30000,
    },
  },
});

interface PageProps {
  params: Promise<{
    project_id: string;
  }>;
}

function ProjectRunPage({ projectId }: { projectId: string }) {
  const [selectedEndpointId, setSelectedEndpointId] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  // Ref for auto-scrolling to result section
  const resultSectionRef = useRef<HTMLDivElement>(null);

  // Fetch project details
  const { data: project, isLoading: projectLoading, error: projectError } = useProject(projectId);

  // Get latest version ID
  const versionId = project?.versions?.[project.versions.length - 1]?.version_id || null;

  // Fetch endpoints
  const {
    data: endpointsData,
    isLoading: endpointsLoading,
    error: endpointsError,
  } = useEndpoints(projectId, versionId || undefined);

  // Fetch schema for selected endpoint
  const {
    data: schemaData,
    isLoading: schemaLoading,
    error: schemaError,
  } = useEndpointSchema(projectId, versionId, selectedEndpointId);

  // Fetch run history
  const { data: runsData, isLoading: runsLoading } = useRunsList(projectId, 20);

  // Fetch selected run status
  const { data: runData } = useRunStatus(selectedRunId);

  // Fetch current run status (auto-polling)
  const { data: currentRunData } = useRunStatus(currentRunId);

  // Execute run mutation
  const executeRun = useCreateRun();

  const handleSubmit = async (formData: Record<string, unknown>, endpointId?: string) => {
    const targetEndpointId = endpointId || selectedEndpointId;
    if (!targetEndpointId || !versionId) return;

    setRunError(null);

    try {
      const result = await executeRun.mutateAsync({
        project_id: projectId,
        version_id: versionId,
        endpoint_id: targetEndpointId,
        json: formData,
        lane: 'cpu',
      });

      // Set current run ID to enable polling
      setCurrentRunId(result.run_id);
      setSelectedRunId(result.run_id);
      // Select the endpoint that was run
      setSelectedEndpointId(targetEndpointId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to execute run';
      setRunError(message);
    }
  };

  // Quick run handler for endpoints without required parameters
  const handleQuickRun = (endpointId: string) => {
    handleSubmit({}, endpointId);
  };

  // Auto-select first endpoint when loaded
  useEffect(() => {
    if (!selectedEndpointId && endpointsData?.endpoints?.length) {
      setSelectedEndpointId(endpointsData.endpoints[0].endpoint_id);
    }
  }, [endpointsData, selectedEndpointId]);

  // Auto-scroll to result section when run completes
  useEffect(() => {
    if (currentRunData?.status === 'success' || currentRunData?.status === 'error') {
      // Small delay to ensure the Result section is rendered
      setTimeout(() => {
        resultSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [currentRunData?.status]);

  const handleSelectRun = (runId: string) => {
    setSelectedRunId(runId);
    setCurrentRunId(null); // Stop polling current run
  };

  if (projectLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center p-6">
          <svg className="w-8 h-8 animate-spin text-[var(--accent)]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm text-[var(--text-secondary)]">Loading project...</span>
        </div>
      </div>
    );
  }

  if (projectError) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="w-14 h-14 bg-[var(--error-subtle)] rounded-xl flex items-center justify-center mx-auto mb-5">
            <svg className="w-7 h-7 text-[var(--error)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h2 className="text-[15px] font-semibold text-[var(--text-primary)] mb-2">
            Failed to load project
          </h2>
          <p className="text-[13px] text-[var(--text-tertiary)] mb-5">
            {projectError instanceof Error ? projectError.message : 'Project not found or access denied'}
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-[13px] font-medium rounded-md"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back to Projects
          </Link>
        </div>
      </div>
    );
  }

  if (endpointsError) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="w-14 h-14 bg-[var(--error-subtle)] rounded-xl flex items-center justify-center mx-auto mb-5">
            <svg className="w-7 h-7 text-[var(--error)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h2 className="text-[15px] font-semibold text-[var(--text-primary)] mb-2">
            Failed to load endpoints
          </h2>
          <p className="text-[13px] text-[var(--text-tertiary)] mb-5">
            {endpointsError instanceof Error ? endpointsError.message : 'Could not fetch endpoints for this project'}
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-[13px] font-medium rounded-md"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back to Projects
          </Link>
        </div>
      </div>
    );
  }

  const endpoints = endpointsData?.endpoints || [];
  const runs = runsData?.runs || [];
  const displayRun = runData || currentRunData;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Page Header */}
      <header className="h-12 sm:h-14 border-b border-[var(--border-subtle)] flex items-center justify-between px-4 sm:px-6">
        <div className="flex items-center min-w-0">
          <Link
            href="/"
            className="flex items-center gap-2 text-[13px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            <span className="hidden sm:inline">Back</span>
          </Link>
          <div className="ml-3 sm:ml-4 pl-3 sm:pl-4 border-l border-[var(--border-subtle)] flex items-center gap-2 min-w-0">
            <h1 className="text-[13px] font-medium text-[var(--text-primary)] truncate">
              {project?.name || 'Project'}
            </h1>
            {versionId && (
              <span className="hidden sm:inline px-1.5 py-0.5 text-[10px] text-[var(--text-tertiary)] font-mono bg-[var(--bg-tertiary)] rounded">
                {versionId.substring(0, 7)}
              </span>
            )}
          </div>
        </div>
        {/* Header actions */}
        <div className="flex items-center gap-2">
          {/* Share button */}
          <button
            onClick={() => setShowShareModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-md transition-colors"
            aria-label="Share project"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
            </svg>
            <span className="hidden sm:inline">Share</span>
          </button>

          {/* Mobile: History toggle */}
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="lg:hidden p-2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-md"
            aria-label={showHistory ? 'Hide history' : 'Show history'}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </div>
      </header>

      {/* Run Error Banner */}
      {runError && (
        <div className="mx-4 sm:mx-6 mt-4 px-4 py-3 bg-[var(--error-subtle)] border border-[var(--error)]/20 rounded-lg flex items-start gap-3">
          <svg className="w-5 h-5 text-[var(--error)] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-[var(--error)]">Run failed</p>
            <p className="text-[12px] text-[var(--error)]/80 mt-0.5">{runError}</p>
          </div>
          <button
            onClick={() => setRunError(null)}
            className="p-1 text-[var(--error)] hover:bg-[var(--error)]/10 rounded flex-shrink-0"
            aria-label="Dismiss error"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Main Content */}
      <div className="p-4 sm:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Left Column - Endpoints & Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Endpoint Selector */}
            <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)] p-4">
              <h2 className="text-sm font-medium text-[var(--text-primary)] mb-4">
                Endpoints
              </h2>
              <EndpointSelector
                endpoints={endpoints}
                selectedId={selectedEndpointId}
                onSelect={setSelectedEndpointId}
                onQuickRun={handleQuickRun}
                isLoading={endpointsLoading}
                isRunning={executeRun.isPending}
                runningEndpointId={executeRun.isPending ? selectedEndpointId : null}
              />
            </div>

            {/* Form */}
            {selectedEndpointId && (
              <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)] p-4">
                <h2 className="text-sm font-medium text-[var(--text-primary)] mb-4">
                  Run Endpoint
                </h2>
                {schemaLoading ? (
                  <div className="animate-pulse space-y-3">
                    <div className="h-10 bg-[var(--bg-tertiary)] rounded" />
                    <div className="h-10 bg-[var(--bg-tertiary)] rounded" />
                    <div className="h-10 bg-[var(--bg-tertiary)] rounded" />
                  </div>
                ) : schemaError ? (
                  <div className="px-3 py-2 bg-[var(--error)]/10 border border-[var(--error)]/20 rounded text-sm text-[var(--error)]">
                    Failed to load endpoint schema
                  </div>
                ) : schemaData?.schema ? (
                  <OpenAPIFormThemed
                    schema={schemaData.schema}
                    onSubmit={handleSubmit}
                    isSubmitting={executeRun.isPending}
                    submitLabel="Run"
                    loadingLabel="Running..."
                  />
                ) : (
                  // No request body required (e.g., GET endpoints) - show simple Run button
                  <div className="space-y-4">
                    <p className="text-sm text-[var(--text-tertiary)]">
                      This endpoint doesn&apos;t require a request body.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleSubmit({})}
                      disabled={executeRun.isPending}
                      className="w-full px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:bg-[var(--bg-tertiary)] disabled:text-[var(--text-tertiary)] text-white text-sm font-medium rounded transition-colors"
                    >
                      {executeRun.isPending ? 'Running...' : 'Run'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Result */}
            {displayRun && displayRun.result !== undefined && (
              <div
                ref={resultSectionRef}
                className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)] p-4"
                data-testid="result-section"
              >
                <h2 className="text-sm font-medium text-[var(--text-primary)] mb-4">
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
                <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)] p-4">
                  <div className="flex items-center gap-3">
                    <svg className="w-4 h-4 animate-spin text-[var(--accent)]" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        {currentRunData.status === 'queued'
                          ? 'Run queued...'
                          : 'Running...'}
                      </p>
                      <p className="text-xs text-[var(--text-tertiary)] font-mono">
                        {currentRunId.substring(0, 8)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
          </div>

          {/* Right Column - Run History */}
          <div className={`lg:col-span-1 ${showHistory ? 'block' : 'hidden lg:block'}`}>
            <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)] p-4 lg:sticky lg:top-6">
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

      {/* Mobile History Overlay */}
      {showHistory && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setShowHistory(false)}
          aria-hidden="true"
        />
      )}

      {/* Share Modal */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        projectId={projectId}
        selectedEndpointId={selectedEndpointId}
        endpoints={endpoints}
      />
    </div>
  );
}

export default function Page({ params }: PageProps) {
  const resolvedParams = use(params);

  return (
    <QueryClientProvider client={queryClient}>
      <ProjectRunPage projectId={resolvedParams.project_id} />
    </QueryClientProvider>
  );
}
