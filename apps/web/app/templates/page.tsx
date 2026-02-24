'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '../../lib/api/client';
import { trackTemplateUsed } from '../../lib/analytics';

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  requiredSecrets: string[];
}

const CATEGORY_ICONS: Record<string, string> = {
  document: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  ai: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  data: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4',
};

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient.listTemplates()
      .then((data) => setTemplates(data.templates))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleUseTemplate = async (template: Template) => {
    setCreating(template.id);
    try {
      // Get a proper ZIP bundle from the backend
      const bundle = await apiClient.createFromTemplate(template.id);

      // Create a project with the real ZIP data
      const response = await apiClient.createProject({
        name: template.name.toLowerCase().replace(/\s+/g, '-'),
        source_type: 'zip',
        zip_data: bundle.zip_data,
      });

      trackTemplateUsed(template.id);
      router.push(`/create/configure?project=${response.project_id}`);
    } catch (err) {
      console.error('Template creation failed:', err);
      const message = err instanceof Error ? err.message : 'Failed to create project from template';
      if (message.includes('Authentication') || message.includes('401') || message.includes('auth')) {
        setError('Please sign in to create projects from templates.');
      } else {
        setError(message);
      }
      setCreating(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[var(--border)] border-t-[var(--accent)] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-[13px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] mb-6 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back to apps
        </Link>

        <h1 className="text-[24px] font-bold text-[var(--text-primary)] mb-2">Templates</h1>
        <p className="text-[14px] text-[var(--text-secondary)] mb-8">
          Start with a pre-built app and customize it
        </p>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400 flex-shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/>
            </svg>
            <div className="flex-1">
              <p className="text-sm text-red-400">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <div
              key={template.id}
              className="p-5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl hover:border-[var(--accent)] transition-colors"
            >
              <div className="w-10 h-10 bg-[var(--bg-tertiary)] rounded-lg flex items-center justify-center mb-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--text-secondary)]">
                  <path strokeLinecap="round" strokeLinejoin="round" d={CATEGORY_ICONS[template.category] || CATEGORY_ICONS.data} />
                </svg>
              </div>
              <h3 className="text-[15px] font-semibold text-[var(--text-primary)] mb-1">{template.name}</h3>
              <p className="text-[13px] text-[var(--text-secondary)] mb-4 line-clamp-2">{template.description}</p>
              {template.requiredSecrets.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {template.requiredSecrets.map((s) => (
                    <span key={s} className="px-2 py-0.5 bg-[var(--bg-tertiary)] text-[11px] font-mono text-[var(--text-tertiary)] rounded">
                      {s}
                    </span>
                  ))}
                </div>
              )}
              <button
                onClick={() => handleUseTemplate(template)}
                disabled={creating !== null}
                className="w-full py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-[13px] font-medium rounded-lg disabled:opacity-50 transition-colors"
              >
                {creating === template.id ? 'Creating...' : 'Use template'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
