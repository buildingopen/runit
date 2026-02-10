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

// Convert endpoint_id to friendly display name
// "post--generate" -> "Generate", "get--health" -> "Health"
function formatEndpointName(endpointId: string): string {
  if (!endpointId) return '';
  // Remove method prefix (post--, get--, etc.)
  const withoutMethod = endpointId.replace(/^(get|post|put|patch|delete)--/, '');
  // Convert to title case and replace dashes/underscores
  const formatted = withoutMethod
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
  return formatted;
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
        <h3 className="text-xs font-medium text-[var(--text-secondary)] mb-3">History</h3>
        <div className="animate-pulse space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-[var(--bg-tertiary)] rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div>
        <h3 className="text-xs font-medium text-[var(--text-secondary)] mb-3">History</h3>
        <div className="text-center py-8">
          <svg
            className="w-10 h-10 mx-auto mb-2 text-[var(--text-tertiary)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={1}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-xs text-[var(--text-tertiary)]">No runs yet</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-xs font-medium text-[var(--text-secondary)] mb-3">
        History ({runs.length})
      </h3>
      <div className="space-y-1">
        {runs.map((run) => {
          const isSelected = run.run_id === selectedRunId;
          const statusColor = getStatusColor(run.status);

          return (
            <button
              key={run.run_id}
              onClick={() => onSelectRun(run.run_id)}
              className={`
                w-full text-left px-3 py-2 rounded transition-colors
                ${
                  isSelected
                    ? 'bg-[var(--accent)]/10 border border-[var(--accent)]/30'
                    : 'hover:bg-[var(--bg-hover)] border border-transparent'
                }
              `}
            >
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${statusColor}`} />
                  <span className="text-xs text-[var(--text-secondary)] capitalize truncate">
                    {run.status}
                  </span>
                </div>
                {run.duration_ms && (
                  <span className="text-[10px] text-[var(--text-tertiary)] flex-shrink-0">
                    {(run.duration_ms / 1000).toFixed(1)}s
                  </span>
                )}
              </div>
              {run.endpoint_id && (
                <div className="text-[10px] text-[var(--text-tertiary)] pl-3.5 truncate">
                  {formatEndpointName(run.endpoint_id)}
                </div>
              )}
              <div className="text-[10px] text-[var(--text-tertiary)] pl-3.5">
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
      return 'bg-[var(--success)]';
    case 'error':
      return 'bg-[var(--error)]';
    case 'timeout':
      return 'bg-[var(--warning)]';
    case 'running':
      return 'bg-[var(--accent)] animate-pulse';
    case 'queued':
      return 'bg-[var(--text-tertiary)]';
    default:
      return 'bg-[var(--text-tertiary)]';
  }
}

function formatTimestamp(timestamp: string): string {
  // Handle empty/undefined timestamps
  if (!timestamp) {
    return 'Unknown';
  }

  const date = new Date(timestamp);

  // Check for invalid date
  if (isNaN(date.getTime())) {
    return 'Invalid date';
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  // Handle future dates (clock skew)
  if (diffMs < 0) {
    return 'Just now';
  }

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
