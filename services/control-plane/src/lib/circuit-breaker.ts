// ABOUTME: Circuit breaker implementation using opossum for Modal and Supabase, with configurable thresholds and health checks.
// ABOUTME: Tracks open/half-open/closed states, logs transitions to Sentry, and provides withCircuitBreaker() wrapper.
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

// Circuit breaker configuration options type
interface CircuitBreakerOptions {
  timeout: number;
  errorThresholdPercentage: number;
  resetTimeout: number;
  volumeThreshold: number;
  rollingCountTimeout: number;
  rollingCountBuckets: number;
}

const DEFAULT_OPTIONS: CircuitBreakerOptions = {
  timeout: 30_000,          // 30s - max time to wait for action to complete
  errorThresholdPercentage: 50,  // Open circuit when 50% of requests fail
  resetTimeout: 30_000,     // 30s - time before trying again after opening
  volumeThreshold: 5,       // Minimum requests before calculating error %
  rollingCountTimeout: 10_000,  // 10s - rolling window for error calculation
  rollingCountBuckets: 10,  // Number of buckets in rolling window
};

// Track all circuit breakers for health checks
const circuitBreakers = new Map<string, CircuitBreaker<unknown[], unknown>>();

/**
 * Create a circuit breaker for an async function
 */
export function createCircuitBreaker<TArgs extends unknown[], TReturn>(
  name: string,
  action: (...args: TArgs) => Promise<TReturn>,
  options: Partial<CircuitBreakerOptions> = {}
): CircuitBreaker<TArgs, TReturn> {
  const breaker = new CircuitBreaker<TArgs, TReturn>(action, {
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
  circuitBreakers.set(name, breaker as CircuitBreaker<unknown[], unknown>);

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

// Type for async function that returns a value
type AsyncFunction<T> = () => Promise<T>;

// Pre-configured circuit breakers for common services
let modalCircuitBreaker: CircuitBreaker<[AsyncFunction<unknown>], unknown> | null = null;
let supabaseCircuitBreaker: CircuitBreaker<[AsyncFunction<unknown>], unknown> | null = null;

/**
 * Get or create Modal circuit breaker
 */
export function getModalCircuitBreaker(): CircuitBreaker<[AsyncFunction<unknown>], unknown> {
  if (!modalCircuitBreaker) {
    modalCircuitBreaker = createCircuitBreaker(
      'modal',
      async <T>(fn: AsyncFunction<T>): Promise<T> => fn(),
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
export function getSupabaseCircuitBreaker(): CircuitBreaker<[AsyncFunction<unknown>], unknown> {
  if (!supabaseCircuitBreaker) {
    supabaseCircuitBreaker = createCircuitBreaker(
      'supabase',
      async <T>(fn: AsyncFunction<T>): Promise<T> => fn(),
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
 *
 * The breaker uses `unknown` generics internally to support multiple return types.
 * The caller provides the action type which is preserved through the Promise.
 */
export async function withCircuitBreaker<T>(
  breaker: CircuitBreaker<[AsyncFunction<unknown>], unknown>,
  action: () => Promise<T>,
  fallback?: () => T
): Promise<T> {
  if (fallback) {
    breaker.fallback(fallback as () => unknown);
  }

  return breaker.fire(action as AsyncFunction<unknown>) as Promise<T>;
}
