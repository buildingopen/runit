'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '../../lib/api/client';

type SourceType = 'zip' | 'github';

// Validation helpers
const isValidProjectName = (name: string): boolean => {
  return /^[a-zA-Z0-9][a-zA-Z0-9-_]*$/.test(name) && name.length >= 2 && name.length <= 50;
};

const isValidGithubUrl = (url: string): boolean => {
  return /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+/.test(url);
};

export default function NewProjectPage() {
  const router = useRouter();
  const [sourceType, setSourceType] = useState<SourceType>('zip');
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // ZIP state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [zipBase64, setZipBase64] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // GitHub state
  const [githubUrl, setGithubUrl] = useState('');
  const [githubBranch, setGithubBranch] = useState('');

  // Focus name input on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      document.getElementById('project-name')?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleFileSelect = async (file: File) => {
    if (!file.name.endsWith('.zip')) {
      setError('Please select a ZIP file');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setError('File size must be less than 50MB');
      return;
    }
    if (file.size < 100) {
      setError('File appears to be empty or corrupted');
      return;
    }

    setSelectedFile(file);
    setError(null);
    setIsProcessingFile(true);

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      setZipBase64(base64);
      setIsProcessingFile(false);
    };
    reader.onerror = () => {
      setError('Failed to read file');
      setSelectedFile(null);
      setIsProcessingFile(false);
    };
    reader.readAsDataURL(file);

    if (!name) {
      const suggestedName = file.name.replace('.zip', '').replace(/[^a-zA-Z0-9-_]/g, '-');
      setName(suggestedName);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const getValidationErrors = (): Record<string, string> => {
    const errors: Record<string, string> = {};

    if (!name.trim()) {
      errors.name = 'Project name is required';
    } else if (!isValidProjectName(name.trim())) {
      errors.name = 'Name must be 2-50 chars, start with letter/number, contain only letters, numbers, hyphens, underscores';
    }

    if (sourceType === 'zip') {
      if (!zipBase64 && !isProcessingFile) {
        errors.source = 'Please upload a ZIP file';
      }
    } else {
      if (!githubUrl) {
        errors.source = 'GitHub URL is required';
      } else if (!isValidGithubUrl(githubUrl)) {
        errors.source = 'Please enter a valid GitHub URL (e.g., https://github.com/owner/repo)';
      }
    }

    return errors;
  };

  const validationErrors = getValidationErrors();
  const isValid = Object.keys(validationErrors).length === 0 && !isProcessingFile;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Mark all fields as touched
    setTouched({ name: true, source: true });

    if (!isValid || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await apiClient.createProject({
        name: name.trim(),
        source_type: sourceType,
        ...(sourceType === 'zip' && { zip_data: zipBase64 }),
        ...(sourceType === 'github' && {
          github_url: githubUrl.trim(),
          ...(githubBranch.trim() && { github_ref: githubBranch.trim() }),
        }),
      });
      router.push(`/p/${response.project_id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create project';
      setError(message);
      setIsSubmitting(false);
      // Scroll to error
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Page Header */}
      <header className="h-12 border-b border-[var(--border-subtle)] flex items-center px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-[13px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back
        </Link>
      </header>

      {/* Content */}
      <div className="max-w-md mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <h1 className="text-[18px] font-semibold text-[var(--text-primary)] mb-1">New Project</h1>
        <p className="text-[13px] text-[var(--text-tertiary)] mb-6 sm:mb-8">
          Deploy a FastAPI app to ephemeral sandboxes
        </p>

        {/* Error Banner */}
        {error && (
          <div className="mb-6 px-4 py-3 bg-[var(--error-subtle)] border border-[var(--error)]/20 rounded-lg flex items-start gap-3">
            <svg className="w-5 h-5 text-[var(--error)] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-[var(--error)]">Failed to create project</p>
              <p className="text-[12px] text-[var(--error)]/80 mt-0.5">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="p-1 text-[var(--error)] hover:bg-[var(--error)]/10 rounded"
              aria-label="Dismiss error"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {/* Project Name */}
          <div>
            <label htmlFor="project-name" className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
              Project name <span className="text-[var(--error)]">*</span>
            </label>
            <input
              id="project-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setTouched(t => ({ ...t, name: true }))}
              placeholder="my-api"
              maxLength={50}
              autoComplete="off"
              aria-invalid={touched.name && !!validationErrors.name}
              aria-describedby={touched.name && validationErrors.name ? 'name-error' : undefined}
              className={`w-full px-3 py-2 bg-[var(--bg-secondary)] border rounded-md text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-1 transition-colors ${
                touched.name && validationErrors.name
                  ? 'border-[var(--error)] focus:border-[var(--error)] focus:ring-[var(--error)]'
                  : 'border-[var(--border)] focus:border-[var(--accent)] focus:ring-[var(--accent)]'
              }`}
            />
            {touched.name && validationErrors.name && (
              <p id="name-error" className="mt-1.5 text-[11px] text-[var(--error)]">
                {validationErrors.name}
              </p>
            )}
          </div>

          {/* Source Type */}
          <div>
            <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
              Source <span className="text-[var(--error)]">*</span>
            </label>
            <div className="flex p-1 bg-[var(--bg-secondary)] rounded-md border border-[var(--border)]" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={sourceType === 'zip'}
                onClick={() => { setSourceType('zip'); setTouched(t => ({ ...t, source: false })); }}
                className={`flex-1 px-3 py-1.5 text-[13px] font-medium rounded transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                  sourceType === 'zip'
                    ? 'bg-[var(--bg-hover)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                }`}
              >
                ZIP Upload
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={sourceType === 'github'}
                onClick={() => { setSourceType('github'); setTouched(t => ({ ...t, source: false })); }}
                className={`flex-1 px-3 py-1.5 text-[13px] font-medium rounded transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                  sourceType === 'github'
                    ? 'bg-[var(--bg-hover)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                }`}
              >
                GitHub
              </button>
            </div>
          </div>

          {/* Source Input */}
          {sourceType === 'zip' ? (
            <div role="tabpanel">
              {selectedFile ? (
                <div className="flex items-center gap-3 px-3 py-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-md">
                  <div className="w-9 h-9 bg-[var(--bg-tertiary)] rounded-md flex items-center justify-center flex-shrink-0">
                    {isProcessingFile ? (
                      <svg className="w-4 h-4 text-[var(--accent)] animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-[var(--success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[var(--text-primary)] truncate">{selectedFile.name}</p>
                    <p className="text-[11px] text-[var(--text-tertiary)]">
                      {isProcessingFile ? 'Processing...' : `${(selectedFile.size / 1024).toFixed(1)} KB`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSelectedFile(null); setZipBase64(''); setIsProcessingFile(false); }}
                    disabled={isProcessingFile}
                    className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-md disabled:opacity-50 transition-colors"
                    aria-label="Remove file"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}
                  tabIndex={0}
                  role="button"
                  aria-label="Upload ZIP file"
                  className={`flex flex-col items-center justify-center py-8 sm:py-10 border-2 border-dashed rounded-md cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                    isDragging
                      ? 'border-[var(--accent)] bg-[var(--accent-subtle)]'
                      : touched.source && validationErrors.source
                      ? 'border-[var(--error)] hover:border-[var(--error)]'
                      : 'border-[var(--border)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-secondary)]'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".zip"
                    onChange={(e) => { if (e.target.files?.[0]) handleFileSelect(e.target.files[0]); e.target.value = ''; }}
                    className="hidden"
                    aria-hidden="true"
                  />
                  <svg className="w-8 h-8 text-[var(--text-tertiary)] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  <p className="text-[13px] text-[var(--text-secondary)] mb-1 text-center px-4">
                    Drop ZIP file here or <span className="text-[var(--accent)] font-medium">browse</span>
                  </p>
                  <p className="text-[11px] text-[var(--text-tertiary)]">Max 50MB</p>
                </div>
              )}
              {touched.source && validationErrors.source && sourceType === 'zip' && (
                <p className="mt-1.5 text-[11px] text-[var(--error)]">{validationErrors.source}</p>
              )}
            </div>
          ) : (
            <div className="space-y-4" role="tabpanel">
              <div>
                <label htmlFor="github-url" className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                  Repository URL <span className="text-[var(--error)]">*</span>
                </label>
                <input
                  id="github-url"
                  type="url"
                  value={githubUrl}
                  onChange={(e) => {
                    setGithubUrl(e.target.value);
                    if (!name && e.target.value) {
                      const match = e.target.value.match(/github\.com\/[\w-]+\/([\w.-]+)/);
                      if (match) setName(match[1].replace('.git', '').replace(/[^a-zA-Z0-9-_]/g, '-'));
                    }
                  }}
                  onBlur={() => setTouched(t => ({ ...t, source: true }))}
                  placeholder="https://github.com/owner/repo"
                  autoComplete="off"
                  aria-invalid={touched.source && !!validationErrors.source}
                  aria-describedby={touched.source && validationErrors.source ? 'github-error' : undefined}
                  className={`w-full px-3 py-2 bg-[var(--bg-secondary)] border rounded-md text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-1 transition-colors ${
                    touched.source && validationErrors.source
                      ? 'border-[var(--error)] focus:border-[var(--error)] focus:ring-[var(--error)]'
                      : 'border-[var(--border)] focus:border-[var(--accent)] focus:ring-[var(--accent)]'
                  }`}
                />
                {touched.source && validationErrors.source && sourceType === 'github' && (
                  <p id="github-error" className="mt-1.5 text-[11px] text-[var(--error)]">{validationErrors.source}</p>
                )}
              </div>
              <div>
                <label htmlFor="github-branch" className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                  Branch <span className="text-[var(--text-tertiary)] font-normal">(optional, defaults to main)</span>
                </label>
                <input
                  id="github-branch"
                  type="text"
                  value={githubBranch}
                  onChange={(e) => setGithubBranch(e.target.value)}
                  placeholder="main"
                  autoComplete="off"
                  className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-md text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-colors"
                />
              </div>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={!isValid || isSubmitting}
            className="w-full px-4 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:bg-[var(--bg-tertiary)] disabled:text-[var(--text-tertiary)] disabled:cursor-not-allowed text-white text-[13px] font-medium rounded-md transition-all flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]"
          >
            {isSubmitting ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Creating project...
              </>
            ) : (
              'Create Project'
            )}
          </button>
        </form>

        {/* Requirements */}
        <div className="mt-10 pt-6 border-t border-[var(--border-subtle)]">
          <h3 className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-tertiary)] mb-3">Requirements</h3>
          <ul className="space-y-2">
            {[
              { code: 'main.py', text: 'with FastAPI app' },
              { code: 'app', text: 'variable name' },
              { code: 'requirements.txt', text: 'for dependencies' },
            ].map((item, i) => (
              <li key={i} className="flex items-center gap-2 text-[12px] text-[var(--text-secondary)]">
                <svg className="w-3.5 h-3.5 text-[var(--success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                <code className="text-[var(--text-primary)] font-mono text-[11px] bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded">{item.code}</code>
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
