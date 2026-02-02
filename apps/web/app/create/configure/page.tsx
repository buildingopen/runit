'use client';

import { useState, useEffect, Suspense } from 'react';
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
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load project');
      } finally {
        setLoading(false);
      }
    }

    loadProject();
  }, [projectId]);

  // Get first endpoint for preview
  const firstEndpoint = project?.versions?.[0] ? null : null; // We'll need to fetch endpoints

  // Check if all required env vars are filled
  const detectedEnvVars = project?.detected_env_vars || [];
  const allEnvVarsFilled = detectedEnvVars.length === 0 ||
    detectedEnvVars.every((key) => envVars[key]?.trim());

  const handleEnvVarChange = (key: string, value: string) => {
    setEnvVars((prev) => ({ ...prev, [key]: value }));
  };

  const handleDeploy = async () => {
    if (!projectId || !allEnvVarsFilled) return;

    setIsDeploying(true);
    setError(null);

    try {
      // First, save secrets if any
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
      setError(err instanceof Error ? err.message : 'Failed to start deployment');
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

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Header */}
      <header className="h-12 border-b border-[var(--border-subtle)] flex items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Link
            href="/new"
            className="flex items-center gap-2 text-[13px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back
          </Link>
          <span className="text-[var(--border)]">|</span>
          <span className="text-[13px] font-medium text-[var(--text-primary)]">{project?.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 text-[10px] font-medium bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] rounded">
            Step 2 of 3
          </span>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <h1 className="text-[18px] font-semibold text-[var(--text-primary)] mb-1">Configure</h1>
        <p className="text-[13px] text-[var(--text-tertiary)] mb-8">
          Review your app and provide any required environment variables
        </p>

        {/* Error Banner */}
        {error && (
          <div className="mb-6 px-4 py-3 bg-[var(--error-subtle)] border border-[var(--error)]/20 rounded-lg flex items-start gap-3">
            <svg className="w-5 h-5 text-[var(--error)] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-[var(--error)]">Deployment failed</p>
              <p className="text-[12px] text-[var(--error)]/80 mt-0.5">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="p-1 text-[var(--error)] hover:bg-[var(--error)]/10 rounded"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* App Info Card */}
        <div className="mb-6 p-4 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[var(--bg-tertiary)] to-[var(--bg-hover)] border border-[var(--border)] rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
              </svg>
            </div>
            <div>
              <h3 className="text-[14px] font-medium text-[var(--text-primary)]">{project?.name}</h3>
              <p className="text-[11px] text-[var(--text-tertiary)] font-mono">
                {project?.versions?.[0]?.version_hash?.substring(0, 7) || 'v1'}
              </p>
            </div>
          </div>

          {/* Endpoint Preview */}
          <div className="pt-3 border-t border-[var(--border)]">
            <p className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-2">
              Detected Endpoints
            </p>
            <div className="text-[12px] text-[var(--text-secondary)]">
              {project?.versions?.length ? (
                <p className="italic text-[var(--text-tertiary)]">
                  Endpoints will be available after deployment
                </p>
              ) : (
                <p className="italic text-[var(--text-tertiary)]">No endpoints detected</p>
              )}
            </div>
          </div>
        </div>

        {/* Environment Variables */}
        {detectedEnvVars.length > 0 && (
          <div className="mb-6">
            <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-2">
              Environment Variables <span className="text-[var(--error)]">*</span>
            </label>
            <p className="text-[11px] text-[var(--text-tertiary)] mb-3">
              These variables were detected in your code and are required for deployment
            </p>
            <div className="space-y-3">
              {detectedEnvVars.map((key) => (
                <div key={key}>
                  <div className="flex items-center gap-2 mb-1">
                    <code className="text-[11px] font-mono text-[var(--text-primary)] bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded">
                      {key}
                    </code>
                    {!envVars[key]?.trim() && touched[key] && (
                      <span className="text-[10px] text-[var(--error)]">Required</span>
                    )}
                  </div>
                  <input
                    type="password"
                    value={envVars[key] || ''}
                    onChange={(e) => handleEnvVarChange(key, e.target.value)}
                    onBlur={() => setTouched((prev) => ({ ...prev, [key]: true }))}
                    placeholder="Enter value..."
                    className={`w-full px-3 py-2 bg-[var(--bg-secondary)] border rounded-md text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-1 transition-colors ${
                      !envVars[key]?.trim() && touched[key]
                        ? 'border-[var(--error)] focus:border-[var(--error)] focus:ring-[var(--error)]'
                        : 'border-[var(--border)] focus:border-[var(--accent)] focus:ring-[var(--accent)]'
                    }`}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No Env Vars Message */}
        {detectedEnvVars.length === 0 && (
          <div className="mb-6 p-4 bg-[var(--success-subtle)] border border-[var(--success)]/20 rounded-lg">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-[var(--success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              <p className="text-[13px] text-[var(--success)]">
                No environment variables required
              </p>
            </div>
            <p className="text-[11px] text-[var(--text-tertiary)] mt-1 ml-7">
              Your app is ready to deploy
            </p>
          </div>
        )}

        {/* Deploy Button */}
        <button
          onClick={handleDeploy}
          disabled={!allEnvVarsFilled || isDeploying}
          className="w-full px-4 py-3 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:bg-[var(--bg-tertiary)] disabled:text-[var(--text-tertiary)] disabled:cursor-not-allowed text-white text-[14px] font-medium rounded-md transition-all flex items-center justify-center gap-2 shadow-sm"
        >
          {isDeploying ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Starting deployment...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z" />
              </svg>
              Deploy App
            </>
          )}
        </button>

        {/* Help Text */}
        <p className="text-center text-[11px] text-[var(--text-tertiary)] mt-4">
          Your app will be deployed to a secure, isolated sandbox
        </p>
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
