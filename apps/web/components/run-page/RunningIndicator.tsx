// ABOUTME: Running indicator component - spinner with elapsed time counter
// ABOUTME: Shows live elapsed time during run execution

'use client';

import { useState, useEffect } from 'react';

interface RunningIndicatorProps {
  startTime: Date;
  status?: 'queued' | 'running';
}

export function RunningIndicator({ startTime, status = 'running' }: RunningIndicatorProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime.getTime()) / 1000));
    }, 100);

    return () => clearInterval(interval);
  }, [startTime]);

  const formatElapsed = (seconds: number) => {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 gap-4">
      <div className="relative">
        <svg
          className="w-12 h-12 animate-spin text-[var(--accent)]"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-[var(--text-primary)]">
          {status === 'queued' ? 'Queued' : 'Running'}...
        </p>
        <p className="text-2xl font-mono font-semibold text-[var(--accent)] mt-1">
          {formatElapsed(elapsed)}
        </p>
      </div>
    </div>
  );
}
