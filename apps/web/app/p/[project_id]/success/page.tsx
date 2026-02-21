'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient, type Project } from '../../../../lib/api/client';
import { getProjectEmoji } from '@/lib/utils';

interface PageProps {
  params: Promise<{
    project_id: string;
  }>;
}

export default function SuccessPage({ params }: PageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const projectId = resolvedParams.project_id;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [navigating, setNavigating] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadProject() {
      try {
        const data = await apiClient.getProject(projectId);

        if (!mounted) return;
        setProject(data);

        // If not live, redirect appropriately
        if (data.status === 'draft') {
          router.push(`/create/configure?project=${projectId}`);
          return;
        }
        if (data.status === 'deploying') {
          router.push(`/p/${projectId}/deploying`);
          return;
        }
      } catch {
        // Project load failed — UI will show fallback state
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadProject();
    return () => { mounted = false; };
  }, [projectId, router]);

  const runtimeUrl = project?.runtime_url;
  const hasUrl = !!runtimeUrl;
  const displayUrl = runtimeUrl || '';

  const handleCopy = async () => {
    if (!hasUrl) return;
    try {
      await navigator.clipboard.writeText(runtimeUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleShareTwitter = () => {
    const text = `I just deployed ${project?.name || 'my app'} on Runtime!`;
    const shareUrl = hasUrl ? runtimeUrl : window.location.href;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleRunNow = () => {
    setNavigating(true);
    router.push(`/p/${projectId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="flex items-center gap-3 text-[var(--text-tertiary)]">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-[13px]">Loading...</span>
        </div>
      </div>
    );
  }

  const emoji = project ? getProjectEmoji(project.name) : '🚀';

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-6">
      <div className="w-full max-w-[480px] text-center py-16">
        {/* Emoji */}
        <div className="text-[72px] mb-2 animate-bounce-in">{emoji}</div>

        {/* Live Badge */}
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[var(--success)]/10 rounded-full text-[var(--success)] text-[13px] font-semibold mb-5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          Live
        </div>

        {/* Title */}
        <h1 className="text-[32px] font-bold text-[var(--text-primary)] mb-2">
          {project?.name || 'Your app'} is ready!
        </h1>
        <p className="text-[16px] text-[var(--text-secondary)] mb-8">
          Share it with anyone &mdash; they can run it instantly
        </p>

        {/* URL Box */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-5 mb-6">
          <div className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-3">
            Your app link
          </div>
          {hasUrl ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={displayUrl}
                readOnly
                className="flex-1 py-3.5 px-4 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg text-[15px] font-mono text-[var(--text-primary)] text-center"
              />
              <button
                onClick={handleCopy}
                className="px-5 py-3.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--bg-primary)] text-[14px] font-semibold rounded-lg transition-colors"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          ) : (
            <p className="text-[13px] text-[var(--text-tertiary)] py-3">
              URL will be available once deployment is fully provisioned
            </p>
          )}
        </div>

        {/* Share on X */}
        <div className="flex justify-center mb-8">
          <button
            onClick={handleShareTwitter}
            className="flex items-center gap-2 px-5 py-3 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] text-[13px] font-medium hover:bg-[var(--bg-hover)] hover:border-[var(--text-tertiary)] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            Share on X
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-center">
          <Link
            href="/dashboard"
            className="px-8 py-4 bg-transparent border border-[var(--border)] text-[var(--text-secondary)] text-[16px] font-semibold rounded-[10px] hover:bg-[var(--bg-hover)] transition-colors"
          >
            &larr; Back to apps
          </Link>
          <button
            onClick={handleRunNow}
            disabled={navigating}
            className="px-8 py-4 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--bg-primary)] text-[16px] font-semibold rounded-[10px] transition-colors disabled:opacity-70 flex items-center gap-2"
          >
            {navigating ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Loading...
              </>
            ) : (
              <>Run it now &rarr;</>
            )}
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes bounce-in {
          0% { transform: scale(0); }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }
        .animate-bounce-in {
          animation: bounce-in 0.6s ease-out;
        }
      `}</style>
    </div>
  );
}
