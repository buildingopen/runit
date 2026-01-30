// ABOUTME: Result viewer component - JSON viewer with syntax highlighting, artifacts, errors
// ABOUTME: Shows HTTP status, duration, warnings, and suggested fixes

'use client';

import { useState } from 'react';
import type { RunResult } from '@runtime-ai/shared';
import { AutoMappedOutput } from './AutoMappedOutput';
import { ResultPanelHeader } from './ResultPanelHeader';

interface ResultViewerProps {
  result: RunResult;
  status: string;
  duration_ms?: number;
}

export function ResultViewer({ result, status, duration_ms }: ResultViewerProps) {
  const [viewMode, setViewMode] = useState<'formatted' | 'raw'>('formatted');

  const handleCopyAll = () => {
    const data = result.json ?? result.text_preview ?? '';
    const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    navigator.clipboard.writeText(text);
  };

  return (
    <div>
      {/* Status Header - at card edge */}
      <ResultPanelHeader
        status={status}
        duration_ms={duration_ms}
        httpStatus={result.http_status}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onCopyAll={handleCopyAll}
      />

      {/* Content with padding */}
      <div className="p-4 space-y-4">
      {/* Warnings */}
      {result.warnings && result.warnings.length > 0 && (
        <div className="px-3 py-2 bg-[var(--warning)]/10 border border-[var(--warning)]/20 rounded">
          <div className="flex items-start gap-2">
            <svg
              className="w-4 h-4 text-[var(--warning)] flex-shrink-0 mt-0.5"
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
              <h3 className="text-xs font-medium text-[var(--warning)] mb-1">
                Warnings
              </h3>
              <ul className="text-xs text-[var(--warning)]/80 space-y-0.5">
                {result.warnings.map((warning: string, i: number) => (
                  <li key={i}>{warning}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {result.error_message && (
        <div className="px-3 py-2 bg-[var(--error)]/10 border border-[var(--error)]/20 rounded">
          <div className="flex items-start gap-2">
            <svg
              className="w-4 h-4 text-[var(--error)] flex-shrink-0 mt-0.5"
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
              <h3 className="text-xs font-medium text-[var(--error)] mb-1">Error</h3>
              <p className="text-xs text-[var(--error)]/80">{result.error_message}</p>
              {result.error_class && (
                <p className="text-[10px] text-[var(--error)]/60 mt-1 font-mono">
                  {result.error_class}
                </p>
              )}
              {result.suggested_fix && (
                <div className="mt-2 p-2 bg-[var(--bg-secondary)] rounded border border-[var(--error)]/20">
                  <h4 className="text-[10px] font-medium text-[var(--error)] mb-0.5">
                    Suggested Fix
                  </h4>
                  <p className="text-xs text-[var(--error)]/80">{result.suggested_fix}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Redactions Notice */}
      {result.redactions_applied && (
        <div className="px-3 py-2 bg-[var(--accent)]/10 border border-[var(--accent)]/20 rounded">
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4 text-[var(--accent)]"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            <p className="text-xs text-[var(--accent)]">
              Sensitive values were redacted from this output for security.
            </p>
          </div>
        </div>
      )}

      {/* Response Body */}
      {result.json !== undefined && (
        <div>
          <h3 className="text-xs font-medium text-[var(--text-secondary)] mb-2">Response</h3>
          {viewMode === 'formatted' ? (
            <div className="px-3 py-3 bg-[var(--bg-tertiary)] rounded border border-[var(--border)]">
              <AutoMappedOutput data={result.json} />
            </div>
          ) : (
            <JSONViewer data={result.json} />
          )}
        </div>
      )}

      {result.text_preview && !result.json && (
        <div>
          <h3 className="text-xs font-medium text-[var(--text-secondary)] mb-2">Response</h3>
          <pre className="px-3 py-2 bg-[var(--bg-tertiary)] rounded border border-[var(--border)] overflow-x-auto text-xs text-[var(--text-primary)] font-mono">
            {result.text_preview}
          </pre>
        </div>
      )}

      {/* Artifacts */}
      {result.artifacts && result.artifacts.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-[var(--text-secondary)] mb-2">
            Artifacts ({result.artifacts.length})
          </h3>
          <div className="space-y-1">
            {result.artifacts.map((artifact: { name: string; size: number; mime_type: string; download_url: string }, i: number) => (
              <div
                key={i}
                className="flex items-center justify-between px-3 py-2 bg-[var(--bg-tertiary)] rounded border border-[var(--border)]"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <FileIcon mimeType={artifact.mime_type} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[var(--text-primary)] truncate">
                      {artifact.name}
                    </p>
                    <p className="text-[10px] text-[var(--text-tertiary)]">
                      {formatSize(artifact.size)} · {artifact.mime_type}
                    </p>
                  </div>
                </div>
                <a
                  href={artifact.download_url}
                  download={artifact.name}
                  className="flex-shrink-0 text-xs text-[var(--accent)] hover:text-[var(--accent-hover)] font-medium"
                >
                  Download
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

function JSONViewer({ data }: { data: unknown }) {
  return (
    <pre className="px-3 py-2 bg-[var(--bg-tertiary)] rounded border border-[var(--border)] overflow-x-auto">
      <code className="text-xs text-[var(--text-primary)] font-mono">{JSON.stringify(data, null, 2)}</code>
    </pre>
  );
}

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith('image/')) {
    return (
      <svg className="w-5 h-5 text-[var(--accent)]" fill="currentColor" viewBox="0 0 20 20">
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
      <svg className="w-5 h-5 text-[var(--error)]" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
          clipRule="evenodd"
        />
      </svg>
    );
  }

  return (
    <svg className="w-5 h-5 text-[var(--text-tertiary)]" fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
