/**
 * Execution Layer Brand Logo
 */

import Link from 'next/link';

interface LogoProps {
  showTagline?: boolean;
}

export function Logo({ showTagline = true }: LogoProps) {
  return (
    <Link href="/" className="flex items-center gap-2">
      <div className="w-8 h-8 bg-[var(--accent)] rounded-lg flex items-center justify-center shadow-sm">
        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>
      <div>
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Execution Layer</h1>
        {showTagline && (
          <p className="text-xs text-[var(--text-tertiary)]">Colab for Apps</p>
        )}
      </div>
    </Link>
  );
}
