import { beforeEach, describe, expect, it, vi } from 'vitest';

const logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

const captureMessage = vi.fn();

type EventHandler = (...args: unknown[]) => void;

class MockCircuitBreaker {
  public opened = false;
  public halfOpen = false;
  public stats = {
    failures: 0,
    successes: 0,
    rejects: 0,
    timeouts: 0,
    fallbacks: 0,
    latencyMean: 0,
    percentiles: {} as Record<number, number>,
  };

  public closeCalls = 0;
  public fallbackFn: (() => unknown) | null = null;
  public readonly options: Record<string, unknown>;
  private readonly handlers = new Map<string, EventHandler[]>();
  private readonly action: (...args: unknown[]) => Promise<unknown>;

  constructor(action: (...args: unknown[]) => Promise<unknown>, options: Record<string, unknown>) {
    this.action = action;
    this.options = options;
    createdBreakers.push(this);
  }

  on(event: string, handler: EventHandler) {
    const existing = this.handlers.get(event) ?? [];
    existing.push(handler);
    this.handlers.set(event, existing);
  }

  emit(event: string, ...args: unknown[]) {
    for (const handler of this.handlers.get(event) ?? []) {
      handler(...args);
    }
  }

  async fire(...args: unknown[]) {
    if (this.opened && this.fallbackFn) {
      this.stats.fallbacks += 1;
      this.emit('fallback');
      return this.fallbackFn();
    }
    if (args.length > 0 && typeof args[0] === 'function') {
      return (args[0] as () => Promise<unknown>)();
    }
    return this.action(...args);
  }

  fallback(fn: () => unknown) {
    this.fallbackFn = fn;
  }

  close() {
    this.opened = false;
    this.halfOpen = false;
    this.closeCalls += 1;
  }
}

const createdBreakers: MockCircuitBreaker[] = [];

vi.mock('opossum', () => ({
  default: MockCircuitBreaker,
}));

vi.mock('../src/lib/logger', () => ({ logger }));
vi.mock('../src/lib/sentry', () => ({ captureMessage }));

describe('lib/circuit-breaker', () => {
  beforeEach(() => {
    createdBreakers.length = 0;
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('creates breaker, wires events, and reports stats', async () => {
    const mod = await import('../src/lib/circuit-breaker');
    const breaker = mod.createCircuitBreaker('svc', async () => 'ok');

    expect(createdBreakers).toHaveLength(1);
    expect(await breaker.fire()).toBe('ok');

    const cb = breaker as unknown as MockCircuitBreaker;
    cb.stats = {
      failures: 2,
      successes: 3,
      rejects: 1,
      timeouts: 4,
      fallbacks: 5,
      latencyMean: 123,
      percentiles: { 99: 987 },
    };
    cb.emit('success');
    cb.emit('failure', new Error('x'));
    cb.emit('timeout');
    cb.emit('reject');
    cb.emit('open');
    cb.emit('halfOpen');
    cb.emit('close');
    cb.emit('fallback');

    expect(logger.debug).toHaveBeenCalledWith('[CircuitBreaker:svc] Request succeeded');
    expect(logger.warn).toHaveBeenCalledWith('[CircuitBreaker:svc] Request failed', { error: 'x' });
    expect(logger.warn).toHaveBeenCalledWith('[CircuitBreaker:svc] Request timed out');
    expect(logger.warn).toHaveBeenCalledWith('[CircuitBreaker:svc] Request rejected (circuit open)');
    expect(logger.error).toHaveBeenCalledWith('[CircuitBreaker:svc] Circuit OPENED - service unavailable');
    expect(logger.info).toHaveBeenCalledWith('[CircuitBreaker:svc] Circuit HALF-OPEN - testing recovery');
    expect(logger.info).toHaveBeenCalledWith('[CircuitBreaker:svc] Circuit CLOSED - service recovered');
    expect(logger.debug).toHaveBeenCalledWith('[CircuitBreaker:svc] Fallback executed');
    expect(captureMessage).toHaveBeenCalledWith('Circuit breaker svc opened', 'error');
    expect(captureMessage).toHaveBeenCalledWith('Circuit breaker svc closed - service recovered', 'info');

    cb.opened = true;
    let stats = mod.getCircuitBreakerStats();
    expect(stats.svc.state).toBe('open');
    expect(stats.svc.latencyP99).toBe(987);

    cb.opened = false;
    cb.halfOpen = true;
    stats = mod.getCircuitBreakerStats();
    expect(stats.svc.state).toBe('half-open');

    cb.halfOpen = false;
    stats = mod.getCircuitBreakerStats();
    expect(stats.svc.state).toBe('closed');
  });

  it('detects open circuits and resets all', async () => {
    const mod = await import('../src/lib/circuit-breaker');
    const a = mod.createCircuitBreaker('a', async () => 'a') as unknown as MockCircuitBreaker;
    const b = mod.createCircuitBreaker('b', async () => 'b') as unknown as MockCircuitBreaker;

    expect(mod.hasOpenCircuit()).toBe(false);
    a.opened = true;
    expect(mod.hasOpenCircuit()).toBe(true);

    mod.resetAllCircuitBreakers();
    expect(a.closeCalls).toBe(1);
    expect(b.closeCalls).toBe(1);
    expect(mod.hasOpenCircuit()).toBe(false);
  });

  it('returns singleton service breakers with expected options', async () => {
    const mod = await import('../src/lib/circuit-breaker');
    const modalA = mod.getModalCircuitBreaker() as unknown as MockCircuitBreaker;
    const modalB = mod.getModalCircuitBreaker() as unknown as MockCircuitBreaker;
    const supabaseA = mod.getSupabaseCircuitBreaker() as unknown as MockCircuitBreaker;
    const supabaseB = mod.getSupabaseCircuitBreaker() as unknown as MockCircuitBreaker;

    expect(modalA).toBe(modalB);
    expect(supabaseA).toBe(supabaseB);
    expect(modalA.options.timeout).toBe(60_000);
    expect(modalA.options.errorThresholdPercentage).toBe(60);
    expect(modalA.options.volumeThreshold).toBe(3);
    expect(supabaseA.options.timeout).toBe(10_000);
    expect(supabaseA.options.errorThresholdPercentage).toBe(50);
    expect(supabaseA.options.volumeThreshold).toBe(5);
  });

  it('executes with circuit breaker and fallback', async () => {
    const mod = await import('../src/lib/circuit-breaker');
    const breaker = mod.createCircuitBreaker('fallback', async () => 'primary') as unknown as MockCircuitBreaker;

    expect(await mod.withCircuitBreaker(breaker as never, async () => 'done')).toBe('done');

    breaker.opened = true;
    const result = await mod.withCircuitBreaker(
      breaker as never,
      async () => {
        throw new Error('unreachable');
      },
      () => 'fallback-value'
    );

    expect(result).toBe('fallback-value');
    expect(breaker.fallbackFn).not.toBeNull();
  });
});
