'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { zipSync, strToU8 } from 'fflate';
import { apiClient } from '../../lib/api/client';
import { trackProjectCreated } from '../../lib/analytics';

const isValidGithubUrl = (url: string): boolean => {
  return /^https?:\/\/github\.com\/[\w.-]+\/[\w.-]+/.test(url);
};

/**
 * Extract clean Python code from a ChatGPT-style paste that may contain
 * markdown, explanations, and triple-backtick code blocks.
 */
function extractPythonFromPaste(raw: string): string {
  // Match ```python ... ``` or ``` ... ``` code blocks
  const codeBlockRegex = /```(?:python|py)?\s*\n([\s\S]*?)```/g;
  const blocks: string[] = [];
  let match;
  while ((match = codeBlockRegex.exec(raw)) !== null) {
    const block = match[1].trim();
    if (block) blocks.push(block);
  }

  if (blocks.length > 0) {
    return blocks.join('\n\n').trim();
  }

  // No code blocks found, use the raw input as-is
  return raw.trim();
}

export default function NewProjectPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittingStep, setSubmittingStep] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [apiReady, setApiReady] = useState<'checking' | 'ready' | 'offline'>('checking');

  // GitHub state
  const [githubUrl, setGithubUrl] = useState('');

  // ZIP state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [zipBase64, setZipBase64] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Paste code state
  const [pastedCode, setPastedCode] = useState('');

  const refreshApiStatus = useCallback(async () => {
    setApiReady('checking');
    try {
      await apiClient.health();
      setApiReady('ready');
    } catch {
      setApiReady('offline');
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const runCheck = async () => {
      try {
        await apiClient.health();
        if (mounted) setApiReady('ready');
      } catch {
        if (mounted) setApiReady('offline');
      }
    };
    runCheck();
    return () => {
      mounted = false;
    };
  }, []);

  const handleFileSelect = async (file: File) => {
    const isPy = file.name.endsWith('.py');
    const isZip = file.name.endsWith('.zip');
    if (!isPy && !isZip) {
      setError('Please select a .py or .zip file');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setError('File size must be less than 50MB');
      return;
    }
    if (file.size < 10) {
      setError('File appears to be empty or corrupted');
      return;
    }

    setSelectedFile(file);
    setError(null);
    setIsProcessingFile(true);

    if (isPy) {
      // Auto-wrap .py file into a zip
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const content = reader.result as string;
          const zipped = zipSync({ [file.name]: strToU8(content) });
          const base64 = btoa(String.fromCharCode(...zipped));
          setZipBase64(base64);
          setIsProcessingFile(false);
        } catch {
          setError('Failed to process file');
          setSelectedFile(null);
          setIsProcessingFile(false);
        }
      };
      reader.onerror = () => {
        setError('Failed to read file');
        setSelectedFile(null);
        setIsProcessingFile(false);
      };
      reader.readAsText(file);
    } else {
      // ZIP file: read as data URL
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
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  // Derive project name from GitHub URL or file name
  const deriveProjectName = (sourceType: 'github' | 'zip'): string => {
    if (sourceType === 'github' && githubUrl) {
      const match = githubUrl.match(/github\.com\/[\w-]+\/([\w.-]+)/);
      if (match) return match[1].replace('.git', '').replace(/[^a-zA-Z0-9-_]/g, '-');
    }
    if (sourceType === 'zip' && selectedFile) {
      return selectedFile.name.replace(/\.(zip|py)$/, '').replace(/[^a-zA-Z0-9-_]/g, '-');
    }
    return 'my-app';
  };

  const handleGithubConnect = async () => {
    if (!githubUrl.trim()) {
      setError('Please enter a GitHub URL');
      return;
    }

    // Auto-prepend https:// if missing
    let fullUrl = githubUrl.trim();
    if (fullUrl.startsWith('github.com/')) {
      fullUrl = `https://${fullUrl}`;
    }

    if (!isValidGithubUrl(fullUrl)) {
      setError('Please enter a valid GitHub URL (e.g., github.com/user/repo)');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSubmittingStep('Connecting to GitHub...');

    const steps = [
      { delay: 2000, text: 'Cloning repository...' },
      { delay: 8000, text: 'Extracting and analyzing code...' },
      { delay: 15000, text: 'Analyzing your code...' },
      { delay: 25000, text: 'Still working... large repos may take a minute' },
    ];
    steps.forEach(({ delay, text }) => {
      setTimeout(() => setSubmittingStep(text), delay);
    });

    try {
      const name = deriveProjectName('github');
      const response = await apiClient.createProject({
        name,
        source_type: 'github',
        github_url: fullUrl,
      });
      if (response.endpoints.length === 0) {
        setError(
          'No actions found in this repository. Make sure it has a Python file with functions (e.g., main.py with at least one function).'
        );
        setIsSubmitting(false);
        setSubmittingStep('');
        return;
      }

      trackProjectCreated(response.project_id, 'github');
      setSubmittingStep('Redirecting...');
      router.push(`/create/configure?project=${response.project_id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect';
      if (message.includes('timeout')) {
        setError('Repository took too long to process. It may be too large or the server is busy. Please try again.');
      } else {
        setError(message);
      }
      setIsSubmitting(false);
      setSubmittingStep('');
    }
  };

  const handleZipUpload = async () => {
    if (!zipBase64 || isProcessingFile) return;

    setIsSubmitting(true);
    setError(null);
    setSubmittingStep('Uploading and processing...');

    setTimeout(() => setSubmittingStep('Analyzing your code...'), 2000);

    try {
      const name = deriveProjectName('zip');
      const response = await apiClient.createProject({
        name,
        source_type: 'zip',
        zip_data: zipBase64,
      });
      if (response.endpoints.length === 0) {
        setError(
          'No actions found in this upload. Make sure it has a Python file with functions (e.g., main.py with at least one function).'
        );
        setIsSubmitting(false);
        setSubmittingStep('');
        return;
      }

      trackProjectCreated(response.project_id, 'zip');
      setSubmittingStep('Redirecting...');
      router.push(`/create/configure?project=${response.project_id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create app';
      if (message.includes('timeout')) {
        setError('Upload took too long to process. It may be too large or the server is busy. Please try again.');
      } else {
        setError(message);
      }
      setIsSubmitting(false);
      setSubmittingStep('');
    }
  };

  const handlePasteSubmit = async () => {
    const code = extractPythonFromPaste(pastedCode);
    if (!code) {
      setError('Please paste some Python code');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSubmittingStep('Packaging your code...');

    try {
      // Wrap in a function if the code has no function definitions
      const hasFunctions = /^def\s+\w+/m.test(code);
      let mainPy: string;
      if (hasFunctions) {
        mainPy = code;
      } else {
        const indented = code
          .split('\n')
          .map((line) => (line.trim() === '' ? '' : `    ${line}`))
          .join('\n');
        mainPy = `def run():\n${indented}\n`;
      }

      // Create ZIP in-memory
      const zipped = zipSync({ 'main.py': strToU8(mainPy) });
      const base64 = btoa(String.fromCharCode(...zipped));

      setSubmittingStep('Analyzing your code...');

      const response = await apiClient.createProject({
        name: 'pasted-app',
        source_type: 'zip',
        zip_data: base64,
      });

      if (response.endpoints.length === 0) {
        setError(
          'No actions found in your code. Make sure it contains at least one function definition (def my_function():).'
        );
        setIsSubmitting(false);
        setSubmittingStep('');
        return;
      }

      trackProjectCreated(response.project_id, 'paste');
      setSubmittingStep('Redirecting...');
      router.push(`/create/configure?project=${response.project_id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create app';
      setError(message);
      setIsSubmitting(false);
      setSubmittingStep('');
    }
  };

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
          <h1 className="text-[24px] font-bold text-[var(--text-primary)] mb-1.5">Create an app</h1>
          <p className="text-[14px] text-[var(--text-secondary)]">Import your code</p>
        </div>

        {/* First-run guide */}
        <div className="mb-6 px-4 py-4 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl">
          <div className="text-[13px] font-semibold text-[var(--text-primary)] mb-2">First run checklist</div>
          <ol className="text-[12px] text-[var(--text-secondary)] space-y-1.5 list-decimal pl-4">
            <li>Paste Python, connect GitHub, upload a ZIP, or start from a template.</li>
            <li>Click <span className="font-semibold">Go Live</span> on the next screen.</li>
            <li>Run your action and share the link.</li>
          </ol>
          <div className="mt-3 text-[11px] text-[var(--text-tertiary)]">
            Local defaults: web on `3000`, API on `3001`.
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="text-[12px] text-[var(--text-tertiary)]">
              API status:{' '}
              <span className={`font-medium ${
                apiReady === 'ready'
                  ? 'text-[var(--success)]'
                  : apiReady === 'offline'
                  ? 'text-[var(--error)]'
                  : 'text-[var(--text-secondary)]'
              }`}>
                {apiReady === 'ready' ? 'Connected' : apiReady === 'offline' ? 'Disconnected' : 'Checking...'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => void refreshApiStatus()}
                className="text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                Retry API check
              </button>
              <Link
                href="https://github.com/buildingopen/runit/blob/main/docs/LAUNCH_FIRST_APP.md"
                target="_blank"
                rel="noreferrer"
                className="text-[12px] text-[var(--accent)] hover:underline"
              >
                First app guide
              </Link>
            </div>
          </div>
          {apiReady === 'offline' && (
            <div className="mt-3 px-3 py-2 rounded-lg bg-[var(--error-subtle)] border border-[var(--error)]/20 text-[11px] text-[var(--error)]">
              Can&apos;t reach the API. Fastest fix: run `npm run setup:local`, then either
              `docker-compose up --build` or `cd services/control-plane && npm run dev`, and keep
              `NEXT_PUBLIC_API_URL=http://localhost:3001`.
            </div>
          )}
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-6 px-4 py-3 bg-[var(--error-subtle)] border border-[var(--error)]/20 rounded-xl flex items-start gap-3">
            <div className="w-8 h-8 bg-[var(--error)] rounded-full flex items-center justify-center flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <p className="text-[14px] font-semibold text-[var(--error)]">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Loading State */}
        {isSubmitting ? (
          <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-10 text-center">
            <div className="w-8 h-8 border-[3px] border-[var(--border)] border-t-[var(--accent)] rounded-full animate-spin mx-auto mb-4" />
            <div className="text-[14px] text-[var(--text-secondary)]">{submittingStep}</div>
            <div className="text-[12px] text-[var(--text-tertiary)] mt-1">Scanning your code</div>
          </div>
        ) : (
          <>
            {/* GitHub Section (Primary) */}
            <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-6">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-10 h-10 bg-[var(--bg-tertiary)] rounded-[10px] flex items-center justify-center text-[var(--text-primary)]">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                </div>
                <div>
                  <div className="text-[15px] font-semibold text-[var(--text-primary)]">Connect GitHub repo</div>
                  <div className="text-[13px] text-[var(--text-secondary)]">We&apos;ll detect functions and requirements</div>
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleGithubConnect()}
                  placeholder="github.com/user/repo"
                  autoComplete="off"
                  className="flex-1 py-3.5 px-4 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                />
                <button
                  onClick={handleGithubConnect}
                  className="px-6 py-3.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--bg-primary)] text-[14px] font-semibold rounded-lg transition-colors"
                >
                  Connect
                </button>
              </div>
            </div>

            {/* Or Divider */}
            <div className="text-center text-[12px] text-[var(--text-tertiary)] my-4">or</div>

            {/* ZIP Upload Section (Secondary) */}
            {selectedFile ? (
              <div className="flex items-center gap-3 px-4 py-3.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg">
                <div className="w-8 h-8 bg-[var(--bg-tertiary)] rounded-md flex items-center justify-center flex-shrink-0">
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
                  className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] rounded-md disabled:opacity-50"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <button
                  onClick={handleZipUpload}
                  disabled={!zipBase64 || isProcessingFile}
                  className="px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-[13px] font-semibold rounded-lg disabled:opacity-50 transition-colors"
                >
                  Upload
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
                aria-label="Upload .py or .zip file"
                className={`flex items-center gap-3 px-4 py-3.5 border border-dashed rounded-lg cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                  isDragging
                    ? 'border-[var(--accent)] bg-[var(--accent)]/5'
                    : 'border-[var(--border)] hover:border-[var(--text-tertiary)] hover:bg-[var(--accent)]/5'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip,.py"
                  onChange={(e) => { if (e.target.files?.[0]) handleFileSelect(e.target.files[0]); e.target.value = ''; }}
                  className="hidden"
                  aria-hidden="true"
                />
                <div className="w-8 h-8 bg-[var(--bg-tertiary)] rounded-md flex items-center justify-center flex-shrink-0 text-[var(--text-tertiary)]">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                  </svg>
                </div>
                <span className="text-[13px] text-[var(--text-secondary)]">Drop a .py file or .zip</span>
              </div>
            )}
            {/* Or Divider */}
            <div className="text-center text-[12px] text-[var(--text-tertiary)] my-4">or</div>

            {/* Paste Code Section */}
            <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-6">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-10 h-10 bg-[var(--bg-tertiary)] rounded-[10px] flex items-center justify-center text-[var(--text-primary)]">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                  </svg>
                </div>
                <div>
                  <div className="text-[15px] font-semibold text-[var(--text-primary)]">Paste from ChatGPT</div>
                  <div className="text-[13px] text-[var(--text-secondary)]">Paste AI-generated code, we&apos;ll turn it into an app</div>
                </div>
              </div>
              <textarea
                value={pastedCode}
                onChange={(e) => setPastedCode(e.target.value)}
                placeholder={'def generate_invoice(client: str, amount: float):\n    return {"invoice_id": "INV-001", "client": client, "total": amount}'}
                rows={6}
                className="w-full py-3 px-4 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg text-[13px] text-[var(--text-primary)] font-mono placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] transition-colors resize-none"
              />
              <p className="text-[11px] text-[var(--text-tertiary)] mt-1.5">Paste your Python code. It needs at least one function.</p>
              <button
                onClick={handlePasteSubmit}
                disabled={!pastedCode.trim()}
                className="mt-3 w-full py-3 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--bg-primary)] text-[14px] font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                Create app
              </button>
            </div>
          </>
        )}

        {/* Templates Section */}
        {!isSubmitting && (
          <>
            <div className="text-center text-[12px] text-[var(--text-tertiary)] my-4">or start from a template</div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'pdf-text-extractor', name: 'PDF Extractor', desc: 'Extract text from PDFs', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
                { id: 'ai-chatbot', name: 'AI Chatbot', desc: 'Chat with Gemini AI', icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z' },
                { id: 'web-scraper', name: 'Web Scraper', desc: 'Scrape any web page', icon: 'M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9' },
              ].map((t) => (
                <Link
                  key={t.id}
                  href={`/templates`}
                  className="p-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg hover:border-[var(--accent)] transition-colors text-center"
                >
                  <div className="w-8 h-8 bg-[var(--bg-tertiary)] rounded-md flex items-center justify-center mx-auto mb-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--text-secondary)]">
                      <path strokeLinecap="round" strokeLinejoin="round" d={t.icon} />
                    </svg>
                  </div>
                  <div className="text-[12px] font-medium text-[var(--text-primary)]">{t.name}</div>
                  <div className="text-[11px] text-[var(--text-tertiary)]">{t.desc}</div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
