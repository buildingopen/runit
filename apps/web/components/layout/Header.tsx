'use client';

/**
 * Global Header Component
 */

import Link from 'next/link';
import { Logo } from './Logo';
import { ApiStatus } from './ApiStatus';

export function Header() {
  return (
    <header className="bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)] sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-4">
            <ApiStatus />
            <Link
              href="/new"
              className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors text-sm font-medium flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New App
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
