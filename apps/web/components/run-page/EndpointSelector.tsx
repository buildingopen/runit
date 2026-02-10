// ABOUTME: Endpoint selection UI - displays list of actions with friendly names
// ABOUTME: Prioritizes summary over technical paths for non-technical users
// ABOUTME: Quick-run buttons for actions without required parameters

'use client';

interface Endpoint {
  endpoint_id: string;
  method: string;
  path: string;
  summary?: string;
  description?: string;
  requires_gpu?: boolean;
  schema_ref?: string;
  has_request_body?: boolean;
}

// Get user-friendly display name for an endpoint
function getDisplayName(endpoint: Endpoint): string {
  if (endpoint.summary) {
    return endpoint.summary;
  }
  // Fallback: convert path to friendly name
  // "/generate" -> "Generate", "/health" -> "Health", "/users/{id}" -> "Users"
  const pathName = endpoint.path
    .split('/')[1] // Get first path segment
    ?.replace(/[{}\-_]/g, ' ') // Remove braces and replace dashes/underscores
    ?.trim();
  if (pathName) {
    return pathName.charAt(0).toUpperCase() + pathName.slice(1);
  }
  return endpoint.path;
}

interface EndpointSelectorProps {
  endpoints: Endpoint[];
  selectedId: string | null;
  onSelect: (endpointId: string) => void;
  onQuickRun?: (endpointId: string) => void;
  isLoading?: boolean;
  isRunning?: boolean;
  runningEndpointId?: string | null;
}

export function EndpointSelector({
  endpoints,
  selectedId,
  onSelect,
  onQuickRun,
  isLoading,
  isRunning,
  runningEndpointId,
}: EndpointSelectorProps) {
  if (isLoading) {
    return (
      <div className="animate-pulse space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 bg-[var(--bg-tertiary)] rounded" />
        ))}
      </div>
    );
  }

  if (endpoints.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-[var(--text-secondary)]">No actions found for this app.</p>
        <p className="text-xs text-[var(--text-tertiary)] mt-1">
          Make sure your app has functions defined.
        </p>
      </div>
    );
  }

  // Check if endpoint can be quick-run (GET/DELETE without path params, or has no request body)
  const canQuickRun = (endpoint: Endpoint) => {
    const method = endpoint.method.toUpperCase();
    const hasPathParams = endpoint.path.includes('{');
    // GET/DELETE typically don't have request bodies
    // POST/PUT/PATCH might have optional bodies
    return !hasPathParams && (method === 'GET' || method === 'DELETE' || !endpoint.has_request_body);
  };

  return (
    <div className="space-y-1">
      {endpoints.map((endpoint) => {
        const isSelected = endpoint.endpoint_id === selectedId;
        const isThisRunning = isRunning && runningEndpointId === endpoint.endpoint_id;
        const showQuickRun = onQuickRun && canQuickRun(endpoint);

        return (
          <div
            key={endpoint.endpoint_id}
            className={`
              flex items-center gap-2 px-3 py-2.5 rounded transition-colors
              ${
                isSelected
                  ? 'bg-[var(--accent)]/10 border border-[var(--accent)]/30'
                  : 'hover:bg-[var(--bg-hover)] border border-transparent'
              }
            `}
          >
            <button
              onClick={() => onSelect(endpoint.endpoint_id)}
              className="flex-1 text-left min-w-0"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`
                    inline-block w-1.5 h-1.5 rounded-full flex-shrink-0
                    ${endpoint.method.toUpperCase() === 'GET' ? 'bg-[var(--accent)]' : 'bg-[var(--success)]'}
                  `}
                />
                <span className="text-sm text-[var(--text-primary)] truncate flex-1">
                  {getDisplayName(endpoint)}
                </span>
                {endpoint.requires_gpu && (
                  <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium bg-[var(--warning)]/10 text-[var(--warning)] rounded">
                    GPU
                  </span>
                )}
              </div>
              {endpoint.description && (
                <p className="text-xs text-[var(--text-tertiary)] mt-1 ml-4 line-clamp-1">
                  {endpoint.description}
                </p>
              )}
            </button>

            {/* Quick Run Button */}
            {showQuickRun && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onQuickRun(endpoint.endpoint_id);
                }}
                disabled={isRunning}
                className={`
                  flex-shrink-0 p-2 rounded-md transition-colors
                  ${isThisRunning
                    ? 'bg-[var(--accent)] text-white'
                    : 'hover:bg-[var(--accent)]/20 text-[var(--accent)]'
                  }
                  disabled:opacity-50
                `}
                title={`Run ${getDisplayName(endpoint)}`}
                aria-label={`Run ${getDisplayName(endpoint)}`}
              >
                {isThisRunning ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            )}

            {/* Selected Checkmark (only if no quick run button) */}
            {isSelected && !showQuickRun && (
              <svg
                className="w-4 h-4 text-[var(--accent)] flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </div>
        );
      })}
    </div>
  );
}
