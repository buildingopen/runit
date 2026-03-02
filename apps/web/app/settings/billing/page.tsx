'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiClient } from '../../../lib/api/client';

interface BillingData {
  tier: string;
  status: string;
  current_period_end: string | null;
  usage: { cpu_runs: number; gpu_runs: number; projects_count: number };
  limits: {
    cpuRunsPerHour: number;
    gpuRunsPerHour: number;
    maxProjects: number;
    maxSecretsPerProject: number;
    maxFileSizeMB: number;
  };
}

const PLANS = [
  { tier: 'free', name: 'Free', price: '$0', features: ['50 CPU runs/hr', '5 GPU runs/hr', '3 projects', '10 MB uploads'] },
  { tier: 'pro', name: 'Pro', price: '$19/mo', features: ['500 CPU runs/hr', '50 GPU runs/hr', '25 projects', '50 MB uploads'] },
  { tier: 'team', name: 'Team', price: '$49/mo', features: ['2,000 CPU runs/hr', '200 GPU runs/hr', '100 projects', '100 MB uploads'] },
];

export default function BillingPage() {
  const [billing, setBilling] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState<string | null>(null);

  useEffect(() => {
    apiClient.getBillingSubscription()
      .then(setBilling)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load billing info'))
      .finally(() => setLoading(false));
  }, []);

  const handleUpgrade = async (tier: 'pro' | 'team') => {
    setUpgrading(tier);
    try {
      const { url } = await apiClient.createCheckoutSession(tier);
      if (url) window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start checkout');
      setUpgrading(null);
    }
  };

  const handleManage = async () => {
    try {
      const { url } = await apiClient.createPortalSession();
      if (url) window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open billing portal');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[var(--border)] border-t-[var(--accent)] rounded-full animate-spin" />
      </div>
    );
  }

  const currentTier = billing?.tier || 'free';

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

        <h1 className="text-[24px] font-bold text-[var(--text-primary)] mb-2">Billing</h1>
        <p className="text-[14px] text-[var(--text-secondary)] mb-8">
          Manage your subscription and usage
        </p>

        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-4 bg-[var(--error)]/10 border border-[var(--error)]/30 rounded-lg flex items-center justify-between">
            <span className="text-[13px] text-[var(--error)]">{error}</span>
            <button onClick={() => setError(null)} className="text-[var(--error)] hover:opacity-70 text-[18px] leading-none">&times;</button>
          </div>
        )}

        {/* Current Usage */}
        {billing && (
          <div className="mb-8 p-5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl">
            <h2 className="text-[14px] font-semibold text-[var(--text-primary)] mb-4">Current Usage</h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wider mb-1">CPU Runs (this month)</div>
                <div className="text-[20px] font-semibold text-[var(--text-primary)]">{billing.usage.cpu_runs}</div>
              </div>
              <div>
                <div className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wider mb-1">GPU Runs (this month)</div>
                <div className="text-[20px] font-semibold text-[var(--text-primary)]">{billing.usage.gpu_runs}</div>
              </div>
              <div>
                <div className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Projects</div>
                <div className="text-[20px] font-semibold text-[var(--text-primary)]">{billing.usage.projects_count}</div>
              </div>
            </div>
          </div>
        )}

        {/* Plans */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {PLANS.map((plan) => {
            const isCurrent = plan.tier === currentTier;
            return (
              <div
                key={plan.tier}
                className={`p-5 rounded-xl border ${
                  isCurrent
                    ? 'border-[var(--accent)] bg-[var(--accent)]/5'
                    : 'border-[var(--border)] bg-[var(--bg-secondary)]'
                }`}
              >
                <div className="text-[15px] font-semibold text-[var(--text-primary)] mb-1">{plan.name}</div>
                <div className="text-[20px] font-bold text-[var(--text-primary)] mb-4">{plan.price}</div>
                <ul className="space-y-2 mb-5">
                  {plan.features.map((f) => (
                    <li key={f} className="text-[13px] text-[var(--text-secondary)] flex items-center gap-2">
                      <svg className="w-3.5 h-3.5 text-[var(--success)] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  <div className="text-center text-[13px] text-[var(--accent)] font-medium py-2">
                    Current plan
                  </div>
                ) : plan.tier === 'free' ? (
                  <div />
                ) : (
                  <button
                    onClick={() => handleUpgrade(plan.tier as 'pro' | 'team')}
                    disabled={upgrading !== null}
                    className="w-full py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-[13px] font-medium rounded-lg disabled:opacity-50 transition-colors"
                  >
                    {upgrading === plan.tier ? 'Redirecting...' : 'Upgrade'}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Manage Billing */}
        {currentTier !== 'free' && (
          <button
            onClick={handleManage}
            className="text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors underline"
          >
            Manage subscription in Stripe
          </button>
        )}
      </div>
    </div>
  );
}
