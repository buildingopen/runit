// ABOUTME: Project settings page - General, API Keys, Versions, Code, Danger Zone
// ABOUTME: Standalone layout with back button, centered content

'use client';

import { useState, use, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useProject,
  useSecrets,
  useCreateSecret,
  useDeleteSecret,
  useVersions,
  useRollback,
} from '@/lib/hooks/useProject';
import { apiClient } from '@/lib/api/client';
import { getProjectEmoji } from '@/lib/utils';
import { CodeViewer } from '@/components/settings/CodeViewer';
import { toast } from 'sonner';

type SettingsTab = 'general' | 'api-keys' | 'versions' | 'code' | 'danger';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, staleTime: 30000 },
  },
});

interface PageProps {
  params: Promise<{ project_id: string }>;
}

function SettingsContent({ projectId }: { projectId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentTab = (searchParams.get('tab') as SettingsTab) || 'general';

  const { data: project, isLoading: projectLoading } = useProject(projectId);

  // General tab state
  const [editName, setEditName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  // Initialize name from project data
  useEffect(() => {
    if (project?.name) {
      setEditName(project.name);
    }
  }, [project?.name]);

  // API Keys tab
  const { data: secretsData, isLoading: secretsLoading } = useSecrets(projectId);
  const createSecret = useCreateSecret();
  const deleteSecret = useDeleteSecret();
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [keyError, setKeyError] = useState<string | null>(null);
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);

  // Versions tab
  const { data: versionsData, isLoading: versionsLoading } = useVersions(projectId);
  const rollback = useRollback();
  const [confirmRollback, setConfirmRollback] = useState<string | null>(null);

  // Danger zone
  const [deleteInput, setDeleteInput] = useState('');
  const [deletingProject, setDeletingProject] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: 'general', label: 'General' },
    { id: 'api-keys', label: 'API Keys' },
    { id: 'versions', label: 'Versions' },
    { id: 'code', label: 'Code' },
    { id: 'danger', label: 'Danger Zone' },
  ];

  const setTab = (tab: SettingsTab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    router.replace(`/p/${projectId}/settings?${params.toString()}`);
  };

  const handleSaveName = async () => {
    if (!editName.trim()) return;
    setSavingName(true);
    setNameError(null);
    try {
      await apiClient.updateProject(projectId, { name: editName.trim() });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      toast.success('Name updated');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save';
      setNameError(msg);
      toast.error(msg);
    } finally {
      setSavingName(false);
    }
  };

  const handleAddSecret = async () => {
    setKeyError(null);
    const key = newKey.trim();
    if (!key || !newValue) return;

    // Validate UPPERCASE_SNAKE_CASE
    if (!/^[A-Z][A-Z0-9_]*$/.test(key)) {
      setKeyError('Key must be UPPERCASE_SNAKE_CASE (e.g. API_KEY)');
      return;
    }

    try {
      await createSecret.mutateAsync({ projectId, key, value: newValue });
      setNewKey('');
      setNewValue('');
      toast.success('Secret added');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to add secret';
      setKeyError(msg);
      toast.error(msg);
    }
  };

  const handleDeleteSecret = async (key: string) => {
    try {
      await deleteSecret.mutateAsync({ projectId, key });
      setConfirmDeleteKey(null);
      toast.success('Secret deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(projectId);
    toast.success('Copied');
  };

  if (projectLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--border-secondary)] border-t-[var(--accent)] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      {/* Back link */}
      <Link
        href={`/p/${projectId}`}
        className="inline-flex items-center gap-2 text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-6 transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        Back to app
      </Link>

      {/* Page header */}
      <div className="flex items-center gap-3 mb-8">
        <span className="text-[32px]">{project ? getProjectEmoji(project.name) : ''}</span>
        <div>
          <h1 className="text-[22px] font-bold text-[var(--text-primary)]">{project?.name}</h1>
          <p className="text-[13px] text-[var(--text-tertiary)]">Settings</p>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-[var(--border)] mb-8">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setTab(tab.id)}
            className={`px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${
              currentTab === tab.id
                ? 'border-[var(--accent)] text-[var(--text-primary)]'
                : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
            } ${tab.id === 'danger' ? 'text-[var(--error)]' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* General tab */}
      {currentTab === 'general' && (
        <div className="space-y-6">
          {/* Name */}
          <div>
            <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-2">
              App Name
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="flex-1 px-3 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-[14px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              />
              <button
                onClick={handleSaveName}
                disabled={savingName || editName === project?.name}
                className="px-4 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--bg-primary)] text-[13px] font-medium rounded-lg disabled:opacity-50 transition-colors"
              >
                {savingName ? 'Saving...' : 'Save'}
              </button>
            </div>
            {nameError && (
              <p className="mt-1.5 text-[12px] text-[var(--error)]">{nameError}</p>
            )}
          </div>

          {/* Project ID */}
          <div>
            <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-2">
              App ID
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg text-[13px] text-[var(--text-primary)] font-mono select-all">
                {projectId}
              </code>
              <button
                onClick={handleCopyId}
                className="px-3 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg text-[var(--text-secondary)] hover:bg-[var(--accent)] hover:border-[var(--accent)] hover:text-[var(--bg-primary)] transition-all"
                title="Copy"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2"/>
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-2">
              Status
            </label>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium ${
              project?.status === 'live'
                ? 'bg-[var(--success)]/10 text-[var(--success)]'
                : project?.status === 'failed'
                ? 'bg-[var(--error)]/10 text-[var(--error)]'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                project?.status === 'live' ? 'bg-[var(--success)]' :
                project?.status === 'failed' ? 'bg-[var(--error)]' :
                'bg-[var(--text-tertiary)]'
              }`} />
              {project?.status || 'unknown'}
            </span>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-2">
                Created
              </label>
              <span className="text-[13px] text-[var(--text-primary)]">
                {project?.created_at ? new Date(project.created_at).toLocaleDateString() : '-'}
              </span>
            </div>
            <div>
              <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-2">
                Last Deployed
              </label>
              <span className="text-[13px] text-[var(--text-primary)]">
                {project?.deployed_at ? new Date(project.deployed_at).toLocaleDateString() : '-'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* API Keys tab */}
      {currentTab === 'api-keys' && (
        <div className="space-y-6">
          {/* Add new secret */}
          <div className="p-4 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg space-y-3">
            <h3 className="text-[13px] font-medium text-[var(--text-primary)]">Add API Key</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={newKey}
                onChange={(e) => { setNewKey(e.target.value.toUpperCase()); setKeyError(null); }}
                placeholder="KEY_NAME"
                className="w-40 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg text-[13px] text-[var(--text-primary)] font-mono placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]"
              />
              <input
                type="password"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="Value"
                className="flex-1 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]"
              />
              <button
                onClick={handleAddSecret}
                disabled={createSecret.isPending || !newKey.trim() || !newValue}
                className="px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--bg-primary)] text-[13px] font-medium rounded-lg disabled:opacity-50 transition-colors"
              >
                {createSecret.isPending ? 'Adding...' : 'Add'}
              </button>
            </div>
            {keyError && (
              <p className="text-[12px] text-[var(--error)]">{keyError}</p>
            )}
          </div>

          {/* Existing secrets */}
          {secretsLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-14 bg-[var(--bg-tertiary)] rounded-lg animate-pulse" />
              ))}
            </div>
          ) : secretsData?.secrets && secretsData.secrets.length > 0 ? (
            <div className="space-y-2">
              {secretsData.secrets.map((secret) => (
                <div
                  key={secret.key}
                  className="flex items-center justify-between px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg"
                >
                  <div>
                    <code className="text-[13px] text-[var(--text-primary)] font-mono">{secret.key}</code>
                    <div className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
                      {secret.created_at ? new Date(secret.created_at).toLocaleDateString() : ''}
                    </div>
                  </div>
                  {confirmDeleteKey === secret.key ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] text-[var(--error)]">Delete?</span>
                      <button
                        onClick={() => handleDeleteSecret(secret.key)}
                        disabled={deleteSecret.isPending}
                        className="px-2.5 py-1 bg-[var(--error)] text-white text-[11px] font-medium rounded transition-colors"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setConfirmDeleteKey(null)}
                        className="px-2.5 py-1 bg-[var(--bg-tertiary)] text-[var(--text-secondary)] text-[11px] font-medium rounded transition-colors"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteKey(secret.key)}
                      className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--error)] transition-colors"
                      title="Delete"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-[var(--text-tertiary)]">
              <p className="text-[13px]">No API keys configured</p>
              <p className="text-[12px] mt-1">Add keys your code needs at runtime</p>
            </div>
          )}
        </div>
      )}

      {/* Versions tab */}
      {currentTab === 'versions' && (
        <div className="space-y-4">
          {versionsLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-16 bg-[var(--bg-tertiary)] rounded-lg animate-pulse" />
              ))}
            </div>
          ) : versionsData?.versions && versionsData.versions.length > 0 ? (
            versionsData.versions.map((version, index) => {
              const isActive = index === 0;
              return (
                <div
                  key={version.version_id}
                  className={`flex items-center justify-between px-4 py-3 bg-[var(--bg-secondary)] border rounded-lg ${
                    isActive ? 'border-[var(--accent)]/30' : 'border-[var(--border)]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <code className="text-[12px] text-[var(--text-primary)] font-mono">
                      {version.version_hash.slice(0, 8)}
                    </code>
                    <span className="text-[12px] text-[var(--text-tertiary)]">
                      {new Date(version.created_at).toLocaleDateString()}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                      version.status === 'ready'
                        ? 'bg-[var(--success)]/10 text-[var(--success)]'
                        : 'bg-[var(--error)]/10 text-[var(--error)]'
                    }`}>
                      {version.status}
                    </span>
                    {isActive && (
                      <span className="px-2 py-0.5 rounded bg-[var(--accent)]/10 text-[var(--accent)] text-[10px] font-medium">
                        Active
                      </span>
                    )}
                  </div>
                  {!isActive && version.status === 'ready' && (
                    confirmRollback === version.version_id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] text-[var(--warning)]">Rollback?</span>
                        <button
                          onClick={async () => {
                            await rollback.mutateAsync({ projectId, versionId: version.version_id });
                            setConfirmRollback(null);
                          }}
                          disabled={rollback.isPending}
                          className="px-2.5 py-1 bg-[var(--warning)] text-[var(--bg-primary)] text-[11px] font-medium rounded transition-colors"
                        >
                          {rollback.isPending ? '...' : 'Yes'}
                        </button>
                        <button
                          onClick={() => setConfirmRollback(null)}
                          className="px-2.5 py-1 bg-[var(--bg-tertiary)] text-[var(--text-secondary)] text-[11px] font-medium rounded transition-colors"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmRollback(version.version_id)}
                        className="px-3 py-1.5 text-[12px] text-[var(--text-secondary)] hover:text-[var(--warning)] border border-[var(--border)] rounded-lg hover:border-[var(--warning)] transition-colors"
                      >
                        Rollback
                      </button>
                    )
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-center py-8 text-[var(--text-tertiary)]">
              <p className="text-[13px]">No versions found</p>
            </div>
          )}
        </div>
      )}

      {/* Code tab */}
      {currentTab === 'code' && (
        <CodeViewer codeBundleBase64={project?.versions?.[0]?.code_bundle} />
      )}

      {/* Danger Zone tab */}
      {currentTab === 'danger' && (
        <div className="space-y-6">
          <div className="p-5 border-2 border-[var(--error)]/30 rounded-lg space-y-4">
            <h3 className="text-[15px] font-semibold text-[var(--error)]">Delete this app</h3>
            <p className="text-[13px] text-[var(--text-secondary)]">
              Once deleted, all data, runs, and versions will be permanently removed. This cannot be undone.
            </p>
            <div>
              <label className="block text-[12px] text-[var(--text-tertiary)] mb-2">
                Type <strong className="text-[var(--text-primary)]">{project?.name}</strong> to confirm
              </label>
              <input
                type="text"
                value={deleteInput}
                onChange={(e) => setDeleteInput(e.target.value)}
                placeholder={project?.name}
                className="w-full px-3 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--error)]"
              />
            </div>
            {deleteError && (
              <p className="text-[12px] text-[var(--error)]">{deleteError}</p>
            )}
            <button
              onClick={async () => {
                setDeletingProject(true);
                setDeleteError(null);
                try {
                  await apiClient.deleteProject(projectId);
                  router.push('/dashboard');
                } catch (err) {
                  setDeleteError(err instanceof Error ? err.message : 'Failed to delete');
                  setDeletingProject(false);
                }
              }}
              disabled={deleteInput !== project?.name || deletingProject}
              className="w-full py-3 bg-[var(--error)] hover:bg-[var(--error)]/90 text-white text-[14px] font-semibold rounded-lg disabled:opacity-50 transition-colors"
            >
              {deletingProject ? 'Deleting...' : 'Delete this app permanently'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage({ params }: PageProps) {
  const resolvedParams = use(params);

  return (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={
        <div className="h-screen flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[var(--border-secondary)] border-t-[var(--accent)] rounded-full animate-spin" />
        </div>
      }>
        <SettingsContent projectId={resolvedParams.project_id} />
      </Suspense>
    </QueryClientProvider>
  );
}
