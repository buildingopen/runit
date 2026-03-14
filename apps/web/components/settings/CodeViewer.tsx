// ABOUTME: Displays deployed code from the project's ZIP bundle
// ABOUTME: Client-side extraction using fflate, file browser with syntax display

'use client';

import { Component, useState, useMemo, type ReactNode } from 'react';
import { unzipSync, strFromU8 } from 'fflate';

// Error boundary to catch unexpected fflate/rendering errors
class CodeViewerErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="text-center py-12 text-[var(--text-tertiary)]">
          <p className="text-[13px]">Could not read code bundle</p>
        </div>
      );
    }
    return this.props.children;
  }
}

interface CodeViewerProps {
  codeBundleBase64: string | undefined;
}

// Files/dirs to filter out
const IGNORED_PATTERNS = ['__pycache__/', '.pyc', '__MACOSX/'];

function shouldInclude(path: string): boolean {
  return !IGNORED_PATTERNS.some(p => path.includes(p));
}

export function CodeViewer(props: CodeViewerProps) {
  return (
    <CodeViewerErrorBoundary>
      <CodeViewerInner {...props} />
    </CodeViewerErrorBoundary>
  );
}

function CodeViewerInner({ codeBundleBase64 }: CodeViewerProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const files = useMemo(() => {
    if (!codeBundleBase64) return null;

    try {
      // Decode base64 to Uint8Array
      const binary = atob(codeBundleBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      // Unzip
      const unzipped = unzipSync(bytes);

      // Convert to file map, filtering out unwanted files
      const fileMap: Record<string, string> = {};
      for (const [path, data] of Object.entries(unzipped)) {
        // Skip directories (empty data) and filtered paths
        if (data.length === 0) continue;
        if (!shouldInclude(path)) continue;

        try {
          fileMap[path] = strFromU8(data);
        } catch {
          fileMap[path] = '[Binary file]';
        }
      }

      return fileMap;
    } catch {
      return null;
    }
  }, [codeBundleBase64]);

  if (!codeBundleBase64) {
    return (
      <div className="text-center py-12 text-[var(--text-tertiary)]">
        <p className="text-[13px]">No code available for this version</p>
      </div>
    );
  }

  if (!files) {
    return (
      <div className="text-center py-12 text-[var(--text-tertiary)]">
        <p className="text-[13px]">Could not read code bundle</p>
      </div>
    );
  }

  const sortedFiles = Object.keys(files).sort((a, b) => {
    // .py files first, then alphabetical
    const aIsPy = a.endsWith('.py');
    const bIsPy = b.endsWith('.py');
    if (aIsPy && !bIsPy) return -1;
    if (!aIsPy && bIsPy) return 1;
    return a.localeCompare(b);
  });

  // Default to first .py file or first file
  const activeFile = selectedFile && files[selectedFile] !== undefined
    ? selectedFile
    : sortedFiles[0] || null;

  const activeContent = activeFile ? files[activeFile] : null;
  const lines = activeContent?.split('\n') || [];

  return (
    <div className="flex border border-[var(--border)] rounded-lg overflow-hidden" style={{ minHeight: '400px' }}>
      {/* File list */}
      <div className="w-48 bg-[var(--bg-secondary)] border-r border-[var(--border)] overflow-y-auto flex-shrink-0">
        {sortedFiles.map((path) => (
          <button
            key={path}
            onClick={() => setSelectedFile(path)}
            className={`w-full text-left px-3 py-2 text-[12px] font-mono truncate transition-colors ${
              path === activeFile
                ? 'bg-[var(--bg-active)] text-[var(--text-primary)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
            }`}
            title={path}
          >
            {path}
          </button>
        ))}
      </div>

      {/* File content */}
      <div className="flex-1 overflow-auto bg-[var(--bg-primary)]">
        {activeContent !== null ? (
          <pre className="p-4 text-[12px] font-mono leading-5">
            {lines.map((line, i) => (
              <div key={i} className="flex hover:bg-[var(--bg-hover)]">
                <span className="text-[var(--text-tertiary)] select-none w-8 text-right pr-4 flex-shrink-0">
                  {i + 1}
                </span>
                <span className="text-[var(--text-primary)] whitespace-pre">{line}</span>
              </div>
            ))}
          </pre>
        ) : (
          <div className="h-full flex items-center justify-center text-[var(--text-tertiary)]">
            <p className="text-[13px]">Select a file</p>
          </div>
        )}
      </div>
    </div>
  );
}
