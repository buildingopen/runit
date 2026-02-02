// ABOUTME: Run Page - matches wireframe design exactly
// ABOUTME: Full-page 35/65 split with Pre-Run, Running, Post-Run states

'use client';

import { useState, use, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OpenAPIFormThemed } from '@/components/OpenAPIFormThemed';
import { AutoMappedOutput } from '@/components/run-page/AutoMappedOutput';
import {
  useProject,
  useEndpoints,
  useEndpointSchema,
  useCreateRun,
  useRunStatus,
} from '@/lib/hooks/useProject';
import { apiClient } from '@/lib/api/client';

type RunPageState = 'pre-run' | 'running' | 'post-run';

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
  searchParams: Promise<{
    endpoint?: string;
  }>;
}

function RunPage({ projectId, endpointParam }: { projectId: string; endpointParam?: string }) {
  const router = useRouter();
  const [pageState, setPageState] = useState<RunPageState>('pre-run');
  const [runStartTime, setRunStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'formatted' | 'raw'>('formatted');
  const [isRedeploying, setIsRedeploying] = useState(false);

  // Secrets state
  const [showSecrets, setShowSecrets] = useState(false);
  const [secrets, setSecrets] = useState<Array<{ key: string; value: string }>>([]);
  const [newSecretKey, setNewSecretKey] = useState('');
  const [newSecretValue, setNewSecretValue] = useState('');

  const addSecret = () => {
    if (newSecretKey.trim() && newSecretValue.trim()) {
      setSecrets([...secrets, { key: newSecretKey.trim(), value: newSecretValue.trim() }]);
      setNewSecretKey('');
      setNewSecretValue('');
    }
  };

  const removeSecret = (index: number) => {
    setSecrets(secrets.filter((_, i) => i !== index));
  };

  // Fetch project details
  const { data: project, isLoading: projectLoading, error: projectError } = useProject(projectId);

  // Handle status-based routing
  useEffect(() => {
    if (!project) return;

    const status = (project as any).status;
    if (status === 'draft') {
      router.push(`/create/configure?project=${projectId}`);
    } else if (status === 'deploying') {
      router.push(`/p/${projectId}/deploying`);
    }
  }, [project, projectId, router]);

  // Handle redeploy
  const handleRedeploy = async () => {
    setIsRedeploying(true);
    try {
      await apiClient.redeploy(projectId);
      router.push(`/p/${projectId}/deploying`);
    } catch (err) {
      console.error('Redeploy failed:', err);
      setIsRedeploying(false);
    }
  };

  // Get latest version ID
  const versionId = project?.versions?.[project.versions.length - 1]?.version_id || null;

  // Fetch endpoints to get selected endpoint info
  const { data: endpointsData } = useEndpoints(projectId, versionId || undefined);

  // Determine selected endpoint (from URL param or first endpoint)
  const selectedEndpointId = endpointParam || endpointsData?.endpoints?.[0]?.endpoint_id || null;
  const selectedEndpoint = endpointsData?.endpoints?.find(e => e.endpoint_id === selectedEndpointId);

  // Fetch schema for selected endpoint
  const { data: schemaData, isLoading: schemaLoading } = useEndpointSchema(
    projectId,
    versionId,
    selectedEndpointId
  );

  // Fetch current run status (auto-polling)
  const { data: currentRunData } = useRunStatus(currentRunId);

  // Execute run mutation
  const executeRun = useCreateRun();

  // Elapsed time counter
  useEffect(() => {
    if (pageState !== 'running' || !runStartTime) {
      return;
    }

    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - runStartTime.getTime()) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [pageState, runStartTime]);

  // Update page state based on run status
  useEffect(() => {
    if (currentRunData?.status === 'success' || currentRunData?.status === 'error') {
      setPageState('post-run');
    } else if (currentRunData?.status === 'queued' || currentRunData?.status === 'running') {
      setPageState('running');
    }
  }, [currentRunData?.status]);

  const handleSubmit = async (formData: Record<string, unknown>) => {
    if (!selectedEndpointId || !versionId) return;

    setPageState('running');
    setRunStartTime(new Date());
    setElapsedTime(0);

    try {
      const result = await executeRun.mutateAsync({
        project_id: projectId,
        version_id: versionId,
        endpoint_id: selectedEndpointId,
        json: formData,
        lane: 'cpu',
      });
      setCurrentRunId(result.run_id);
    } catch {
      setPageState('pre-run');
    }
  };

  const handleRunAgain = () => {
    setPageState('pre-run');
    setCurrentRunId(null);
    setRunStartTime(null);
    setElapsedTime(0);
  };

  const handleCopyAll = () => {
    if (!currentRunData?.result?.json) return;
    const text = JSON.stringify(currentRunData.result.json, null, 2);
    navigator.clipboard.writeText(text);
  };

  // Format endpoint name for display
  const endpointDisplayName = selectedEndpoint
    ? selectedEndpoint.summary || `${selectedEndpoint.method} ${selectedEndpoint.path}`
    : 'Loading...';

  // Loading state
  if (projectLoading) {
    return (
      <div className="h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-[var(--border-secondary)] border-t-[var(--accent)] rounded-full animate-spin" />
          <span className="text-sm text-[var(--text-secondary)]">Loading...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (projectError) {
    return (
      <div className="h-screen bg-[var(--bg-primary)] flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-[var(--error)]/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-[var(--error)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Failed to load project</h2>
          <p className="text-sm text-[var(--text-tertiary)] mb-6">
            {projectError instanceof Error ? projectError.message : 'Project not found'}
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-medium rounded-lg"
          >
            Back to Projects
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[var(--bg-primary)] flex flex-col">
      {/* Header */}
      <header className="h-14 bg-[var(--bg-secondary)] border-b border-[var(--border)] flex items-center px-6 gap-4 flex-shrink-0">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-3 py-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back
        </Link>
        <span className="text-base font-semibold text-[var(--text-primary)]">
          {endpointDisplayName}
        </span>
        <div className="ml-auto flex items-center gap-3">
          {/* Redeploy button (only for live apps) */}
          {(project as any)?.status === 'live' && (
            <button
              onClick={handleRedeploy}
              disabled={isRedeploying}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors disabled:opacity-50"
            >
              <svg className={`w-4 h-4 ${isRedeploying ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              {isRedeploying ? 'Redeploying...' : 'Redeploy'}
            </button>
          )}
          {/* Env button */}
          <button
            onClick={() => setShowSecrets(!showSecrets)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
              showSecrets || secrets.length > 0
                ? 'bg-[var(--accent)]/15 text-[var(--accent)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
            </svg>
            Env {secrets.length > 0 && `(${secrets.length})`}
          </button>
          <span
            className={`px-3 py-1.5 rounded-full text-sm font-medium ${
              pageState === 'running'
                ? 'bg-[var(--accent)]/15 text-[var(--accent)]'
                : (project as any)?.status === 'failed'
                ? 'bg-[var(--error)]/15 text-[var(--error)]'
                : 'bg-[var(--success)]/15 text-[var(--success)]'
            }`}
          >
            {pageState === 'running' ? 'Running...' : (project as any)?.status === 'failed' ? 'Failed' : 'Ready'}
          </span>
        </div>
      </header>

      {/* Failed State Banner */}
      {(project as any)?.status === 'failed' && (project as any)?.deploy_error && (
        <div className="px-6 py-3 bg-[var(--error)]/10 border-b border-[var(--error)]/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-[var(--error)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <span className="text-sm text-[var(--error)]">
              Deployment failed: {(project as any).deploy_error}
            </span>
          </div>
          <button
            onClick={handleRedeploy}
            disabled={isRedeploying}
            className="px-3 py-1.5 bg-[var(--error)] hover:bg-[var(--error)]/90 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50"
          >
            {isRedeploying ? 'Retrying...' : 'Try Again'}
          </button>
        </div>
      )}

      {/* Env Panel */}
      {showSecrets && (
        <div className="bg-[var(--bg-secondary)] border-b border-[var(--border)] px-6 py-4">
          <div className="max-w-xl">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-medium text-[var(--text-secondary)]">Environment Variables</span>
              <span className="text-xs text-[var(--text-tertiary)]">(available as os.environ)</span>
            </div>
            {/* Existing secrets */}
            {secrets.length > 0 && (
              <div className="space-y-2 mb-3">
                {secrets.map((secret, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <code className="flex-1 px-2 py-1 bg-[var(--bg-tertiary)] text-xs text-[var(--text-primary)] rounded font-mono">
                      {secret.key}
                    </code>
                    <span className="text-xs text-[var(--text-tertiary)]">=</span>
                    <code className="flex-1 px-2 py-1 bg-[var(--bg-tertiary)] text-xs text-[var(--text-tertiary)] rounded font-mono">
                      ••••••••
                    </code>
                    <button
                      onClick={() => removeSecret(i)}
                      className="p-1 text-[var(--text-tertiary)] hover:text-[var(--error)]"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M6 18L18 6M6 6l12 12"/>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
            {/* Add new secret */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newSecretKey}
                onChange={(e) => setNewSecretKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                placeholder="KEY"
                className="w-32 px-2 py-1.5 bg-[var(--bg-primary)] border border-[var(--border)] rounded text-xs font-mono text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
              />
              <span className="text-xs text-[var(--text-tertiary)]">=</span>
              <input
                type="password"
                value={newSecretValue}
                onChange={(e) => setNewSecretValue(e.target.value)}
                placeholder="value"
                className="flex-1 px-2 py-1.5 bg-[var(--bg-primary)] border border-[var(--border)] rounded text-xs font-mono text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
                onKeyDown={(e) => e.key === 'Enter' && addSecret()}
              />
              <button
                onClick={addSecret}
                disabled={!newSecretKey.trim() || !newSecretValue.trim()}
                className="px-3 py-1.5 bg-[var(--accent)] text-white text-xs font-medium rounded disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col md:flex-row min-h-0">
        {/* Input Panel (35%) */}
        <div
          className={`w-full md:w-[35%] md:min-w-[360px] md:max-w-[480px] bg-[var(--bg-secondary)] border-b md:border-b-0 md:border-r border-[var(--border)] flex flex-col transition-opacity duration-300 ${
            pageState === 'running' ? 'opacity-60 pointer-events-none' : ''
          } ${pageState === 'post-run' ? 'opacity-50' : ''}`}
        >
          {/* Panel Header */}
          <div className="p-6 border-b border-[var(--border)]">
            <div className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-2">
              Input
            </div>
            <h2 className="text-xl font-semibold text-[var(--text-primary)]">Enter Details</h2>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              Provide the information below to run this endpoint
            </p>
          </div>

          {/* Form Body */}
          <div className="flex-1 p-6 overflow-y-auto">
            {schemaLoading ? (
              <div className="space-y-4">
                <div className="h-12 bg-[var(--bg-tertiary)] rounded-lg animate-pulse" />
                <div className="h-12 bg-[var(--bg-tertiary)] rounded-lg animate-pulse" />
                <div className="h-12 bg-[var(--bg-tertiary)] rounded-lg animate-pulse" />
              </div>
            ) : schemaData?.schema ? (
              <OpenAPIFormThemed
                schema={schemaData.schema}
                onSubmit={handleSubmit}
                isSubmitting={executeRun.isPending}
                submitLabel=""
                loadingLabel=""
                hideSubmitButton
              />
            ) : (
              <p className="text-sm text-[var(--text-tertiary)]">
                This endpoint doesn&apos;t require any input parameters.
              </p>
            )}
          </div>

          {/* Form Footer */}
          <div className="p-5 border-t border-[var(--border)] bg-[var(--bg-tertiary)]">
            {pageState === 'pre-run' && (
              <button
                onClick={() => handleSubmit({})}
                disabled={executeRun.isPending}
                className="w-full py-4 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-base font-semibold rounded-lg flex items-center justify-center gap-2.5 transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                Run
              </button>
            )}
            {pageState === 'running' && (
              <button
                disabled
                className="w-full py-4 bg-[var(--bg-elevated)] text-[var(--text-tertiary)] text-base font-semibold rounded-lg flex items-center justify-center gap-2.5 cursor-not-allowed"
              >
                <div className="w-4 h-4 border-2 border-[var(--text-tertiary)] border-t-transparent rounded-full animate-spin" />
                Running...
              </button>
            )}
            {pageState === 'post-run' && (
              <button
                onClick={handleRunAgain}
                className="w-full py-4 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-base font-semibold rounded-lg flex items-center justify-center gap-2.5 transition-colors pointer-events-auto opacity-100"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M1 4v6h6M23 20v-6h-6"/>
                  <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
                </svg>
                Run Again
              </button>
            )}
          </div>
        </div>

        {/* Output Panel (65%) */}
        <div className="flex-1 flex flex-col min-w-0 bg-[var(--bg-primary)]">
          {/* Output Header */}
          <div className="h-[76px] px-7 border-b border-[var(--border)] flex items-center justify-between bg-[var(--bg-secondary)] flex-shrink-0">
            {/* Status */}
            <div className="flex items-center gap-3">
              {pageState === 'pre-run' && (
                <span className="px-3.5 py-1.5 bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] text-sm font-medium rounded-lg">
                  Waiting
                </span>
              )}
              {pageState === 'running' && (
                <>
                  <span className="px-3.5 py-1.5 bg-[var(--accent)]/15 text-[var(--accent)] text-sm font-medium rounded-lg">
                    Running
                  </span>
                  <span className="text-sm text-[var(--text-tertiary)]">
                    Elapsed: {elapsedTime}s
                  </span>
                </>
              )}
              {pageState === 'post-run' && currentRunData && (
                <>
                  <span
                    className={`px-3.5 py-1.5 text-sm font-medium rounded-lg ${
                      currentRunData.status === 'success'
                        ? 'bg-[var(--success)]/15 text-[var(--success)]'
                        : 'bg-[var(--error)]/15 text-[var(--error)]'
                    }`}
                  >
                    {currentRunData.status === 'success' ? 'Success' : 'Error'}
                  </span>
                  <span className="text-sm text-[var(--text-tertiary)]">
                    Completed in {((currentRunData.duration_ms || 0) / 1000).toFixed(1)}s
                  </span>
                </>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleCopyAll}
                disabled={pageState !== 'post-run'}
                className="flex items-center gap-2 px-3.5 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                Copy All
              </button>
              <div className="flex gap-1 bg-[var(--bg-tertiary)] p-1 rounded-lg">
                <button
                  onClick={() => setViewMode('formatted')}
                  disabled={pageState !== 'post-run'}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    viewMode === 'formatted'
                      ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Formatted
                </button>
                <button
                  onClick={() => setViewMode('raw')}
                  disabled={pageState !== 'post-run'}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    viewMode === 'raw'
                      ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Raw JSON
                </button>
              </div>
            </div>
          </div>

          {/* Output Body */}
          <div className="flex-1 p-7 overflow-y-auto">
            {/* Pre-run: Empty state */}
            {pageState === 'pre-run' && (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl flex items-center justify-center mb-6">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--text-tertiary)]">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">No results yet</h3>
                <p className="text-sm text-[var(--text-tertiary)] max-w-[300px]">
                  Fill in the required fields and click Run to see the output here
                </p>
              </div>
            )}

            {/* Running: Spinner state */}
            {pageState === 'running' && (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 border-3 border-[var(--border-secondary)] border-t-[var(--accent)] rounded-full animate-spin mb-6" />
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Running...</h3>
                <p className="text-sm text-[var(--text-tertiary)] font-mono">
                  Elapsed: {elapsedTime}s
                </p>
              </div>
            )}

            {/* Post-run: Results */}
            {pageState === 'post-run' && currentRunData?.result && (
              <>
                {viewMode === 'formatted' && currentRunData.result.json ? (
                  <AutoMappedOutput data={currentRunData.result.json} />
                ) : (
                  <pre className="p-4 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg overflow-x-auto">
                    <code className="text-sm text-[var(--text-primary)] font-mono">
                      {JSON.stringify(currentRunData.result.json || currentRunData.result, null, 2)}
                    </code>
                  </pre>
                )}

                {/* Error message if present */}
                {currentRunData.result.error_message && (
                  <div className="mt-6 p-4 bg-[var(--error)]/10 border border-[var(--error)]/20 rounded-lg">
                    <h4 className="text-sm font-medium text-[var(--error)] mb-1">Error</h4>
                    <p className="text-sm text-[var(--error)]/80">{currentRunData.result.error_message}</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function Page({ params, searchParams }: PageProps) {
  const resolvedParams = use(params);
  const resolvedSearchParams = use(searchParams);

  return (
    <QueryClientProvider client={queryClient}>
      <RunPage projectId={resolvedParams.project_id} endpointParam={resolvedSearchParams.endpoint} />
    </QueryClientProvider>
  );
}
