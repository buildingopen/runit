// ABOUTME: Endpoint selection UI - displays list of endpoints with method, path, summary
// ABOUTME: Highlights GPU endpoints and shows loading/error states

'use client';

import { tokens } from '@execution-layer/ui';

interface Endpoint {
  endpoint_id: string;
  method: string;
  path: string;
  summary?: string;
  description?: string;
  requires_gpu?: boolean;
}

interface EndpointSelectorProps {
  endpoints: Endpoint[];
  selectedId: string | null;
  onSelect: (endpointId: string) => void;
  isLoading?: boolean;
}

export function EndpointSelector({
  endpoints,
  selectedId,
  onSelect,
  isLoading,
}: EndpointSelectorProps) {
  if (isLoading) {
    return (
      <div className="animate-pulse space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-gray-100 rounded-lg" />
        ))}
      </div>
    );
  }

  if (endpoints.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No endpoints found for this project.</p>
        <p className="text-sm mt-2">
          Make sure your FastAPI app has endpoints defined.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {endpoints.map((endpoint) => {
        const isSelected = endpoint.endpoint_id === selectedId;
        const methodColor = getMethodColor(endpoint.method);

        return (
          <button
            key={endpoint.endpoint_id}
            onClick={() => onSelect(endpoint.endpoint_id)}
            className={`
              w-full text-left p-4 rounded-lg border transition-all
              ${
                isSelected
                  ? 'border-purple-500 bg-purple-50 shadow-sm'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
              }
            `}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`
                      inline-block px-2 py-0.5 text-xs font-medium rounded
                      ${methodColor}
                    `}
                  >
                    {endpoint.method}
                  </span>
                  <code className="text-sm text-gray-700 font-mono truncate">
                    {endpoint.path}
                  </code>
                  {endpoint.requires_gpu && (
                    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 rounded">
                      <svg
                        className="w-3 h-3 mr-1"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
                      </svg>
                      GPU
                    </span>
                  )}
                </div>
                {endpoint.summary && (
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {endpoint.summary}
                  </p>
                )}
              </div>
              {isSelected && (
                <svg
                  className="w-5 h-5 text-purple-500 flex-shrink-0"
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
          </button>
        );
      })}
    </div>
  );
}

function getMethodColor(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET':
      return 'bg-blue-100 text-blue-800';
    case 'POST':
      return 'bg-green-100 text-green-800';
    case 'PUT':
      return 'bg-amber-100 text-amber-800';
    case 'PATCH':
      return 'bg-purple-100 text-purple-800';
    case 'DELETE':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}
