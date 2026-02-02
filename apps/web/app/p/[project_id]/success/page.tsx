'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient, type Project } from '../../../../lib/api/client';

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
  const [showConfetti, setShowConfetti] = useState(true);

  useEffect(() => {
    async function loadProject() {
      try {
        const data = await apiClient.getProject(projectId);
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
      } catch (err) {
        console.error('Failed to load project:', err);
      } finally {
        setLoading(false);
      }
    }

    loadProject();

    // Hide confetti after a few seconds
    const timer = setTimeout(() => {
      setShowConfetti(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, [projectId, router]);

  const appUrl = project?.runtime_url || `https://runtime.ai/p/${projectId}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(appUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleShareTwitter = () => {
    const text = `I just deployed ${project?.name || 'my app'} on Runtime!`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(appUrl)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
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

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col relative overflow-hidden">
      {/* Confetti Animation */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-confetti"
              style={{
                left: `${Math.random() * 100}%`,
                top: '-20px',
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 2}s`,
              }}
            >
              <div
                className="w-2 h-2 rounded-sm"
                style={{
                  backgroundColor: ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444'][
                    Math.floor(Math.random() * 5)
                  ],
                  transform: `rotate(${Math.random() * 360}deg)`,
                }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Header */}
      <header className="h-12 border-b border-[var(--border-subtle)] flex items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="text-[13px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
          >
            Apps
          </Link>
          <svg className="w-3 h-3 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-[13px] font-medium text-[var(--text-primary)]">{project?.name}</span>
        </div>
        <span className="px-2 py-0.5 text-[10px] font-medium bg-[var(--success)]/15 text-[var(--success)] rounded">
          Live
        </span>
      </header>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          {/* Success Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-[var(--success)]/15 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-[var(--success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-[24px] font-bold text-[var(--text-primary)] mb-2">
            Your app is live!
          </h1>
          <p className="text-[14px] text-[var(--text-tertiary)] mb-8">
            {project?.name} has been deployed successfully
          </p>

          {/* URL Card */}
          <div className="mb-6 p-4 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-[var(--text-tertiary)] mb-1">Share this URL</p>
                <p className="text-[13px] font-mono text-[var(--text-primary)] truncate">
                  {appUrl}
                </p>
              </div>
              <button
                onClick={handleCopy}
                className="flex-shrink-0 px-3 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] border border-[var(--border)] rounded-md transition-colors"
                title="Copy URL"
              >
                {copied ? (
                  <svg className="w-4 h-4 text-[var(--success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <Link
              href={`/p/${projectId}`}
              className="w-full px-4 py-3 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-[14px] font-medium rounded-md transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
              </svg>
              Run Your App
            </Link>

            <button
              onClick={handleShareTwitter}
              className="w-full px-4 py-3 bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] border border-[var(--border)] text-[var(--text-secondary)] text-[14px] font-medium rounded-md transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              Share on X
            </button>

            <Link
              href="/"
              className="w-full px-4 py-3 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] text-[14px] font-medium transition-colors flex items-center justify-center gap-2"
            >
              Back to Apps
            </Link>
          </div>
        </div>
      </div>

      {/* Confetti keyframes */}
      <style jsx>{`
        @keyframes confetti {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        .animate-confetti {
          animation: confetti linear forwards;
        }
      `}</style>
    </div>
  );
}
