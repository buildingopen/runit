// ABOUTME: Project Run Page - main UI for selecting endpoints, filling forms, and viewing results
// ABOUTME: Integrates EndpointSelector, DynamicForm, ResultViewer, and RunHistory components

'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EndpointSelector } from '@/components/run-page/EndpointSelector';
import { DynamicForm } from '@/components/run-page/DynamicForm';
import { ResultViewer } from '@/components/run-page/ResultViewer';
import { RunHistory } from '@/components/run-page/RunHistory';
import {
  useProject,
  useEndpoints,
  useEndpointSchema,
  useCreateRun,
  useRunStatus,
  useRunsList,
} from '@/lib/hooks/useProject';

const queryClient = new QueryClient();

interface PageProps {
  params: {
    project_id: string;
  };
}

function ProjectRunPage({ params }: PageProps) {
  const [selectedEndpointId, setSelectedEndpointId] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);

  const projectId = params.project_id;

  // Fetch project details
  const { data: project, isLoading: projectLoading } = useProject(projectId);

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

  const handleSubmit = async (formData: Record<string, unknown>) => {
    if (!selectedEndpointId || !versionId) return;

    try {
      const result = await executeRun.mutateAsync({
        project_id: projectId,
        version_id: versionId,
        endpoint_id: selectedEndpointId,
        request_data: {
          json: formData,
        },
        lane: 'cpu',
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

  if (projectLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
      </div>
    );
  }

  if (endpointsError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Failed to load endpoints
          </h2>
          <p className="text-gray-600">
            {endpointsError instanceof Error
              ? endpointsError.message
              : 'Unknown error'}
          </p>
        </div>
      </div>
    );
  }

  const endpoints = endpointsData?.endpoints || [];
  const runs = runsData?.runs || [];
  const displayRun = runData || currentRunData;

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-semibold text-gray-900">
            {project?.name || 'Project'}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Select an endpoint to run
          </p>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Endpoints & Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Endpoint Selector */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
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
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Run Endpoint
                </h2>
                {schemaLoading ? (
                  <div className="animate-pulse space-y-4">
                    <div className="h-10 bg-gray-100 rounded" />
                    <div className="h-10 bg-gray-100 rounded" />
                    <div className="h-10 bg-gray-100 rounded" />
                  </div>
                ) : schemaError ? (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600">
                      Failed to load endpoint schema
                    </p>
                  </div>
                ) : schemaData?.schema ? (
                  <DynamicForm
                    schema={schemaData.schema}
                    onSubmit={handleSubmit}
                    isSubmitting={executeRun.isPending}
                  />
                ) : (
                  <p className="text-sm text-gray-500">No schema available</p>
                )}
              </div>
            )}

            {/* Result */}
            {displayRun && displayRun.response_body !== undefined && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Result
                </h2>
                <ResultViewer
                  result={displayRun.response_body}
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
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="flex items-center gap-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {currentRunData.status === 'queued'
                          ? 'Run queued...'
                          : 'Running...'}
                      </p>
                      <p className="text-xs text-gray-500">
                        Run ID: {currentRunId}
                      </p>
                    </div>
                  </div>
                </div>
              )}
          </div>

          {/* Right Column - Run History */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg border border-gray-200 p-6 sticky top-8">
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
      <ProjectRunPage {...props} />
    </QueryClientProvider>
  );
}
