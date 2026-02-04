'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { apiClient, type Project, type ProjectStatus } from '../lib/api/client';

export default function HomePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  const loadProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.listProjects();
      setProjects(response.projects || []);
      setRetryCount(0);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load apps';
      setError(message);
      if (retryCount < 1) {
        setRetryCount(prev => prev + 1);
        setTimeout(() => loadProjects(), 2000);
      }
    } finally {
      setLoading(false);
    }
  }, [retryCount]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Close delete modal on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDeleteConfirm(null);
    };
    if (deleteConfirm) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [deleteConfirm]);

  async function handleDelete(projectId: string) {
    try {
      setDeleting(projectId);
      setError(null);
      await apiClient.deleteProject(projectId);
      setProjects(projects.filter(p => p.project_id !== projectId));
      setDeleteConfirm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete app');
      setDeleteConfirm(null);
    } finally {
      setDeleting(null);
    }
  }

  const filteredProjects = projects.filter(p =>
    !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="max-w-[800px] mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-[28px] font-bold text-[var(--text-primary)] mb-1.5">Your Mini Apps</h1>
          <p className="text-[var(--text-secondary)]">Create, run, and share</p>
        </div>

        {/* Error Banner */}
        {error && !loading && (
          <div className="mb-6 px-4 py-3 bg-[var(--error-subtle)] border border-[var(--error)]/20 rounded-lg flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <svg className="w-5 h-5 text-[var(--error)] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <span className="text-[13px] text-[var(--error)] truncate">{error}</span>
            </div>
            <button
              onClick={() => { setRetryCount(0); loadProjects(); }}
              className="flex-shrink-0 px-3 py-1.5 text-[12px] font-medium text-[var(--error)] hover:bg-[var(--error)]/10 rounded-md transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="flex items-center gap-3 text-[var(--text-tertiary)]">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-[13px]">Loading...</span>
            </div>
          </div>
        ) : projects.length === 0 ? (
          /* Empty State */
          <div className="text-center py-16">
            <div className="text-5xl mb-4 opacity-50">📦</div>
            <h2 className="text-[18px] font-semibold text-[var(--text-primary)] mb-2">No apps yet</h2>
            <p className="text-[14px] text-[var(--text-secondary)] mb-6">
              Import your Python code and deploy it as a mini app in seconds
            </p>
            <Link
              href="/new"
              className="inline-flex items-center gap-2 px-6 py-3.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-[15px] font-semibold rounded-[10px] transition-colors"
            >
              <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
              </svg>
              Create your first app
            </Link>
          </div>
        ) : (
          <>
            {/* Search */}
            <div className="relative mb-6">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="11" cy="11" r="8"/>
                <path d="M21 21l-4.35-4.35"/>
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search apps..."
                className="w-full py-3.5 pl-11 pr-4 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-[10px] text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              />
            </div>

            {/* App List */}
            <div className="flex flex-col gap-2">
              {/* New App Button */}
              <Link
                href="/new"
                className="flex items-center justify-center gap-2.5 py-4 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--bg-primary)] text-[14px] font-medium rounded-xl transition-colors"
              >
                <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path d="M12 5v14M5 12h14"/>
                </svg>
                Create new app
              </Link>

              {/* App Items */}
              {filteredProjects.map((project) => (
                <AppItem
                  key={project.project_id}
                  project={project}
                  onDeleteClick={() => setDeleteConfirm(project.project_id)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Delete Modal */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setDeleteConfirm(null); }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
        >
          <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl p-7 max-w-[400px] w-full">
            <h3 id="delete-modal-title" className="text-[18px] font-semibold text-[var(--error)] mb-2">Delete app?</h3>
            <p className="text-[14px] text-[var(--text-secondary)] mb-5">
              This will permanently delete <strong>{projects.find(p => p.project_id === deleteConfirm)?.name}</strong> and all its data. This action cannot be undone.
            </p>
            <button
              onClick={() => handleDelete(deleteConfirm)}
              disabled={deleting === deleteConfirm}
              className="w-full py-3.5 bg-[var(--error)] hover:bg-[var(--error)]/90 text-white text-[14px] font-semibold rounded-lg mb-2 disabled:opacity-50 transition-colors"
            >
              {deleting === deleteConfirm ? 'Deleting...' : 'Delete app'}
            </button>
            <button
              onClick={() => setDeleteConfirm(null)}
              className="w-full py-3 bg-transparent border border-[var(--border)] text-[var(--text-secondary)] text-[13px] rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function getProjectLink(projectId: string, status: ProjectStatus | undefined): string {
  switch (status) {
    case 'draft':
      return `/create/configure?project=${projectId}`;
    case 'deploying':
      return `/p/${projectId}/deploying`;
    case 'live':
    case 'failed':
    default:
      return `/p/${projectId}`;
  }
}

function AppItem({ project, onDeleteClick }: { project: Project; onDeleteClick: () => void }) {
  const projectLink = getProjectLink(project.project_id, project.status);
  const isLive = project.status === 'live';
  const isFailed = project.status === 'failed';

  return (
    <div className="flex items-center gap-3.5 py-4 px-5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl hover:bg-[var(--bg-hover)] transition-colors">
      {/* Status Dot */}
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
        isFailed ? 'bg-[var(--error)]' : 'bg-[var(--success)]'
      }`} />

      {/* Link wrapping icon + info */}
      <Link href={projectLink} className="flex items-center gap-3.5 flex-1 min-w-0">
        {/* Emoji */}
        <span className="text-[28px] flex-shrink-0">
          {getProjectEmoji(project.name)}
        </span>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-semibold text-[var(--text-primary)]">{project.name}</div>
          <div className="text-[13px] text-[var(--text-secondary)] truncate">
            {(project as any).description || getDefaultDescription(project.name)}
          </div>
          {(project as any).tags && (project as any).tags.length > 0 && (
            <div className="flex items-center gap-2 mt-1.5">
              {(project as any).tags.map((tag: string, i: number) => (
                <span key={i} className="px-2 py-0.5 bg-[var(--bg-tertiary)] rounded text-[11px] text-[var(--text-tertiary)]">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </Link>

      {/* Actions */}
      <div className="flex items-center gap-1.5">
        {isLive && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              // Navigate to run page
              window.location.href = projectLink;
            }}
            className="w-9 h-9 flex items-center justify-center bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg text-[var(--text-secondary)] hover:bg-[var(--accent)] hover:border-[var(--accent)] hover:text-[var(--bg-primary)] transition-all"
            title="Run"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </button>
        )}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDeleteClick();
          }}
          className="w-9 h-9 flex items-center justify-center bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg text-[var(--text-secondary)] hover:bg-[var(--error)] hover:border-[var(--error)] hover:text-white transition-all"
          title="Delete"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

// Simple hash-based emoji picker for consistent project emojis
function getProjectEmoji(name: string): string {
  const emojis = ['🌤️', '✍️', '🔗', '🎨', '🚀', '📊', '🤖', '🔧', '📦', '⚡', '🎯', '🌍'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash |= 0;
  }
  return emojis[Math.abs(hash) % emojis.length];
}

function getDefaultDescription(name: string): string {
  return `${name.replace(/[-_]/g, ' ')} app`;
}
