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

// Simple hash-based emoji picker for consistent project emojis
function getProjectEmoji(name: string): string {
  const emojis = ['🌤️', '✍️', '🔗', '🎨', '🚀', '📊', '🤖', '🔧', '📦', '⚡', '🎯', '🌍'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash |= 0;
  }
  return emojis[Math.abs(hash) % emojis.length];
}

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
  const [redeployStep, setRedeployStep] = useState<string | null>(null);

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
    setRedeployStep('Starting redeploy...');
    try {
      await apiClient.redeploy(projectId);

      // Connect to SSE stream for progress updates
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const eventSource = new EventSource(`${API_BASE_URL}/projects/${projectId}/deploy/stream`);

      eventSource.addEventListener('status', (e) => {
        try {
          const data = JSON.parse(e.data);
          setRedeployStep(data.message || data.step);
        } catch { /* ignore parse errors */ }
      });

      eventSource.addEventListener('complete', () => {
        eventSource.close();
        router.push(`/p/${projectId}/deploying`);
      });

      eventSource.addEventListener('error', () => {
        eventSource.close();
        router.push(`/p/${projectId}/deploying`);
      });

      eventSource.onerror = () => {
        eventSource.close();
        router.push(`/p/${projectId}/deploying`);
      };

      // Fallback: redirect after 10s regardless
      setTimeout(() => {
        eventSource.close();
        router.push(`/p/${projectId}/deploying`);
      }, 10000);
    } catch (err) {
      console.error('Redeploy failed:', err);
      setIsRedeploying(false);
      setRedeployStep(null);
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
      <header className="h-16 bg-[var(--bg-secondary)] border-b border-[var(--border)] flex items-center px-6 gap-3.5 flex-shrink-0">
        <Link
          href="/"
          className="w-9 h-9 flex items-center justify-center bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg text-[var(--text-secondary)] hover:bg-[var(--accent)] hover:border-[var(--accent)] hover:text-[var(--bg-primary)] transition-all flex-shrink-0"
          title="Back to apps"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </Link>
        <span className="text-[32px] flex-shrink-0">{project ? getProjectEmoji(project.name) : '🚀'}</span>
        <div className="flex-1 min-w-0">
          <div className="text-[16px] font-semibold text-[var(--text-primary)]">{project?.name || 'Loading...'}</div>
          <div className="text-[13px] text-[var(--text-secondary)] truncate">{endpointDisplayName}</div>
        </div>
        <button
          onClick={() => {
            const url = window.location.href;
            navigator.clipboard.writeText(url);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] text-[13px] font-medium hover:bg-[var(--accent)] hover:border-[var(--accent)] hover:text-[var(--bg-primary)] transition-all"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13"/>
          </svg>
          Share
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col md:flex-row min-h-0">
        {/* Input Panel (50%) */}
        <div
          className={`w-full md:w-1/2 bg-[var(--bg-secondary)] border-b md:border-b-0 md:border-r border-[var(--border)] flex flex-col transition-opacity duration-300 ${
            pageState === 'running' ? 'opacity-60 pointer-events-none' : ''
          } ${pageState === 'post-run' ? 'opacity-50' : ''}`}
        >
          {/* Panel Header */}
          <div className="px-7 py-5 border-b border-[var(--border)]">
            <div className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
              Inputs
            </div>
          </div>

          {/* Form Body */}
          <div className="flex-1 px-7 py-5 overflow-y-auto">
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
          <div className="px-7 py-5">
            {pageState === 'pre-run' && (
              <button
                onClick={() => handleSubmit({})}
                disabled={executeRun.isPending}
                className="w-full py-3.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--bg-primary)] text-[15px] font-semibold rounded-[10px] flex items-center justify-center gap-2 transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z"/>
                </svg>
                Run
              </button>
            )}
            {pageState === 'running' && (
              <button
                disabled
                className="w-full py-3.5 bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] text-[15px] font-semibold rounded-[10px] flex items-center justify-center gap-2 cursor-not-allowed"
              >
                <div className="w-4 h-4 border-2 border-[var(--text-tertiary)] border-t-transparent rounded-full animate-spin" />
                Running...
              </button>
            )}
            {pageState === 'post-run' && (
              <button
                onClick={handleRunAgain}
                className="w-full py-3.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--bg-primary)] text-[15px] font-semibold rounded-[10px] flex items-center justify-center gap-2 transition-colors pointer-events-auto opacity-100"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z"/>
                </svg>
                Run
              </button>
            )}
          </div>
        </div>

        {/* Output Panel (50%) */}
        <div className="flex-1 flex flex-col min-w-0 bg-[var(--bg-secondary)]">
          {/* Output Header */}
          <div className="px-5 py-3.5 border-b border-[var(--border)] flex items-center justify-between flex-shrink-0">
            {/* Status */}
            <div className="flex items-center gap-2">
              {pageState === 'pre-run' && (
                <span className="text-[13px] text-[var(--text-tertiary)]">
                  Waiting for input
                </span>
              )}
              {pageState === 'running' && (
                <span className="text-[13px] text-[var(--text-secondary)]">
                  Running...
                </span>
              )}
              {pageState === 'post-run' && currentRunData && (
                <>
                  <span className={`flex items-center gap-1.5 text-[13px] font-medium ${
                    currentRunData.status === 'success' ? 'text-[var(--success)]' : 'text-[var(--error)]'
                  }`}>
                    {currentRunData.status === 'success' ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                        <polyline points="22 4 12 14.01 9 11.01"/>
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M15 9l-6 6M9 9l6 6"/>
                      </svg>
                    )}
                    {currentRunData.status === 'success' ? 'Success' : 'Error'}
                  </span>
                  <span className="text-[12px] text-[var(--text-tertiary)]">
                    {((currentRunData.duration_ms || 0)).toFixed(0)}ms
                  </span>
                </>
              )}
            </div>

            {/* Copy */}
            {pageState === 'post-run' && (
              <button
                onClick={handleCopyAll}
                className="flex items-center gap-1.5 px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-md text-[12px] text-[var(--text-secondary)] hover:bg-[var(--accent)] hover:border-[var(--accent)] hover:text-[var(--bg-primary)] transition-all"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2"/>
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                </svg>
                Copy
              </button>
            )}
          </div>

          {/* Output Body */}
          <div className="flex-1 p-5 overflow-y-auto">
            {/* Pre-run: Empty state */}
            {pageState === 'pre-run' && (
              <div className="h-full flex flex-col items-center justify-center text-center text-[var(--text-tertiary)]">
                <div className="text-[40px] mb-3 opacity-40">▶</div>
                <p className="text-[14px]">Run your app to see the output</p>
              </div>
            )}

            {/* Running: Spinner state */}
            {pageState === 'running' && (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <div className="w-8 h-8 border-3 border-[var(--border)] border-t-[var(--accent)] rounded-full animate-spin mb-4" />
                <p className="text-[14px] text-[var(--text-secondary)]">Executing your app...</p>
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
