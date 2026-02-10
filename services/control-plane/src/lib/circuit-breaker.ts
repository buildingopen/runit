/**
 * Circuit Breaker for External Services
 *
 * Prevents cascading failures when external services (Modal, Supabase) are down.
 * Uses the opossum library with sensible defaults.
 *
 * Circuit states:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Too many failures, requests rejected immediately
 * - HALF-OPEN: Testing if service recovered
 */

import CircuitBreaker from 'opossum';
import { logger } from './logger';
import { captureMessage } from './sentry';

// Circuit breaker configuration
const DEFAULT_OPTIONS = {
  timeout: 30_000,          // 30s - max time to wait for action to complete
  errorThresholdPercentage: 50,  // Open circuit when 50% of requests fail
  resetTimeout: 30_000,     // 30s - time before trying again after opening
  volumeThreshold: 5,       // Minimum requests before calculating error %
  rollingCountTimeout: 10_000,  // 10s - rolling window for error calculation
  rollingCountBuckets: 10,  // Number of buckets in rolling window
};

// Track all circuit breakers for health checks
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const circuitBreakers = new Map<string, any>();

/**
 * Create a circuit breaker for an async function
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createCircuitBreaker<T>(
  name: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  action: (...args: any[]) => Promise<T>,
  options: Partial<typeof DEFAULT_OPTIONS> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  const breaker = new CircuitBreaker(action, {
    ...DEFAULT_OPTIONS,
    ...options,
    name,
  });

  // Event handlers for monitoring
  breaker.on('success', () => {
    logger.debug(`[CircuitBreaker:${name}] Request succeeded`);
  });

  breaker.on('failure', (error: Error) => {
    logger.warn(`[CircuitBreaker:${name}] Request failed`, { error: error.message });
  });

  breaker.on('timeout', () => {
    logger.warn(`[CircuitBreaker:${name}] Request timed out`);
  });

  breaker.on('reject', () => {
    logger.warn(`[CircuitBreaker:${name}] Request rejected (circuit open)`);
  });

  breaker.on('open', () => {
    logger.error(`[CircuitBreaker:${name}] Circuit OPENED - service unavailable`);
    captureMessage(`Circuit breaker ${name} opened`, 'error');
  });

  breaker.on('halfOpen', () => {
    logger.info(`[CircuitBreaker:${name}] Circuit HALF-OPEN - testing recovery`);
  });

  breaker.on('close', () => {
    logger.info(`[CircuitBreaker:${name}] Circuit CLOSED - service recovered`);
    captureMessage(`Circuit breaker ${name} closed - service recovered`, 'info');
  });

  breaker.on('fallback', () => {
    logger.debug(`[CircuitBreaker:${name}] Fallback executed`);
  });

  // Register for health checks
  circuitBreakers.set(name, breaker);

  return breaker;
}

/**
 * Get circuit breaker stats for health checks
 */
export function getCircuitBreakerStats(): Record<string, CircuitBreakerStats> {
  const stats: Record<string, CircuitBreakerStats> = {};

  for (const [name, breaker] of circuitBreakers) {
    const s = breaker.stats;
    stats[name] = {
      state: breaker.opened ? 'open' : breaker.halfOpen ? 'half-open' : 'closed',
      failures: s.failures,
      successes: s.successes,
      rejects: s.rejects,
      timeouts: s.timeouts,
      fallbacks: s.fallbacks,
      latencyMean: s.latencyMean,
      latencyP99: s.percentiles[99] || 0,
    };
  }

  return stats;
}

interface CircuitBreakerStats {
  state: 'open' | 'half-open' | 'closed';
  failures: number;
  successes: number;
  rejects: number;
  timeouts: number;
  fallbacks: number;
  latencyMean: number;
  latencyP99: number;
}

/**
 * Check if any circuit breaker is open (for health endpoint)
 */
export function hasOpenCircuit(): boolean {
  for (const breaker of circuitBreakers.values()) {
    if (breaker.opened) return true;
  }
  return false;
}

/**
 * Reset all circuit breakers (for testing)
 */
export function resetAllCircuitBreakers(): void {
  for (const breaker of circuitBreakers.values()) {
    breaker.close();
  }
}

// Pre-configured circuit breakers for common services
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let modalCircuitBreaker: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let supabaseCircuitBreaker: any = null;

/**
 * Get or create Modal circuit breaker
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getModalCircuitBreaker(): any {
  if (!modalCircuitBreaker) {
    modalCircuitBreaker = createCircuitBreaker(
      'modal',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (fn: any) => fn(),
      {
        timeout: 60_000,  // Modal can take longer
        errorThresholdPercentage: 60,  // More tolerant
        volumeThreshold: 3,  // Lower threshold for Modal
      }
    );
  }
  return modalCircuitBreaker;
}

/**
 * Get or create Supabase circuit breaker
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSupabaseCircuitBreaker(): any {
  if (!supabaseCircuitBreaker) {
    supabaseCircuitBreaker = createCircuitBreaker(
      'supabase',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (fn: any) => fn(),
      {
        timeout: 10_000,  // DB should be fast
        errorThresholdPercentage: 50,
        volumeThreshold: 5,
      }
    );
  }
  return supabaseCircuitBreaker;
}

/**
 * Execute an action with circuit breaker protection
 */
export async function withCircuitBreaker<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  breaker: any,
  action: () => Promise<T>,
  fallback?: () => T
): Promise<T> {
  if (fallback) {
    breaker.fallback(fallback);
  }

  return breaker.fire(action) as Promise<T>;
}
