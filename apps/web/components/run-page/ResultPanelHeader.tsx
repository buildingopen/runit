// ABOUTME: Result panel header component - status badge, duration, copy all, view toggle
// ABOUTME: Header bar for the output panel showing run metadata and actions

'use client';

import { useState } from 'react';

interface ResultPanelHeaderProps {
  status: string;
  duration_ms?: number;
  httpStatus?: number;
  onCopyAll: () => void;
  viewMode: 'formatted' | 'raw';
  onViewModeChange: (mode: 'formatted' | 'raw') => void;
}

export function ResultPanelHeader({
  status,
  duration_ms,
  httpStatus,
  onCopyAll,
  viewMode,
  onViewModeChange,
}: ResultPanelHeaderProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopyAll();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusColor = (s: string) => {
    switch (s) {
      case 'success':
        return 'bg-[var(--success)]';
      case 'error':
        return 'bg-[var(--error)]';
      case 'timeout':
        return 'bg-[var(--warning)]';
      default:
        return 'bg-[var(--text-tertiary)]';
    }
  };

  const getHttpStatusColor = (code?: number) => {
    if (!code) return 'text-[var(--text-tertiary)]';
    if (code >= 200 && code < 300) return 'text-[var(--success)]';
    if (code >= 400 && code < 500) return 'text-[var(--warning)]';
    if (code >= 500) return 'text-[var(--error)]';
    return 'text-[var(--text-secondary)]';
  };

  return (
    <div className="flex items-center justify-between px-3 py-2 bg-[var(--bg-tertiary)] rounded-t-lg border-b border-[var(--border)]">
      <div className="flex items-center gap-3">
        {/* Status badge */}
        <div className="flex items-center gap-2">
          <span className={`inline-block w-2 h-2 rounded-full ${getStatusColor(status)}`} />
          <span className="text-xs font-medium text-[var(--text-secondary)] capitalize">
            {status}
          </span>
        </div>

        {/* HTTP status */}
        {httpStatus && (
          <span className={`text-xs font-medium ${getHttpStatusColor(httpStatus)}`}>
            {httpStatus}
          </span>
        )}

        {/* Duration */}
        {duration_ms !== undefined && (
          <span className="text-xs text-[var(--text-tertiary)]">
            {(duration_ms / 1000).toFixed(2)}s
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* View toggle */}
        <div className="flex items-center bg-[var(--bg-secondary)] rounded border border-[var(--border)]">
          <button
            type="button"
            onClick={() => onViewModeChange('formatted')}
            className={`px-2 py-1 text-xs font-medium rounded-l transition-colors ${
              viewMode === 'formatted'
                ? 'bg-[var(--accent)] text-white'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
            }`}
          >
            Formatted
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange('raw')}
            className={`px-2 py-1 text-xs font-medium rounded-r transition-colors ${
              viewMode === 'raw'
                ? 'bg-[var(--accent)] text-white'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
            }`}
          >
            Raw
          </button>
        </div>

        {/* Copy all button */}
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-1 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded transition-colors"
        >
          {copied ? (
            <>
              <svg className="w-3.5 h-3.5 text-[var(--success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span>Copied</span>
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span>Copy All</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
