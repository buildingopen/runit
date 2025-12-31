// ABOUTME: Share Link Handler - Redirects to appropriate page based on share link type
// ABOUTME: Handles endpoint templates (→ Run Page) and run results (→ Result View)

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api/client';

interface PageProps {
  params: {
    share_id: string;
  };
}

export default function ShareLinkPage({ params }: PageProps) {
  const shareId = params.share_id;
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function handleShareLink() {
      try {
        // Fetch share link data
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/share/${shareId}`);

        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: response.statusText }));
          throw new Error(error.error || 'Failed to load share link');
        }

        const data = await response.json();

        // Redirect based on target type
        if (data.target_type === 'endpoint_template') {
          // Redirect to project endpoint page
          router.push(`/p/${data.project.project_id}?endpoint=${data.target_ref}`);
        } else if (data.target_type === 'run_result') {
          // Redirect to run result page
          router.push(`/r/${data.target_ref}`);
        } else {
          throw new Error('Invalid share link type');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load share link');
      }
    }

    handleShareLink();
  }, [shareId, router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-6">
        <div className="max-w-md text-center">
          <div className="bg-white rounded-xl border border-red-200 p-8">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Share link not available
            </h2>
            <p className="text-gray-600">{error}</p>
            {error.includes('disabled') && (
              <p className="mt-4 text-sm text-gray-500">
                This link has been disabled by the owner.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-4 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
        <p className="text-sm text-gray-500">Loading share link...</p>
      </div>
    </div>
  );
}
