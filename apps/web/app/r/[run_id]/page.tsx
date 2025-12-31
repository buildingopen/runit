// ABOUTME: Run Result View Page - Read-only view of a completed run
// ABOUTME: Accessible via share links, shows results without edit capabilities

'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRunStatus } from '@/lib/hooks/useProject';
import { ResultViewer } from '@/components/run-page/ResultViewer';

const queryClient = new QueryClient();

interface PageProps {
  params: {
    run_id: string;
  };
}

function RunResultPage({ params }: PageProps) {
  const runId = params.run_id;

  // Fetch run data
  const { data: runData, isLoading, error } = useRunStatus(runId);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading run result...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-6">
        <div className="max-w-md text-center">
          <div className="bg-white rounded-xl border border-red-200 p-8">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Run not found
            </h2>
            <p className="text-gray-600">
              {error instanceof Error ? error.message : 'This run does not exist or has been deleted'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!runData) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-3 h-3 rounded-full ${
              runData.status === 'success' ? 'bg-green-500' :
              runData.status === 'error' ? 'bg-red-500' :
              runData.status === 'timeout' ? 'bg-orange-500' :
              'bg-yellow-500'
            }`} />
            <h1 className="text-2xl font-bold text-gray-900">
              Run Result
            </h1>
          </div>
          <p className="text-sm text-gray-500">
            Run ID: {runId}
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Loading State for Running Runs */}
        {(runData.status === 'queued' || runData.status === 'running') && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 mb-6">
            <div className="flex items-center gap-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
              <div>
                <p className="text-lg font-medium text-gray-900">
                  {runData.status === 'queued' ? 'Run queued...' : 'Running...'}
                </p>
                <p className="text-sm text-gray-500">
                  This run is still in progress
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Result */}
        {runData.response_body !== undefined && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <ResultViewer
              result={runData.response_body}
              status={runData.status}
              duration_ms={runData.duration_ms}
            />
          </div>
        )}

        {/* Info Notice */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div>
              <h3 className="text-sm font-medium text-blue-900">
                This is a read-only view
              </h3>
              <p className="mt-1 text-sm text-blue-700">
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
      <RunResultPage {...props} />
    </QueryClientProvider>
  );
}
