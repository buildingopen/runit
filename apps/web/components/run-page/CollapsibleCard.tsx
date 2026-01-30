// ABOUTME: Collapsible card component - expandable container for nested objects
// ABOUTME: Shows label and preview when collapsed, full content when expanded

'use client';

import { useState, type ReactNode } from 'react';

interface CollapsibleCardProps {
  label: string;
  preview?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

export function CollapsibleCard({
  label,
  preview,
  children,
  defaultOpen = false,
}: CollapsibleCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-[var(--border)] rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] transition-colors text-left"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-xs font-medium text-[var(--text-primary)]">
            {label}
          </span>
          {!isOpen && preview && (
            <span className="text-xs text-[var(--text-tertiary)] truncate">
              {preview}
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-[var(--text-tertiary)] flex-shrink-0 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="px-3 py-3 bg-[var(--bg-secondary)] border-t border-[var(--border)]">
          {children}
        </div>
      )}
    </div>
  );
}
