/**
 * Share Modal Component
 *
 * Allows users to create and manage share links for endpoints
 */

'use client';

import { useState, useEffect } from 'react';
import {
  useShareLinks,
  useCreateShareLink,
  useDisableShareLink,
} from '@/lib/hooks/useProject';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  selectedEndpointId: string | null;
  endpoints: Array<{
    endpoint_id: string;
    method: string;
    path: string;
    summary?: string;
  }>;
}

export function ShareModal({
  isOpen,
  onClose,
  projectId,
  selectedEndpointId,
  endpoints,
}: ShareModalProps) {
  const [shareType, setShareType] = useState<'endpoint_template'>('endpoint_template');
  const [endpointToShare, setEndpointToShare] = useState<string>(selectedEndpointId || '');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: sharesData, isLoading } = useShareLinks(projectId);
  const createShare = useCreateShareLink();
  const disableShare = useDisableShareLink();

  useEffect(() => {
    if (selectedEndpointId) {
      setEndpointToShare(selectedEndpointId);
    }
  }, [selectedEndpointId]);

  const handleCreate = async () => {
    if (!endpointToShare) return;

    try {
      await createShare.mutateAsync({
        projectId,
        target_type: shareType,
        target_ref: endpointToShare,
      });
    } catch (error) {
      console.error('Failed to create share link:', error);
    }
  };

  const handleDisable = async (shareId: string) => {
    try {
      await disableShare.mutateAsync({ projectId, shareId });
    } catch (error) {
      console.error('Failed to disable share link:', error);
    }
  };

  const copyToClipboard = async (url: string, shareId: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(shareId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      console.error('Failed to copy to clipboard');
    }
  };

  if (!isOpen) return null;

  const shares = sharesData?.shares || [];
  const activeShares = shares.filter((s) => s.enabled);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">
            Share App
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1">
          {/* Create new share link */}
          <div className="space-y-4">
            <div>
              <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-2">
                Create Share Link
              </label>
              <p className="text-[12px] text-[var(--text-tertiary)] mb-3">
                Create a public link that allows anyone to run this action without signing in.
              </p>
            </div>

            <div>
              <label className="block text-[12px] text-[var(--text-tertiary)] mb-1.5">
                Select Action
              </label>
              <select
                value={endpointToShare}
                onChange={(e) => setEndpointToShare(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              >
                <option value="">Select an action...</option>
                {endpoints.map((ep) => (
                  <option key={ep.endpoint_id} value={ep.endpoint_id}>
                    {ep.method} {ep.path} {ep.summary ? `- ${ep.summary}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleCreate}
              disabled={!endpointToShare || createShare.isPending}
              className="w-full px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:bg-[var(--bg-tertiary)] disabled:text-[var(--text-tertiary)] text-white text-[13px] font-medium rounded transition-colors"
            >
              {createShare.isPending ? 'Creating...' : 'Create Share Link'}
            </button>
          </div>

          {/* Existing share links */}
          {activeShares.length > 0 && (
            <div className="mt-6 pt-4 border-t border-[var(--border)]">
              <h3 className="text-[13px] font-medium text-[var(--text-secondary)] mb-3">
                Active Share Links ({activeShares.length})
              </h3>

              <div className="space-y-3">
                {activeShares.map((share) => {
                  const endpoint = endpoints.find(
                    (ep) => ep.endpoint_id === share.target_ref
                  );
                  return (
                    <div
                      key={share.share_id}
                      className="p-3 bg-[var(--bg-primary)] border border-[var(--border)] rounded"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-[12px] font-medium text-[var(--text-primary)] truncate">
                            {endpoint
                              ? `${endpoint.method} ${endpoint.path}`
                              : share.target_ref}
                          </p>
                          <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
                            {share.stats.run_count} runs • Created{' '}
                            {new Date(share.created_at).toLocaleDateString()}
                          </p>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => copyToClipboard(share.share_url, share.share_id)}
                            className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 rounded transition-colors"
                            title="Copy link"
                          >
                            {copiedId === share.share_id ? (
                              <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5A3.375 3.375 0 006.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0015 2.25h-1.5a2.251 2.251 0 00-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5H4.875c-.621 0-1.125.504-1.125 1.125v12c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V16.5a9 9 0 00-9-9z" />
                              </svg>
                            )}
                          </button>
                          <button
                            onClick={() => handleDisable(share.share_id)}
                            disabled={disableShare.isPending}
                            className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--error)] hover:bg-[var(--error)]/10 rounded transition-colors"
                            title="Disable link"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Share URL */}
                      <div className="mt-2 px-2 py-1.5 bg-[var(--bg-tertiary)] rounded text-[11px] font-mono text-[var(--text-tertiary)] truncate">
                        {share.share_url}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {isLoading && (
            <div className="mt-4 flex items-center justify-center py-4">
              <svg className="w-5 h-5 animate-spin text-[var(--accent)]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--border)] bg-[var(--bg-primary)]">
          <p className="text-[11px] text-[var(--text-tertiary)]">
            Share links allow up to 100 runs per hour. Anyone with the link can run it.
          </p>
        </div>
      </div>
    </div>
  );
}
