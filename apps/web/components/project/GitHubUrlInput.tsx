'use client';

/**
 * GitHub URL Input Component with validation
 */

import { useState, useCallback } from 'react';

interface GitHubUrlInputProps {
  url: string;
  branch: string;
  onUrlChange: (url: string) => void;
  onBranchChange: (branch: string) => void;
}

export function GitHubUrlInput({ url, branch, onUrlChange, onBranchChange }: GitHubUrlInputProps) {
  const [error, setError] = useState<string | null>(null);

  const validateUrl = useCallback((value: string) => {
    if (!value) {
      setError(null);
      return;
    }

    // Basic GitHub URL validation
    const githubPattern = /^https?:\/\/(www\.)?github\.com\/[\w-]+\/[\w.-]+\/?$/;
    if (!githubPattern.test(value)) {
      setError('Please enter a valid GitHub repository URL (e.g., https://github.com/owner/repo)');
    } else {
      setError(null);
    }
  }, []);

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    onUrlChange(value);
    validateUrl(value);
  };

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="github-url" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
          GitHub Repository URL
        </label>
        <input
          id="github-url"
          type="url"
          value={url}
          onChange={handleUrlChange}
          placeholder="https://github.com/owner/repo"
          className={`w-full px-4 py-2 border rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent ${
            error ? 'border-[var(--error)]' : 'border-[var(--border)]'
          }`}
        />
        {error && (
          <p className="mt-1 text-sm text-[var(--error)]">{error}</p>
        )}
      </div>

      <div>
        <label htmlFor="github-branch" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
          Branch (optional)
        </label>
        <input
          id="github-branch"
          type="text"
          value={branch}
          onChange={(e) => onBranchChange(e.target.value)}
          placeholder="main"
          className="w-full px-4 py-2 border border-[var(--border)] rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
        />
        <p className="mt-1 text-xs text-[var(--text-tertiary)]">
          Leave empty to use the default branch
        </p>
      </div>

      {url && !error && (
        <div className="flex items-center gap-2 text-sm text-[var(--success)]">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Valid GitHub URL
        </div>
      )}
    </div>
  );
}
