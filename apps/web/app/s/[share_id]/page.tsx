// ABOUTME: Share Link Handler - Redirects to appropriate page based on share link type
// ABOUTME: Handles endpoint templates (→ Run Page) and run results (→ Result View)

'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api/client';

interface PageProps {
  params: Promise<{
    share_id: string;
  }>;
}

export default function ShareLinkPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const shareId = resolvedParams.share_id;
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function handleShareLink() {
      try {
        const data = await apiClient.getShareLink(shareId);

        if (!mounted) return;

        // Redirect based on target type
        if (data.target_type === 'endpoint_template') {
          router.push(`/p/${data.project.project_id}?endpoint=${data.target_ref}`);
        } else if (data.target_type === 'run_result') {
          router.push(`/r/${data.target_ref}`);
        } else {
          throw new Error('Invalid share link type');
        }
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load share link');
      }
    }

    handleShareLink();
    return () => { mounted = false; };
  }, [shareId, router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)] p-6">
        <div className="max-w-md text-center">
          <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--error)]/20 p-8">
            <div className="w-12 h-12 rounded-full bg-[var(--error-subtle)] flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-[var(--error)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
              Share link not available
            </h2>
            <p className="text-[var(--text-secondary)]">{error}</p>
            {error.includes('disabled') && (
              <p className="mt-4 text-sm text-[var(--text-tertiary)]">
                This link has been disabled by the owner.
              </p>
            )}
            <Link
              href="/"
              className="inline-flex items-center gap-2 mt-6 px-4 py-2 text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-md transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              Back to Projects
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-4 border-[var(--border)] border-t-[var(--text-primary)] rounded-full animate-spin" />
        <p className="text-sm text-[var(--text-tertiary)]">Loading share link...</p>
      </div>
    </div>
  );
}
