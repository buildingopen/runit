'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '../../../../lib/api/client';
import { getSupabaseBrowserClient } from '../../../../lib/supabase/client';
import { trackDeploySuccess } from '../../../../lib/analytics';

interface DeployEvent {
  type: 'status' | 'complete' | 'error';
  step: string;
  progress: number;
  message: string;
  error?: string;
}

const DEPLOY_STEPS = [
  { key: 'queued', label: 'In queue', icon: 'clock' },
  { key: 'installing_deps', label: 'Installing packages', icon: 'package' },
  { key: 'building', label: 'Setting up your app', icon: 'build' },
  { key: 'starting', label: 'Starting your app', icon: 'play' },
  { key: 'health_check', label: 'Final checks', icon: 'check' },
];

interface PageProps {
  params: Promise<{
    project_id: string;
  }>;
}

export default function DeployingPage({ params }: PageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const projectId = resolvedParams.project_id;

  const [currentStep, setCurrentStep] = useState('queued');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('Getting ready...');
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let mounted = true;

    async function connectToStream() {
      try {
        // First check current status
        const status = await apiClient.getDeployStatus(projectId);

        if (!mounted) return;

        if (status.status === 'live') {
          // Already deployed, redirect to success
          router.push(`/p/${projectId}/success`);
          return;
        }

        if (status.status === 'failed') {
          setError(status.deploy_error || status.error || 'Something went wrong');
          return;
        }

        if (status.status !== 'deploying') {
          // Not deploying, redirect to configure
          router.push(`/create/configure?project=${projectId}`);
          return;
        }

        // Connect to SSE stream (pass token via query param since EventSource can't send headers)
        const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';
        let streamUrl = `${API_BASE_URL}/v1/projects/${projectId}/deploy/stream`;
        try {
          const supabase = getSupabaseBrowserClient();
          const sessionResult = await supabase?.auth.getSession();
          const token = sessionResult?.data?.session?.access_token;
          if (token) {
            streamUrl += `?token=${encodeURIComponent(token)}`;
          }
        } catch { /* proceed without token */ }
        eventSource = new EventSource(streamUrl);

        eventSource.addEventListener('status', (e) => {
          if (!mounted) return;
          try {
            const data: DeployEvent = JSON.parse(e.data);
            setCurrentStep(data.step);
            setProgress(data.progress);
            setMessage(data.message);
          } catch { /* ignore malformed SSE data */ }
        });

        eventSource.addEventListener('complete', () => {
          if (!mounted) return;
          trackDeploySuccess(projectId);
          setIsComplete(true);
          setProgress(100);
          setMessage('Your app is live!');
          eventSource?.close();
          // Redirect to success page
          setTimeout(() => {
            router.push(`/p/${projectId}/success`);
          }, 500);
        });

        eventSource.addEventListener('error', (e) => {
          if (!mounted) return;
          try {
            const data: DeployEvent = JSON.parse((e as MessageEvent).data);
            setError(data.error || 'Something went wrong');
          } catch {
            setError('Something went wrong');
          }
          eventSource?.close();
        });

        eventSource.onerror = () => {
          if (!mounted) return;
          // Connection error - try to reconnect or check status
          eventSource?.close();
          setTimeout(() => {
            if (mounted) {
              connectToStream();
            }
          }, 2000);
        };
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Failed to connect');
      }
    }

    connectToStream();

    return () => {
      mounted = false;
      eventSource?.close();
    };
  }, [projectId, router]);

  const handleRetry = async () => {
    setIsRetrying(true);
    setError(null);

    try {
      await apiClient.redeploy(projectId);
      // Reload to reconnect to stream
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retry');
      setIsRetrying(false);
    }
  };

  const getStepStatus = (stepKey: string) => {
    const stepOrder = DEPLOY_STEPS.map((s) => s.key);
    const currentIndex = stepOrder.indexOf(currentStep);
    const stepIndex = stepOrder.indexOf(stepKey);

    if (error) {
      if (stepIndex <= currentIndex) return 'error';
      return 'pending';
    }
    if (isComplete) return 'complete';
    if (stepIndex < currentIndex) return 'complete';
    if (stepIndex === currentIndex) return 'active';
    return 'pending';
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col">
      {/* Header */}
      <header className="h-12 border-b border-[var(--border-subtle)] flex items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className="text-[13px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
          >
            Apps
          </Link>
          <svg className="w-3 h-3 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-[13px] font-medium text-[var(--text-primary)]">Going live</span>
        </div>
        <span className="px-2 py-0.5 text-[10px] font-medium bg-[var(--accent)]/15 text-[var(--accent)] rounded">
          Step 3 of 3
        </span>
      </header>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Progress Circle */}
          <div className="flex justify-center mb-8">
            <div className="relative w-32 h-32">
              {/* Background circle */}
              <svg className="w-32 h-32 transform -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  className="text-[var(--bg-tertiary)]"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 56}`}
                  strokeDashoffset={`${2 * Math.PI * 56 * (1 - progress / 100)}`}
                  strokeLinecap="round"
                  className={`transition-all duration-500 ${
                    error ? 'text-[var(--error)]' : 'text-[var(--accent)]'
                  }`}
                />
              </svg>
              {/* Center content */}
              <div className="absolute inset-0 flex items-center justify-center">
                {error ? (
                  <svg className="w-12 h-12 text-[var(--error)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                ) : isComplete ? (
                  <svg className="w-12 h-12 text-[var(--success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : (
                  <span className="text-2xl font-semibold text-[var(--text-primary)]">{progress}%</span>
                )}
              </div>
            </div>
          </div>

          {/* Status Message */}
          <div className="text-center mb-8">
            <h2 className={`text-[16px] font-semibold mb-1 ${
              error ? 'text-[var(--error)]' : 'text-[var(--text-primary)]'
            }`}>
              {error ? 'Something went wrong' : isComplete ? 'Your app is live!' : message}
            </h2>
            {error && (
              <p className="text-[13px] text-[var(--text-tertiary)]">{error}</p>
            )}
          </div>

          {/* Steps List */}
          <div className="space-y-3 mb-8">
            {DEPLOY_STEPS.map((step) => {
              const status = getStepStatus(step.key);
              return (
                <div
                  key={step.key}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
                    status === 'active'
                      ? 'bg-[var(--accent)]/10'
                      : status === 'error'
                      ? 'bg-[var(--error)]/5'
                      : 'bg-transparent'
                  }`}
                >
                  {/* Step indicator */}
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                    status === 'complete'
                      ? 'bg-[var(--success)]'
                      : status === 'active'
                      ? 'bg-[var(--accent)]'
                      : status === 'error'
                      ? 'bg-[var(--error)]'
                      : 'bg-[var(--bg-tertiary)]'
                  }`}>
                    {status === 'complete' ? (
                      <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    ) : status === 'active' ? (
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    ) : status === 'error' ? (
                      <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    ) : (
                      <div className="w-2 h-2 bg-[var(--text-tertiary)] rounded-full" />
                    )}
                  </div>
                  <span className={`text-[13px] ${
                    status === 'active'
                      ? 'text-[var(--text-primary)] font-medium'
                      : status === 'complete'
                      ? 'text-[var(--text-secondary)]'
                      : status === 'error'
                      ? 'text-[var(--error)]'
                      : 'text-[var(--text-tertiary)]'
                  }`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Error Actions */}
          {error && (
            <div className="flex gap-3">
              <button
                onClick={handleRetry}
                disabled={isRetrying}
                className="flex-1 px-4 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white text-[13px] font-medium rounded-md transition-colors flex items-center justify-center gap-2"
              >
                {isRetrying ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Retrying...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                    Try Again
                  </>
                )}
              </button>
              <Link
                href={`/create/configure?project=${projectId}`}
                className="px-4 py-2.5 bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] border border-[var(--border)] text-[var(--text-secondary)] text-[13px] font-medium rounded-md transition-colors"
              >
                Back to Configure
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
