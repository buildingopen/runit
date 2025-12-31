// ABOUTME: Result viewer component - JSON viewer with syntax highlighting, artifacts, errors
// ABOUTME: Shows HTTP status, duration, warnings, and suggested fixes

'use client';

import type { RunResult } from '@execution-layer/shared';

interface ResultViewerProps {
  result: RunResult;
  status: string;
  duration_ms?: number;
}

export function ResultViewer({ result, status, duration_ms }: ResultViewerProps) {
  const statusColor = getStatusColor(status);
  const httpStatusColor = getHttpStatusColor(result.http_status);

  return (
    <div className="space-y-4">
      {/* Status Header */}
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className={`inline-block w-2 h-2 rounded-full ${statusColor}`} />
            <span className="text-sm font-medium text-gray-700 capitalize">
              {status}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${httpStatusColor}`}>
              {result.http_status}
            </span>
            <span className="text-sm text-gray-500">
              {getStatusText(result.http_status)}
            </span>
          </div>
        </div>
        {duration_ms && (
          <span className="text-sm text-gray-600">
            {(duration_ms / 1000).toFixed(2)}s
          </span>
        )}
      </div>

      {/* Warnings */}
      {result.warnings && result.warnings.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-2">
            <svg
              className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-amber-800 mb-1">
                Warnings
              </h3>
              <ul className="text-sm text-amber-700 space-y-1">
                {result.warnings.map((warning, i) => (
                  <li key={i}>• {warning}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {result.error_message && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-2">
            <svg
              className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800 mb-1">Error</h3>
              <p className="text-sm text-red-700">{result.error_message}</p>
              {result.error_class && (
                <p className="text-xs text-red-600 mt-1 font-mono">
                  {result.error_class}
                </p>
              )}
              {result.suggested_fix && (
                <div className="mt-3 p-3 bg-white rounded border border-red-200">
                  <h4 className="text-xs font-medium text-red-800 mb-1">
                    Suggested Fix
                  </h4>
                  <p className="text-sm text-red-700">{result.suggested_fix}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Redactions Notice */}
      {result.redactions_applied && (
        <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4 text-purple-600"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            <p className="text-sm text-purple-700">
              Sensitive values were redacted from this output for security.
            </p>
          </div>
        </div>
      )}

      {/* Response Body */}
      {result.json !== undefined && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Response</h3>
          <JSONViewer data={result.json} />
        </div>
      )}

      {result.text_preview && !result.json && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Response</h3>
          <pre className="p-4 bg-gray-50 rounded-lg border border-gray-200 overflow-x-auto text-sm">
            {result.text_preview}
          </pre>
        </div>
      )}

      {/* Artifacts */}
      {result.artifacts && result.artifacts.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            Artifacts ({result.artifacts.length})
          </h3>
          <div className="space-y-2">
            {result.artifacts.map((artifact, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <FileIcon mimeType={artifact.mime_type} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate">
                      {artifact.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatSize(artifact.size)} • {artifact.mime_type}
                    </p>
                  </div>
                </div>
                <a
                  href={artifact.download_url}
                  download={artifact.name}
                  className="flex-shrink-0 px-3 py-1 text-sm text-purple-600 hover:text-purple-700 font-medium"
                >
                  Download
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function JSONViewer({ data }: { data: unknown }) {
  return (
    <pre className="p-4 bg-gray-50 rounded-lg border border-gray-200 overflow-x-auto">
      <code className="text-sm">{JSON.stringify(data, null, 2)}</code>
    </pre>
  );
}

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith('image/')) {
    return (
      <svg className="w-8 h-8 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
          clipRule="evenodd"
        />
      </svg>
    );
  }

  if (mimeType.includes('pdf')) {
    return (
      <svg className="w-8 h-8 text-red-500" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
          clipRule="evenodd"
        />
      </svg>
    );
  }

  return (
    <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
        clipRule="evenodd"
      />
    </svg>
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
      return 'bg-blue-500';
    case 'queued':
      return 'bg-gray-400';
    default:
      return 'bg-gray-400';
  }
}

function getHttpStatusColor(status: number): string {
  if (status >= 200 && status < 300) return 'text-green-600';
  if (status >= 400 && status < 500) return 'text-amber-600';
  if (status >= 500) return 'text-red-600';
  return 'text-gray-600';
}

function getStatusText(status: number): string {
  if (status === 200) return 'OK';
  if (status === 201) return 'Created';
  if (status === 400) return 'Bad Request';
  if (status === 401) return 'Unauthorized';
  if (status === 404) return 'Not Found';
  if (status === 500) return 'Internal Server Error';
  return '';
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
