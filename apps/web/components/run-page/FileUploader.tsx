// ABOUTME: File upload component with drag-and-drop, base64 encoding, and image preview
// ABOUTME: Supports multiple files with size limits

'use client';

import { useState, useRef } from 'react';

interface FileUpload {
  field_name: string;
  filename: string;
  content_type: string;
  data: string; // base64
}

interface FileUploaderProps {
  onUpload: (files: FileUpload[]) => void;
  maxFiles?: number;
  maxSize?: number; // bytes
}

export function FileUploader({
  onUpload,
  maxFiles = 10,
  maxSize = 10 * 1024 * 1024, // 10MB default
}: FileUploaderProps) {
  const [files, setFiles] = useState<FileUpload[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (fileList: FileList) => {
    setError(null);

    if (fileList.length > maxFiles) {
      setError(`Maximum ${maxFiles} files allowed`);
      return;
    }

    const newFiles: FileUpload[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];

      if (file.size > maxSize) {
        setError(`File ${file.name} exceeds ${formatSize(maxSize)} limit`);
        continue;
      }

      try {
        const base64 = await fileToBase64(file);
        newFiles.push({
          field_name: file.name,
          filename: file.name,
          content_type: file.type || 'application/octet-stream',
          data: base64,
        });
      } catch (error) {
        setError(`Failed to read file: ${file.name}`);
      }
    }

    setFiles(newFiles);
    onUpload(newFiles);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
    onUpload(newFiles);
  };

  return (
    <div className="space-y-3">
      <div
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          border-2 border-dashed rounded p-4 text-center cursor-pointer transition-colors
          ${
            isDragging
              ? 'border-[var(--accent)] bg-[var(--accent)]/5'
              : 'border-[var(--border)] hover:border-[var(--border-hover)]'
          }
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple={maxFiles > 1}
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
          className="hidden"
        />

        <div className="flex flex-col items-center gap-2">
          <svg
            className="w-6 h-6 text-[var(--text-tertiary)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={1}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <div>
            <p className="text-xs text-[var(--text-secondary)]">
              Click to upload or drag and drop
            </p>
            <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
              Max {maxFiles} file{maxFiles > 1 ? 's' : ''}, up to {formatSize(maxSize)} each
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="px-3 py-2 bg-[var(--error)]/10 border border-[var(--error)]/20 rounded text-xs text-[var(--error)]">
          {error}
        </div>
      )}

      {files.length > 0 && (
        <div className="space-y-1">
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between px-3 py-2 bg-[var(--bg-tertiary)] rounded border border-[var(--border)]"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {file.content_type.startsWith('image/') && (
                  <img
                    src={`data:${file.content_type};base64,${file.data}`}
                    alt={file.filename}
                    className="w-8 h-8 object-cover rounded"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[var(--text-primary)] truncate">
                    {file.filename}
                  </p>
                  <p className="text-[10px] text-[var(--text-tertiary)]">
                    {formatSize(atob(file.data).length)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => removeFile(index)}
                className="flex-shrink-0 p-1 text-[var(--text-tertiary)] hover:text-[var(--error)] transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
