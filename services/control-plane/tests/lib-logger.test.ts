/**
 * Logger tests
 *
 * Covers: redactString patterns (lines 58-83), redactObject sensitive fields (line 123),
 * formatMessage production JSON (line 132), logger.error with Error/non-Error (lines 151-190),
 * logger.debug, logger.child.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// We need to control NODE_ENV before importing, so use dynamic imports
describe('logger', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe('development mode', () => {
    let logger: typeof import('../src/lib/logger').logger;
    let redact: typeof import('../src/lib/logger').redact;

    beforeEach(async () => {
      vi.resetModules();
      process.env.NODE_ENV = 'test'; // not production
      const mod = await import('../src/lib/logger');
      logger = mod.logger;
      redact = mod.redact;
    });

    it('redacts OpenAI API keys', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.info('Key: sk-abcdefghijklmnopqrstuvwxyz1234567890');
      const output = spy.mock.calls[0][0] as string;
      expect(output).toContain('sk-***REDACTED***');
      expect(output).not.toContain('abcdefghijklmnopqr');
      spy.mockRestore();
    });

    it('redacts Stripe live keys', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.info('Stripe: sk_live_abcdefghijklmnopqrstuvwxyz');
      const output = spy.mock.calls[0][0] as string;
      expect(output).toContain('sk_live_***REDACTED***');
      spy.mockRestore();
    });

    it('redacts Stripe test keys', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.info('Stripe: sk_test_abcdefghijklmnopqrstuvwxyz');
      const output = spy.mock.calls[0][0] as string;
      expect(output).toContain('sk_test_***REDACTED***');
      spy.mockRestore();
    });

    it('redacts Stripe pk_live keys', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.info('pk_live_abcdefghijklmnopqrstuvwxyz');
      const output = spy.mock.calls[0][0] as string;
      expect(output).toContain('pk_live_***REDACTED***');
      spy.mockRestore();
    });

    it('redacts Stripe pk_test keys', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.info('pk_test_abcdefghijklmnopqrstuvwxyz');
      const output = spy.mock.calls[0][0] as string;
      expect(output).toContain('pk_test_***REDACTED***');
      spy.mockRestore();
    });

    it('redacts Google API keys', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.info('Google: AIzaAbcdefghijklmnopqrstuvwxyz1234567890');
      const output = spy.mock.calls[0][0] as string;
      expect(output).toContain('AIza***REDACTED***');
      spy.mockRestore();
    });

    it('redacts GitHub PATs', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.info('GH: ghp_abcdefghijklmnopqrstuvwxyz1234567890');
      const output = spy.mock.calls[0][0] as string;
      expect(output).toContain('ghp_***REDACTED***');
      spy.mockRestore();
    });

    it('redacts GitHub OAuth tokens', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.info('GH OAuth: gho_abcdefghijklmnopqrstuvwxyz1234567890');
      const output = spy.mock.calls[0][0] as string;
      expect(output).toContain('gho_***REDACTED***');
      spy.mockRestore();
    });

    it('redacts Slack tokens', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.info('Slack: xoxb-123456-abcdef');
      const output = spy.mock.calls[0][0] as string;
      expect(output).toContain('xox_***REDACTED***');
      spy.mockRestore();
    });

    it('redacts AWS Access Key IDs', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.info('AWS: AKIAIOSFODNN7EXAMPLE');
      const output = spy.mock.calls[0][0] as string;
      expect(output).toContain('AKIA***REDACTED***');
      spy.mockRestore();
    });

    it('redacts database connection URLs', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.info('DB: postgres://user:password@host:5432/db');
      const output = spy.mock.calls[0][0] as string;
      expect(output).toContain('postgres://***:***@');
      expect(output).not.toContain('password');
      spy.mockRestore();
    });

    it('redacts MySQL connection URLs', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.info('DB: mysql://admin:secret@host/db');
      const output = spy.mock.calls[0][0] as string;
      expect(output).toContain('mysql://***:***@');
      spy.mockRestore();
    });

    it('redacts MongoDB connection URLs', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.info('DB: mongodb+srv://user:pass@cluster.mongodb.net');
      const output = spy.mock.calls[0][0] as string;
      expect(output).toContain('mongodb://***:***@');
      spy.mockRestore();
    });

    it('redacts Redis connection URLs', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.info('Cache: redis://default:secret@host:6379');
      const output = spy.mock.calls[0][0] as string;
      expect(output).toContain('redis://***:***@');
      spy.mockRestore();
    });

    it('redacts JWT tokens', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.info(
        'Token: eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.abc123'
      );
      const output = spy.mock.calls[0][0] as string;
      expect(output).toContain('eyJ***JWT_REDACTED***');
      spy.mockRestore();
    });

    it('redacts Bearer tokens', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.info('Auth: Bearer my-long-token-value.here');
      const output = spy.mock.calls[0][0] as string;
      expect(output).toContain('Bearer ***REDACTED***');
      spy.mockRestore();
    });

    it('redacts email addresses', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.info('User: john.doe@example.com');
      const output = spy.mock.calls[0][0] as string;
      expect(output).toContain('***@example.com');
      expect(output).not.toContain('john.doe@');
      spy.mockRestore();
    });

    it('redacts sensitive fields in context objects', () => {
      const result = redact({
        username: 'john',
        password: 'secret123',
        apiKey: 'my-key',
        token: 'tok-abc',
        authorization: 'Bearer xyz',
        client_secret: 'cs-123',
        nested: {
          encryption_key: 'ek-456',
          masterKey: 'mk-789',
        },
      });

      const r = result as Record<string, unknown>;
      expect(r.username).toBe('john');
      expect(r.password).toBe('[REDACTED]');
      expect(r.apiKey).toBe('[REDACTED]');
      expect(r.token).toBe('[REDACTED]');
      expect(r.authorization).toBe('[REDACTED]');
      expect(r.client_secret).toBe('[REDACTED]');

      const nested = r.nested as Record<string, unknown>;
      expect(nested.encryption_key).toBe('[REDACTED]');
      expect(nested.masterKey).toBe('[REDACTED]');
    });

    it('redactObject handles arrays', () => {
      const result = redact(['sk-abcdefghijklmnopqrstuvwxyz1234567890', 'normal']);
      expect(Array.isArray(result)).toBe(true);
      const arr = result as string[];
      expect(arr[0]).toContain('sk-***REDACTED***');
      expect(arr[1]).toBe('normal');
    });

    it('redactObject returns non-object values as-is', () => {
      expect(redact(42)).toBe(42);
      expect(redact(null)).toBeNull();
      expect(redact(true)).toBe(true);
      expect(redact(undefined)).toBeUndefined();
    });

    it('redactObject handles max depth', () => {
      // Build deeply nested object
      let obj: Record<string, unknown> = { val: 'deep' };
      for (let i = 0; i < 12; i++) {
        obj = { nested: obj };
      }
      const result = redact(obj) as Record<string, unknown>;
      // At some depth it returns [MAX_DEPTH_EXCEEDED]
      let current: unknown = result;
      for (let i = 0; i < 11; i++) {
        current = (current as Record<string, unknown>).nested;
      }
      expect(current).toBe('[MAX_DEPTH_EXCEEDED]');
    });

    it('logger.warn outputs warning level', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      logger.warn('test warning', { requestId: 'req-1' });
      const output = spy.mock.calls[0][0] as string;
      expect(output).toContain('[WARN]');
      expect(output).toContain('test warning');
      spy.mockRestore();
    });

    it('logger.error handles Error objects', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      logger.error('something failed', new Error('boom'), { requestId: 'req-1' });
      const output = spy.mock.calls[0][0] as string;
      expect(output).toContain('[ERROR]');
      expect(output).toContain('something failed');
      expect(output).toContain('boom');
      spy.mockRestore();
    });

    it('logger.error handles non-Error values', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      logger.error('failed', 'string-error');
      const output = spy.mock.calls[0][0] as string;
      expect(output).toContain('string-error');
      spy.mockRestore();
    });

    it('logger.error handles null error', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      logger.error('failed with null', null);
      const output = spy.mock.calls[0][0] as string;
      expect(output).toContain('failed with null');
      spy.mockRestore();
    });

    it('logger.debug outputs in non-production', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.debug('debug msg', { userId: 'u1' });
      const output = spy.mock.calls[0][0] as string;
      expect(output).toContain('[DEBUG]');
      expect(output).toContain('debug msg');
      spy.mockRestore();
    });

    it('logger.child creates child logger with default context', () => {
      const child = logger.child({ requestId: 'req-42', userId: 'u1' });

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      child.info('info msg');
      expect((logSpy.mock.calls[0][0] as string)).toContain('req-42');

      child.warn('warn msg');
      expect((warnSpy.mock.calls[0][0] as string)).toContain('req-42');

      child.error('error msg', new Error('err'));
      expect((errorSpy.mock.calls[0][0] as string)).toContain('req-42');

      child.debug('debug msg');
      // debug in non-production goes through console.log
      const debugCall = logSpy.mock.calls.find((c) => (c[0] as string).includes('debug msg'));
      expect(debugCall).toBeDefined();

      logSpy.mockRestore();
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('logger.child merges override context', () => {
      const child = logger.child({ requestId: 'req-1' });
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

      child.info('msg', { projectId: 'p-1' });
      const output = spy.mock.calls[0][0] as string;
      expect(output).toContain('req-1');
      expect(output).toContain('p-1');
      spy.mockRestore();
    });

    it('formats development output as [LEVEL] message', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.info('hello world');
      const output = spy.mock.calls[0][0] as string;
      expect(output).toMatch(/^\[INFO\] hello world/);
      spy.mockRestore();
    });
  });

  describe('production mode', () => {
    it('formats output as JSON with level, message, timestamp', async () => {
      vi.resetModules();
      process.env.NODE_ENV = 'production';
      const mod = await import('../src/lib/logger');

      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      mod.logger.info('prod message', { requestId: 'req-99' });
      const output = spy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output);
      expect(parsed.level).toBe('info');
      expect(parsed.message).toBe('prod message');
      expect(parsed.timestamp).toBeDefined();
      expect(parsed.requestId).toBe('req-99');
      spy.mockRestore();
    });

    it('logger.debug does not output in production', async () => {
      vi.resetModules();
      process.env.NODE_ENV = 'production';
      const mod = await import('../src/lib/logger');

      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      mod.logger.debug('should not appear');
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('logger.error omits stack in production', async () => {
      vi.resetModules();
      process.env.NODE_ENV = 'production';
      const mod = await import('../src/lib/logger');

      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mod.logger.error('prod error', new Error('production boom'));
      const output = spy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output);
      expect(parsed.error).toBe('production boom');
      expect(parsed.stack).toBeUndefined();
      spy.mockRestore();
    });
  });
});
