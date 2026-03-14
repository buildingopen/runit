// ABOUTME: Displays timestamped execution logs from Docker runner
// ABOUTME: Monospace with line numbers, auto-scrolls to bottom

'use client';

import { useEffect, useRef } from 'react';

interface LogsViewerProps {
  logs: string | undefined;
}

export function LogsViewer({ logs }: LogsViewerProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  if (!logs) {
    return (
      <div className="h-full flex items-center justify-center text-[var(--text-tertiary)]">
        <p className="text-[13px]">No logs for this run</p>
      </div>
    );
  }

  const lines = logs.split('\n').filter(Boolean);

  return (
    <div className="font-mono text-[12px] bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg p-4 max-h-[60vh] overflow-y-auto">
      {lines.map((line, i) => (
        <div key={i} className="flex gap-3 leading-5 hover:bg-[var(--bg-hover)]">
          <span className="text-[var(--text-tertiary)] select-none w-6 text-right flex-shrink-0">
            {i + 1}
          </span>
          <span className="text-[var(--text-primary)] whitespace-pre-wrap break-all">
            {line}
          </span>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}
