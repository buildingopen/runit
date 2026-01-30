// ABOUTME: Boolean badge component - renders boolean values as Yes/No colored badges
// ABOUTME: Green for true (Yes), red for false (No)

'use client';

interface BooleanBadgeProps {
  value: boolean;
}

export function BooleanBadge({ value }: BooleanBadgeProps) {
  if (value) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--success)]/15 text-[var(--success)]">
        Yes
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--error)]/15 text-[var(--error)]">
      No
    </span>
  );
}
