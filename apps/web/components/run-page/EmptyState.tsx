// ABOUTME: Empty state component - shown in output panel before any run
// ABOUTME: Displays placeholder message with icon

'use client';

interface EmptyStateProps {
  title?: string;
  description?: string;
}

export function EmptyState({
  title = 'No results yet',
  description = 'Run an endpoint to see results here',
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center mb-4">
        <svg
          className="w-7 h-7 text-[var(--text-tertiary)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
          />
        </svg>
      </div>
      <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-1">
        {title}
      </h3>
      <p className="text-xs text-[var(--text-tertiary)]">{description}</p>
    </div>
  );
}
