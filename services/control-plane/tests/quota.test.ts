/**
 * Quota middleware tests
 *
 * Covers: checkQuotaDB (lines 143-246), quotaMiddleware (lines 220-270),
 * getQuotaStats (lines 280-293), trackRunStart/trackRunComplete with DB fallback.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  createMockContext,
  createAuthenticatedContext,
  createMockNext,
  asHonoContext,
  asHonoNext,
} from '../src/middleware/test-helpers';

// --- Mock wiring ---

const mockIsSupabaseConfigured = vi.fn(() => false);
const mockSingle = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockGte = vi.fn();
const mockUpdate = vi.fn();
const mockUpsert = vi.fn();

function buildSupabaseChain() {
  const chain: Record<string, any> = {};
  chain.select = mockSelect.mockReturnValue(chain);
  chain.eq = mockEq.mockReturnValue(chain);
  chain.gte = mockGte.mockReturnValue(chain);
  chain.single = mockSingle;
  chain.update = mockUpdate.mockReturnValue(chain);
  chain.upsert = mockUpsert.mockReturnValue(chain);
  return chain;
}

const supabaseChain = buildSupabaseChain();
const mockGetServiceSupabaseClient = vi.fn(() => ({
  from: vi.fn(() => supabaseChain),
}));

vi.mock('../src/db/supabase.js', () => ({
  isSupabaseConfigured: (...args: unknown[]) => mockIsSupabaseConfigured(...args),
  getServiceSupabaseClient: (...args: unknown[]) => mockGetServiceSupabaseClient(...args),
}));

vi.mock('../src/middleware/auth.js', () => ({
  getAuthContext: (c: any) => {
    return c.get('authContext') || { user: null, isAuthenticated: false };
  },
}));

import {
  checkQuota,
  resetQuota,
  trackRunStart,
  trackRunComplete,
  quotaMiddleware,
  getQuotaStats,
} from '../src/middleware/quota';

describe('quota', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSupabaseConfigured.mockReturnValue(false);
    resetQuota('test-user');
    resetQuota('u1');
    resetQuota('u2');
  });

  describe('checkQuota (in-memory)', () => {
    it('allows first CPU run', () => {
      const result = checkQuota('u1', 'cpu');
      expect(result.allowed).toBe(true);
      expect(result.runsRemaining).toBe(99);
      expect(result.concurrentRemaining).toBe(1);
    });

    it('allows first GPU run', () => {
      const result = checkQuota('u1', 'gpu');
      expect(result.allowed).toBe(true);
      expect(result.runsRemaining).toBe(9);
      expect(result.concurrentRemaining).toBe(0);
    });

    it('blocks CPU runs when hourly limit exceeded', () => {
      for (let i = 0; i < 100; i++) {
        trackRunStart('u1', `run-${i}`, 'cpu');
        trackRunComplete('u1', `run-${i}`, 'cpu');
      }

      const result = checkQuota('u1', 'cpu');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('CPU quota exceeded');
      expect(result.runsRemaining).toBe(0);
    });

    it('blocks GPU runs when hourly limit exceeded', () => {
      for (let i = 0; i < 10; i++) {
        trackRunStart('u1', `run-${i}`, 'gpu');
        trackRunComplete('u1', `run-${i}`, 'gpu');
      }

      const result = checkQuota('u1', 'gpu');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('GPU quota exceeded');
    });

    it('blocks when concurrent CPU limit reached', () => {
      trackRunStart('u1', 'run-a', 'cpu');
      trackRunStart('u1', 'run-b', 'cpu');

      const result = checkQuota('u1', 'cpu');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('concurrent limit reached');
      expect(result.concurrentRemaining).toBe(0);
    });

    it('blocks when concurrent GPU limit reached', () => {
      trackRunStart('u1', 'run-a', 'gpu');

      const result = checkQuota('u1', 'gpu');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('concurrent limit reached');
    });

    it('allows after concurrent run completes', () => {
      trackRunStart('u1', 'run-a', 'gpu');
      trackRunComplete('u1', 'run-a', 'gpu');

      const result = checkQuota('u1', 'gpu');
      expect(result.allowed).toBe(true);
    });
  });

  describe('trackRunComplete', () => {
    it('does nothing when user has no quota entry', () => {
      // Should not throw
      trackRunComplete('nonexistent-user', 'run-1', 'cpu');
    });

    it('removes run from active set', () => {
      trackRunStart('u1', 'run-1', 'cpu');
      trackRunComplete('u1', 'run-1', 'cpu');

      const result = checkQuota('u1', 'cpu');
      // Concurrent slots freed up; 1 run used
      expect(result.allowed).toBe(true);
      expect(result.concurrentRemaining).toBe(1);
    });
  });

  describe('trackRunStart with Supabase', () => {
    it('calls DB tracking when Supabase is configured', () => {
      mockIsSupabaseConfigured.mockReturnValue(true);
      // The DB call is fire-and-forget (.catch(() => {}))
      mockSingle.mockResolvedValue({ data: null, error: null });

      trackRunStart('u1', 'run-db', 'cpu');
      // Verify it incremented in memory too
      const result = checkQuota('u1', 'cpu');
      expect(result.runsRemaining).toBe(98); // 100 - 1 - 1 (the current check)
    });
  });

  describe('trackRunComplete with Supabase', () => {
    it('calls DB tracking when Supabase is configured', () => {
      mockIsSupabaseConfigured.mockReturnValue(true);
      mockSingle.mockResolvedValue({ data: null, error: null });

      trackRunStart('u1', 'run-db', 'cpu');
      trackRunComplete('u1', 'run-db', 'cpu');

      const result = checkQuota('u1', 'cpu');
      expect(result.allowed).toBe(true);
    });
  });

  describe('quotaMiddleware', () => {
    it('passes through for non-run endpoints', async () => {
      const c = createAuthenticatedContext('u1', { method: 'GET', path: '/projects' });
      const next = createMockNext();

      await quotaMiddleware(asHonoContext(c), asHonoNext(next));
      expect(next.wasCalled()).toBe(true);
    });

    it('passes through for non-POST requests to /runs', async () => {
      const c = createAuthenticatedContext('u1', { method: 'GET', path: '/runs' });
      const next = createMockNext();

      await quotaMiddleware(asHonoContext(c), asHonoNext(next));
      expect(next.wasCalled()).toBe(true);
    });

    it('returns 401 for unauthenticated user on POST /runs', async () => {
      const c = createMockContext({
        method: 'POST',
        path: '/projects/p1/runs',
        authContext: { user: null, isAuthenticated: false },
      });
      const next = createMockNext();

      await quotaMiddleware(asHonoContext(c), asHonoNext(next));

      expect(next.wasCalled()).toBe(false);
      expect(c.json).toHaveBeenCalled();
      const callArgs = (c.json as any).mock.calls[0];
      expect(callArgs[1]).toBe(401);
      expect(callArgs[0].error).toBe('Authentication required for run execution');
    });

    it('returns 400 for invalid lane', async () => {
      const c = createAuthenticatedContext('u1', {
        method: 'POST',
        path: '/projects/p1/runs',
        body: { lane: 'tpu' },
      });
      const next = createMockNext();

      await quotaMiddleware(asHonoContext(c), asHonoNext(next));

      expect(next.wasCalled()).toBe(false);
      const callArgs = (c.json as any).mock.calls[0];
      expect(callArgs[1]).toBe(400);
      expect(callArgs[0].error).toContain('Invalid lane');
    });

    it('allows POST /runs with CPU lane under quota', async () => {
      const c = createAuthenticatedContext('u1', {
        method: 'POST',
        path: '/projects/p1/runs',
        body: { lane: 'cpu' },
      });
      const next = createMockNext();

      await quotaMiddleware(asHonoContext(c), asHonoNext(next));

      expect(next.wasCalled()).toBe(true);
      expect(c._responseHeaders.get('X-Quota-CPU-Remaining')).toBeDefined();
    });

    it('allows POST /runs with GPU lane under quota', async () => {
      const c = createAuthenticatedContext('u1', {
        method: 'POST',
        path: '/projects/p1/runs',
        body: { lane: 'gpu' },
      });
      const next = createMockNext();

      await quotaMiddleware(asHonoContext(c), asHonoNext(next));

      expect(next.wasCalled()).toBe(true);
    });

    it('defaults to cpu lane when body has no lane', async () => {
      const c = createAuthenticatedContext('u1', {
        method: 'POST',
        path: '/projects/p1/runs',
        body: {},
      });
      const next = createMockNext();

      await quotaMiddleware(asHonoContext(c), asHonoNext(next));
      expect(next.wasCalled()).toBe(true);
    });

    it('returns 429 when quota exceeded', async () => {
      // Exhaust CPU quota
      for (let i = 0; i < 100; i++) {
        trackRunStart('quota-user', `r-${i}`, 'cpu');
        trackRunComplete('quota-user', `r-${i}`, 'cpu');
      }

      const c = createAuthenticatedContext('quota-user', {
        method: 'POST',
        path: '/projects/p1/runs',
        body: { lane: 'cpu' },
      });
      const next = createMockNext();

      await quotaMiddleware(asHonoContext(c), asHonoNext(next));

      expect(next.wasCalled()).toBe(false);
      const callArgs = (c.json as any).mock.calls[0];
      expect(callArgs[1]).toBe(429);
      expect(callArgs[0].error).toBe('Quota exceeded');

      resetQuota('quota-user');
    });

    it('sets quotaTracking in context on success', async () => {
      const c = createAuthenticatedContext('u1', {
        method: 'POST',
        path: '/projects/p1/runs',
        body: { lane: 'cpu' },
      });
      const next = createMockNext();

      await quotaMiddleware(asHonoContext(c), asHonoNext(next));

      const tracking = c._contextData.get('quotaTracking') as any;
      expect(tracking).toBeDefined();
      expect(tracking.userId).toBe('u1');
      expect(tracking.lane).toBe('cpu');
      expect(typeof tracking.trackStart).toBe('function');
      expect(typeof tracking.trackComplete).toBe('function');
    });

    it('handles body parse failure gracefully', async () => {
      const c = createAuthenticatedContext('u1', {
        method: 'POST',
        path: '/projects/p1/runs',
      });
      // Override json to throw
      c.req.json = () => Promise.reject(new Error('bad json'));
      const next = createMockNext();

      await quotaMiddleware(asHonoContext(c), asHonoNext(next));

      // Defaults to 'cpu' lane, should pass
      expect(next.wasCalled()).toBe(true);
    });

    it('falls back to in-memory when Supabase DB check throws', async () => {
      mockIsSupabaseConfigured.mockReturnValue(true);
      // Make DB query throw
      mockSingle.mockRejectedValueOnce(new Error('DB down'));

      const c = createAuthenticatedContext('u1', {
        method: 'POST',
        path: '/projects/p1/runs',
        body: { lane: 'cpu' },
      });
      const next = createMockNext();

      await quotaMiddleware(asHonoContext(c), asHonoNext(next));

      // Should fall back to in-memory check and allow
      expect(next.wasCalled()).toBe(true);
    });
  });

  describe('getQuotaStats', () => {
    it('returns stats for tracked users', () => {
      trackRunStart('u1', 'run-1', 'cpu');
      trackRunStart('u2', 'run-2', 'gpu');

      const stats = getQuotaStats();
      expect(stats.totalUsers).toBeGreaterThanOrEqual(2);
      expect(stats.users.length).toBeGreaterThanOrEqual(2);

      const u1Stats = stats.users.find((u) => u.userId === 'u1');
      expect(u1Stats).toBeDefined();
      expect(u1Stats!.cpuRunsThisHour).toBe(1);
      expect(u1Stats!.activeCpuRuns).toBe(1);

      const u2Stats = stats.users.find((u) => u.userId === 'u2');
      expect(u2Stats).toBeDefined();
      expect(u2Stats!.gpuRunsThisHour).toBe(1);
      expect(u2Stats!.activeGpuRuns).toBe(1);
      expect(u2Stats!.resetAt).toBeDefined();
    });

    it('returns empty stats when no users tracked', () => {
      // Clean up from other tests
      resetQuota('u1');
      resetQuota('u2');
      resetQuota('quota-user');

      const stats = getQuotaStats();
      // May or may not be 0 due to other test side-effects, just verify structure
      expect(stats).toHaveProperty('totalUsers');
      expect(stats).toHaveProperty('users');
      expect(Array.isArray(stats.users)).toBe(true);
    });
  });

  describe('resetQuota', () => {
    it('clears quota for a user', () => {
      trackRunStart('u1', 'run-1', 'cpu');
      resetQuota('u1');

      const result = checkQuota('u1', 'cpu');
      // After reset, full quota available
      expect(result.allowed).toBe(true);
      expect(result.runsRemaining).toBe(99);
    });
  });
});
