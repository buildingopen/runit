'use client';

import { useState, useEffect, Suspense, KeyboardEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiClient, type Project } from '../../../lib/api/client';

function ConfigurePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get('project');

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);

  // Environment variables state
  const [envVars, setEnvVars] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Tags state
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  // Load project data
  useEffect(() => {
    async function loadProject() {
      if (!projectId) {
        setError('No project ID provided');
        setLoading(false);
        return;
      }

      try {
        const data = await apiClient.getProject(projectId);
        setProject(data);

        // Initialize env vars with empty values for detected keys
        const initialEnvVars: Record<string, string> = {};
        (data.detected_env_vars || []).forEach((key) => {
          initialEnvVars[key] = '';
        });
        setEnvVars(initialEnvVars);

        // Initialize tags from project data
        if (data.tags && data.tags.length > 0) {
          setTags(data.tags);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load project');
      } finally {
        setLoading(false);
      }
    }

    loadProject();
  }, [projectId]);

  // Check if all required env vars are filled
  const detectedEnvVars = project?.detected_env_vars || [];
  const allEnvVarsFilled = detectedEnvVars.length === 0 ||
    detectedEnvVars.every((key) => envVars[key]?.trim());

  const handleEnvVarChange = (key: string, value: string) => {
    setEnvVars((prev) => ({ ...prev, [key]: value }));
  };

  const handleAddTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
    }
    setTagInput('');
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag();
    }
    if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      setTags(tags.slice(0, -1));
    }
  };

  const handleDeploy = async () => {
    if (!projectId || !allEnvVarsFilled) return;

    setIsDeploying(true);
    setError(null);

    try {
      // Save secrets if any
      const secretsToSave = Object.entries(envVars)
        .filter(([_, value]) => value.trim())
        .map(([key, value]) => ({ key, value }));

      if (secretsToSave.length > 0) {
        await apiClient.setSecrets(projectId, secretsToSave);
      }

      // Start deployment
      await apiClient.startDeploy(projectId);

      // Redirect to deploying page
      router.push(`/p/${projectId}/deploying`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to go live');
      setIsDeploying(false);
    }
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

  if (error && !project) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-14 h-14 bg-[var(--error)]/10 rounded-xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-[var(--error)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h2 className="text-[15px] font-semibold text-[var(--text-primary)] mb-1.5">Failed to load project</h2>
          <p className="text-[13px] text-[var(--text-tertiary)] mb-5">{error}</p>
          <Link
            href="/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-[13px] font-medium rounded-md"
          >
            Create New App
          </Link>
        </div>
      </div>
    );
  }

  const endpoints = project?.endpoints || [];

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="max-w-[560px] mx-auto px-6 py-12">
        {/* Back Link */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-[13px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] mb-6 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back to apps
        </Link>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-[24px] font-bold text-[var(--text-primary)] mb-1.5">Configure your app</h1>
          <p className="text-[14px] text-[var(--text-secondary)]">{project?.name}</p>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-6 px-5 py-4 bg-[var(--error-subtle)] border border-[var(--error)]/20 rounded-xl">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-8 h-8 bg-[var(--error)] rounded-full flex items-center justify-center flex-shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </div>
              <span className="text-[14px] font-semibold text-[var(--error)]">Something went wrong</span>
            </div>
            <p className="text-[13px] text-[var(--text-secondary)] ml-[42px]">{error}</p>
            <button
              onClick={() => setError(null)}
              className="inline-flex items-center gap-1.5 mt-4 ml-[42px] px-4 py-2.5 bg-transparent border border-[var(--border)] rounded-lg text-[13px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 4v6h6M23 20v-6h-6"/>
                <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15"/>
              </svg>
              Try again
            </button>
          </div>
        )}

        {/* Detected Endpoints */}
        {endpoints.length > 0 && (
          <div className="mb-6 p-4 bg-[var(--success)]/10 border border-[var(--success)]/20 rounded-[10px]">
            <div className="flex items-center gap-2 text-[var(--success)] text-[13px] font-medium mb-2.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              Detected {endpoints.length} action{endpoints.length !== 1 ? 's' : ''}
            </div>
            <div className="flex flex-wrap gap-2">
              {endpoints.map((ep: { id: string; path: string }) => (
                <span key={ep.id} className="px-3 py-1.5 bg-[var(--bg-secondary)] rounded-md text-[13px] font-mono text-[var(--text-secondary)]">
                  {ep.path}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Tags */}
        <div className="mb-6">
          <div className="text-[13px] font-medium text-[var(--text-secondary)] mb-2">Tags</div>
          <div className="flex flex-wrap gap-2 p-2.5 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg min-h-[44px] items-center focus-within:border-[var(--accent)] transition-colors">
            {tags.map((tag) => (
              <span key={tag} className="flex items-center gap-1 px-2 py-1 bg-[var(--bg-tertiary)] rounded text-[12px] text-[var(--text-secondary)]">
                {tag}
                <button onClick={() => handleRemoveTag(tag)} className="opacity-60 hover:opacity-100 cursor-pointer text-[var(--text-tertiary)]">
                  &times;
                </button>
              </span>
            ))}
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              onBlur={handleAddTag}
              placeholder={tags.length === 0 ? 'Add tags...' : 'Add more...'}
              className="flex-1 min-w-[80px] bg-transparent border-none outline-none text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
            />
          </div>
          <p className="text-[11px] text-[var(--text-tertiary)] mt-1.5">Press Enter or comma to add a tag</p>
        </div>

        {/* Environment Variables */}
        <div className="mb-6">
          <div className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--text-secondary)] mb-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0110 0v4"/>
            </svg>
            Secrets
          </div>
          {detectedEnvVars.length > 0 ? (
            <div className="space-y-2.5">
              {detectedEnvVars.map((key) => (
                <div key={key} className="flex items-center gap-2.5">
                  <div className="w-[140px] px-3 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-md text-[12px] font-mono text-[var(--text-secondary)] flex-shrink-0">
                    {key}
                  </div>
                  <input
                    type="password"
                    value={envVars[key] || ''}
                    onChange={(e) => handleEnvVarChange(key, e.target.value)}
                    onBlur={() => setTouched((prev) => ({ ...prev, [key]: true }))}
                    placeholder="Enter value..."
                    className={`flex-1 px-3 py-2.5 bg-[var(--bg-primary)] border rounded-md text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none transition-colors ${
                      !envVars[key]?.trim() && touched[key]
                        ? 'border-[var(--error)] focus:border-[var(--error)]'
                        : 'border-[var(--border)] focus:border-[var(--accent)]'
                    }`}
                  />
                </div>
              ))}
              <div className="flex items-center gap-1 text-[11px] text-[var(--text-tertiary)] mt-2">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 16v-4M12 8h.01"/>
                </svg>
                Stored encrypted, never exposed in shared links
              </div>
            </div>
          ) : (
            <div className="p-4 bg-[var(--bg-secondary)] border border-dashed border-[var(--border)] rounded-lg text-center text-[var(--text-tertiary)] text-[13px]">
              No secrets detected
            </div>
          )}
        </div>

        {/* Deploy Button */}
        <button
          onClick={handleDeploy}
          disabled={!allEnvVarsFilled || isDeploying}
          className="w-full py-4 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:bg-[var(--bg-tertiary)] disabled:text-[var(--text-tertiary)] disabled:cursor-not-allowed text-[var(--bg-primary)] text-[15px] font-semibold rounded-[10px] transition-all flex items-center justify-center gap-2"
        >
          {isDeploying ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Going live...
            </>
          ) : (
            <>Go live &rarr;</>
          )}
        </button>

        {/* Cancel Link */}
        <div className="text-center mt-3">
          <Link
            href="/dashboard"
            className="text-[13px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
          >
            Cancel
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ConfigurePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="flex items-center gap-3 text-[var(--text-tertiary)]">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-[13px]">Loading...</span>
        </div>
      </div>
    }>
      <ConfigurePageContent />
    </Suspense>
  );
}
