// ABOUTME: Run history sidebar - shows recent runs with status, duration, and click to load
// ABOUTME: Displays success/error/timeout badges and relative timestamps

'use client';

interface RunHistoryItem {
  run_id: string;
  endpoint_id: string;
  status: string;
  created_at: string;
  duration_ms?: number;
}

interface RunHistoryProps {
  runs: RunHistoryItem[];
  selectedRunId: string | null;
  onSelectRun: (runId: string) => void;
  isLoading?: boolean;
}

export function RunHistory({
  runs,
  selectedRunId,
  onSelectRun,
  isLoading,
}: RunHistoryProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Run History</h3>
        <div className="animate-pulse space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">Run History</h3>
        <div className="text-center py-8 text-gray-500">
          <svg
            className="w-12 h-12 mx-auto mb-2 text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-sm">No runs yet</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-700 mb-3">
        Run History ({runs.length})
      </h3>
      <div className="space-y-2">
        {runs.map((run) => {
          const isSelected = run.run_id === selectedRunId;
          const statusColor = getStatusColor(run.status);

          return (
            <button
              key={run.run_id}
              onClick={() => onSelectRun(run.run_id)}
              className={`
                w-full text-left p-3 rounded-lg border transition-all
                ${
                  isSelected
                    ? 'border-purple-500 bg-purple-50 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                }
              `}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className={`inline-block w-2 h-2 rounded-full ${statusColor}`} />
                  <span className="text-sm text-gray-600 capitalize truncate">
                    {run.status}
                  </span>
                </div>
                {run.duration_ms && (
                  <span className="text-xs text-gray-500 flex-shrink-0">
                    {(run.duration_ms / 1000).toFixed(1)}s
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-500 pl-4">
                {formatTimestamp(run.created_at)}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'success':
      return 'bg-green-500';
    case 'error':
      return 'bg-red-500';
    case 'timeout':
      return 'bg-amber-500';
    case 'running':
      return 'bg-blue-500 animate-pulse';
    case 'queued':
      return 'bg-gray-400';
    default:
      return 'bg-gray-400';
  }
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}
