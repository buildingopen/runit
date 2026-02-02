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
      // Auto-retry on first failure after 2 seconds
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

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Page Header */}
      <header className="h-12 border-b border-[var(--border-subtle)] flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <h1 className="text-[13px] font-semibold text-[var(--text-primary)]">Apps</h1>
          {!loading && projects.length > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-tertiary)] bg-[var(--bg-tertiary)] rounded">
              {projects.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={loadProjects}
            disabled={loading}
            className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-md disabled:opacity-50"
            title="Refresh"
          >
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="p-4 sm:p-6">
        {error && !loading && (
          <div className="mb-4 px-4 py-3 bg-[var(--error-subtle)] border border-[var(--error)]/20 rounded-lg flex items-center justify-between gap-4">
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
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-14 h-14 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-xl flex items-center justify-center mb-5">
              <svg className="w-7 h-7 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h2 className="text-[15px] font-semibold text-[var(--text-primary)] mb-1.5">No apps yet</h2>
            <p className="text-[13px] text-[var(--text-tertiary)] mb-5 max-w-[280px]">
              Get started by creating your first FastAPI app
            </p>
            <Link
              href="/new"
              className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-[13px] font-medium rounded-md shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              New App
            </Link>
          </div>
        ) : (
          <div className="space-y-1">
            {projects.map((project) => (
              <ProjectRow
                key={project.project_id}
                project={project}
                deleteConfirm={deleteConfirm}
                setDeleteConfirm={setDeleteConfirm}
                deleting={deleting}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setDeleteConfirm(null); }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
        >
          <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-5 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 bg-[var(--error-subtle)] rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-[var(--error)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div>
                <h3 id="delete-modal-title" className="text-[14px] font-semibold text-[var(--text-primary)]">Delete app?</h3>
                <p className="text-[12px] text-[var(--text-tertiary)]">This action cannot be undone</p>
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-3 py-1.5 text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={deleting === deleteConfirm}
                className="px-3 py-1.5 bg-[var(--error)] hover:bg-[var(--error)]/90 text-white text-[13px] font-medium rounded-md disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--error)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-secondary)]"
                autoFocus
              >
                {deleting === deleteConfirm ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Get the appropriate link based on project status
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

// Get status badge config
function getStatusBadge(status: ProjectStatus | undefined): { label: string; className: string } {
  switch (status) {
    case 'draft':
      return { label: 'Draft', className: 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]' };
    case 'deploying':
      return { label: 'Deploying', className: 'bg-[var(--accent)]/15 text-[var(--accent)]' };
    case 'failed':
      return { label: 'Failed', className: 'bg-[var(--error)]/15 text-[var(--error)]' };
    case 'live':
    default:
      return { label: 'Live', className: 'bg-[var(--success-subtle)] text-[var(--success)]' };
  }
}

function ProjectRow({
  project,
  deleteConfirm,
  setDeleteConfirm,
  deleting,
  onDelete
}: {
  project: Project;
  deleteConfirm: string | null;
  setDeleteConfirm: (id: string | null) => void;
  deleting: string | null;
  onDelete: (id: string) => void;
}) {
  const latestVersion = project.versions?.[project.versions.length - 1];
  const projectLink = getProjectLink(project.project_id, project.status);
  const statusBadge = getStatusBadge(project.status);

  return (
    <div className="group flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--bg-hover)] transition-colors">
      <Link
        href={projectLink}
        className="flex items-center gap-3 flex-1 min-w-0"
      >
        {/* Icon */}
        <div className="w-9 h-9 bg-gradient-to-br from-[var(--bg-tertiary)] to-[var(--bg-hover)] border border-[var(--border)] rounded-lg flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
          </svg>
        </div>

        {/* Name & Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-[13px] text-[var(--text-primary)] truncate">{project.name}</span>
            <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${statusBadge.className}`}>
              {statusBadge.label}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[var(--text-tertiary)]">
            <span className="font-mono">{project.latest_version?.substring(0, 7) || latestVersion?.version_hash?.substring(0, 7) || '—'}</span>
            <span>·</span>
            <span>{new Date(project.created_at).toLocaleDateString()}</span>
          </div>
        </div>
      </Link>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDeleteConfirm(project.project_id);
          }}
          className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--error)] hover:bg-[var(--error-subtle)] rounded-md"
          title="Delete"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
          </svg>
        </button>
        <Link
          href={projectLink}
          className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-active)] rounded-md"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
