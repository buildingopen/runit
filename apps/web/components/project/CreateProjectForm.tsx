'use client';

/**
 * Create Project Form with tabbed ZIP/GitHub interface
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ZipUploader } from './ZipUploader';
import { GitHubUrlInput } from './GitHubUrlInput';
import { LoadingSpinner } from '../ui/loading-spinner';
import { apiClient } from '../../lib/api/client';

type SourceType = 'zip' | 'github';

export function CreateProjectForm() {
  const router = useRouter();
  const [sourceType, setSourceType] = useState<SourceType>('zip');
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ZIP state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [zipBase64, setZipBase64] = useState<string>('');

  // GitHub state
  const [githubUrl, setGithubUrl] = useState('');
  const [githubBranch, setGithubBranch] = useState('');

  const handleFileSelect = (file: File, base64: string) => {
    setSelectedFile(file);
    setZipBase64(base64);
    // Auto-set name from filename if empty
    if (!name) {
      const fileName = file.name.replace('.zip', '');
      setName(fileName);
    }
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setZipBase64('');
  };

  const handleGithubUrlChange = (url: string) => {
    setGithubUrl(url);
    // Auto-set name from repo name if empty
    if (!name && url) {
      const match = url.match(/github\.com\/[\w-]+\/([\w.-]+)/);
      if (match) {
        setName(match[1].replace('.git', ''));
      }
    }
  };

  const isValid = () => {
    if (!name.trim()) return false;
    if (sourceType === 'zip' && !zipBase64) return false;
    if (sourceType === 'github' && !githubUrl) return false;
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await apiClient.createProject({
        name: name.trim(),
        source_type: sourceType,
        ...(sourceType === 'zip' && { zip_data: zipBase64 }),
        ...(sourceType === 'github' && {
          github_url: githubUrl,
          ...(githubBranch && { github_ref: githubBranch }),
        }),
      });

      // Navigate to the project page
      router.push(`/p/${response.project_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Project Name */}
      <div>
        <label htmlFor="project-name" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
          Project Name
        </label>
        <input
          id="project-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="my-fastapi-app"
          className="w-full px-4 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
          required
        />
      </div>

      {/* Source Type Tabs */}
      <div>
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
          Source
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSourceType('zip')}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              sourceType === 'zip'
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
              ZIP Upload
            </span>
          </button>
          <button
            type="button"
            onClick={() => setSourceType('github')}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              sourceType === 'github'
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
              GitHub URL
            </span>
          </button>
        </div>
      </div>

      {/* Source Input */}
      <div className="border border-[var(--border)] rounded-lg p-4">
        {sourceType === 'zip' ? (
          <ZipUploader
            selectedFile={selectedFile}
            onFileSelect={handleFileSelect}
            onClear={handleClearFile}
          />
        ) : (
          <GitHubUrlInput
            url={githubUrl}
            branch={githubBranch}
            onUrlChange={handleGithubUrlChange}
            onBranchChange={setGithubBranch}
          />
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-[var(--error-subtle)] border border-[var(--error)]/20 rounded-lg">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-[var(--error)] mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div>
              <h3 className="text-sm font-medium text-[var(--error)]">Error</h3>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={!isValid() || isSubmitting}
        className="w-full px-4 py-3 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isSubmitting ? (
          <>
            <LoadingSpinner size="sm" className="border-white border-t-transparent" />
            Creating Project...
          </>
        ) : (
          'Create Project'
        )}
      </button>
    </form>
  );
}
