/**
 * Integration tests for Secrets API routes
 *
 * Tests for CRUD operations on /projects/:projectId/secrets endpoints
 * Mocks Supabase client, encryption, and database stores
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing routes
vi.mock('../../src/db/secrets-store', () => ({
  storeSecret: vi.fn(),
  getProjectSecrets: vi.fn(),
  getSecret: vi.fn(),
  deleteSecret: vi.fn(),
}));

vi.mock('../../src/crypto/kms', () => ({
  encryptSecret: vi.fn(),
  decryptSecret: vi.fn(),
}));

vi.mock('../../src/middleware/auth', () => ({
  getAuthContext: vi.fn(),
}));

vi.mock('../../src/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../src/lib/sentry', () => ({
  captureMessage: vi.fn(),
}));

vi.mock('../../src/lib/metrics', () => ({
  secretsOperationsTotal: {
    inc: vi.fn(),
  },
  recordSecretsOperation: vi.fn(),
}));

import secrets from '../../src/routes/secrets';
import * as secretsStore from '../../src/db/secrets-store';
import { encryptSecret, decryptSecret } from '../../src/crypto/kms';
import { getAuthContext } from '../../src/middleware/auth';
import { SECRETS_RESERVED_PREFIX, ERROR_CODES } from '../../src/constants';

describe('POST /projects/:projectId/secrets - Create secret', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a new secret', async () => {
    const mockSecret = {
      id: 'secret-123',
      project_id: 'proj-1',
      key: 'API_KEY',
      encrypted_value: 'encrypted-value',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });
    vi.mocked(secretsStore.getSecret).mockResolvedValue(null);
    vi.mocked(encryptSecret).mockResolvedValue('encrypted-value');
    vi.mocked(secretsStore.storeSecret).mockResolvedValue(mockSecret as any);

    const res = await secrets.request('/proj-1/secrets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: 'API_KEY',
        value: 'sk-1234567890',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe('secret-123');
    expect(body.key).toBe('API_KEY');
    expect(body).not.toHaveProperty('value');
    expect(body).not.toHaveProperty('encrypted_value');
    expect(encryptSecret).toHaveBeenCalledWith('sk-1234567890');
    expect(secretsStore.storeSecret).toHaveBeenCalledWith('proj-1', 'API_KEY', 'encrypted-value');
  });

  it('should update an existing secret', async () => {
    const existingSecret = {
      id: 'secret-123',
      project_id: 'proj-1',
      key: 'API_KEY',
      encrypted_value: 'old-encrypted',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    const updatedSecret = {
      ...existingSecret,
      encrypted_value: 'new-encrypted',
      updated_at: '2024-01-02T00:00:00Z',
    };

    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });
    vi.mocked(secretsStore.getSecret).mockResolvedValue(existingSecret as any);
    vi.mocked(encryptSecret).mockResolvedValue('new-encrypted');
    vi.mocked(secretsStore.storeSecret).mockResolvedValue(updatedSecret as any);

    const res = await secrets.request('/proj-1/secrets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: 'API_KEY',
        value: 'new-value',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.key).toBe('API_KEY');
    expect(body.updated_at).toBe('2024-01-02T00:00:00Z');
  });

  it('should return 400 when key is missing', async () => {
    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });

    const res = await secrets.request('/proj-1/secrets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        value: 'some-value',
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Missing required fields');
  });

  it('should return 400 when value is missing', async () => {
    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });

    const res = await secrets.request('/proj-1/secrets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: 'API_KEY',
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Missing required fields');
  });

  it('should return 400 for invalid key format (lowercase)', async () => {
    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });

    const res = await secrets.request('/proj-1/secrets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: 'api_key',
        value: 'some-value',
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Invalid secret key format');
  });

  it('should return 400 for invalid key format (special characters)', async () => {
    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });

    const res = await secrets.request('/proj-1/secrets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: 'API-KEY',
        value: 'some-value',
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Invalid secret key format');
  });

  it('should return 400 for invalid key format (starts with number)', async () => {
    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });

    const res = await secrets.request('/proj-1/secrets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: '123_KEY',
        value: 'some-value',
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Invalid secret key format');
  });

  it('should return 400 for reserved prefix', async () => {
    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });

    const res = await secrets.request('/proj-1/secrets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: `${SECRETS_RESERVED_PREFIX}CUSTOM_KEY`,
        value: 'some-value',
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('reserved prefix');
    expect(body.code).toBe(ERROR_CODES.SECRET_RESERVED_PREFIX);
  });

  it('should return 500 when encryption fails', async () => {
    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });
    vi.mocked(secretsStore.getSecret).mockResolvedValue(null);
    vi.mocked(encryptSecret).mockRejectedValue(new Error('KMS error'));

    const res = await secrets.request('/proj-1/secrets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: 'API_KEY',
        value: 'some-value',
      }),
    });

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Failed to store secret');
    expect(body.code).toBe(ERROR_CODES.SECRET_STORE_FAILED);
  });

  it('should return 500 when store fails', async () => {
    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });
    vi.mocked(secretsStore.getSecret).mockResolvedValue(null);
    vi.mocked(encryptSecret).mockResolvedValue('encrypted-value');
    vi.mocked(secretsStore.storeSecret).mockRejectedValue(new Error('Database error'));

    const res = await secrets.request('/proj-1/secrets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: 'API_KEY',
        value: 'some-value',
      }),
    });

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Failed to store secret');
    expect(body.code).toBe(ERROR_CODES.SECRET_STORE_FAILED);
  });
});

describe('GET /projects/:projectId/secrets - List secrets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return list of secrets (masked)', async () => {
    const mockSecrets = [
      {
        id: 'secret-1',
        project_id: 'proj-1',
        key: 'API_KEY',
        encrypted_value: 'encrypted-1',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 'secret-2',
        project_id: 'proj-1',
        key: 'DATABASE_URL',
        encrypted_value: 'encrypted-2',
        created_at: '2024-01-02T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
      },
    ];

    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });
    vi.mocked(secretsStore.getProjectSecrets).mockResolvedValue(mockSecrets as any);

    const res = await secrets.request('/proj-1/secrets', { method: 'GET' });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.secrets).toHaveLength(2);
    expect(body.secrets[0].key).toBe('API_KEY');
    expect(body.secrets[0]).toHaveProperty('id');
    expect(body.secrets[0]).toHaveProperty('created_at');
    expect(body.secrets[0]).toHaveProperty('updated_at');
    // Values should never be returned
    expect(body.secrets[0]).not.toHaveProperty('value');
    expect(body.secrets[0]).not.toHaveProperty('encrypted_value');
  });

  it('should return empty list when no secrets exist', async () => {
    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });
    vi.mocked(secretsStore.getProjectSecrets).mockResolvedValue([]);

    const res = await secrets.request('/proj-1/secrets', { method: 'GET' });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.secrets).toHaveLength(0);
  });

  it('should return 500 when listing fails', async () => {
    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });
    vi.mocked(secretsStore.getProjectSecrets).mockRejectedValue(new Error('Database error'));

    const res = await secrets.request('/proj-1/secrets', { method: 'GET' });

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Failed to list secrets');
    expect(body.code).toBe(ERROR_CODES.SECRET_LIST_FAILED);
  });
});

describe('DELETE /projects/:projectId/secrets/:key - Delete secret', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should delete a secret', async () => {
    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });
    vi.mocked(secretsStore.deleteSecret).mockResolvedValue(true);

    const res = await secrets.request('/proj-1/secrets/API_KEY', { method: 'DELETE' });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(secretsStore.deleteSecret).toHaveBeenCalledWith('proj-1', 'API_KEY');
  });

  it('should return 500 when delete fails', async () => {
    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });
    vi.mocked(secretsStore.deleteSecret).mockRejectedValue(new Error('Database error'));

    const res = await secrets.request('/proj-1/secrets/API_KEY', { method: 'DELETE' });

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Failed to delete secret');
    expect(body.code).toBe(ERROR_CODES.SECRET_DELETE_FAILED);
  });

  it('should handle non-existent secret deletion gracefully', async () => {
    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });
    vi.mocked(secretsStore.deleteSecret).mockResolvedValue(false);

    const res = await secrets.request('/proj-1/secrets/NON_EXISTENT_KEY', { method: 'DELETE' });

    // Current implementation returns success even if key doesn't exist
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});

describe('Secrets - Audit logging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should log create operation', async () => {
    const { logger } = await import('../../src/lib/logger');

    const mockSecret = {
      id: 'secret-123',
      key: 'API_KEY',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });
    vi.mocked(secretsStore.getSecret).mockResolvedValue(null);
    vi.mocked(encryptSecret).mockResolvedValue('encrypted');
    vi.mocked(secretsStore.storeSecret).mockResolvedValue(mockSecret as any);

    await secrets.request('/proj-1/secrets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'API_KEY', value: 'test' }),
    });

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Secrets Audit'),
      expect.objectContaining({
        operation: 'create',
        projectId: 'proj-1',
        success: true,
      })
    );
  });

  it('should log update operation when secret exists', async () => {
    const { logger } = await import('../../src/lib/logger');

    const existingSecret = {
      id: 'secret-123',
      key: 'API_KEY',
      encrypted_value: 'old',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });
    vi.mocked(secretsStore.getSecret).mockResolvedValue(existingSecret as any);
    vi.mocked(encryptSecret).mockResolvedValue('new-encrypted');
    vi.mocked(secretsStore.storeSecret).mockResolvedValue(existingSecret as any);

    await secrets.request('/proj-1/secrets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'API_KEY', value: 'new-value' }),
    });

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Secrets Audit'),
      expect.objectContaining({
        operation: 'update',
        projectId: 'proj-1',
        success: true,
      })
    );
  });

  it('should log delete operation', async () => {
    const { logger } = await import('../../src/lib/logger');

    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });
    vi.mocked(secretsStore.deleteSecret).mockResolvedValue(true);

    await secrets.request('/proj-1/secrets/API_KEY', { method: 'DELETE' });

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Secrets Audit'),
      expect.objectContaining({
        operation: 'delete',
        projectId: 'proj-1',
        success: true,
      })
    );
  });

  it('should log failed operations', async () => {
    const { logger } = await import('../../src/lib/logger');

    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });
    vi.mocked(secretsStore.getSecret).mockResolvedValue(null);
    vi.mocked(encryptSecret).mockRejectedValue(new Error('KMS error'));

    await secrets.request('/proj-1/secrets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'API_KEY', value: 'test' }),
    });

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('FAILED'),
      expect.objectContaining({
        operation: 'create',
        projectId: 'proj-1',
        success: false,
        error: 'KMS error',
      })
    );
  });
});

describe('Secrets - Valid key formats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });
    vi.mocked(secretsStore.getSecret).mockResolvedValue(null);
    vi.mocked(encryptSecret).mockResolvedValue('encrypted');
    vi.mocked(secretsStore.storeSecret).mockResolvedValue({
      id: 'secret-123',
      key: 'VALID_KEY',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    } as any);
  });

  const validKeys = [
    'API_KEY',
    'DATABASE_URL',
    'MY_SECRET_123',
    'A',
    'ABC',
    'A1',
    '_UNDERSCORE_START',
  ];

  for (const key of validKeys) {
    it(`should accept valid key format: ${key}`, async () => {
      const res = await secrets.request('/proj-1/secrets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: 'test-value' }),
      });

      expect(res.status).toBe(201);
    });
  }

  const invalidKeys = [
    'lowercase_key',
    'MixedCase',
    'key-with-dash',
    'key.with.dot',
    '1_STARTS_WITH_NUMBER',
    '',
    'KEY WITH SPACES',
  ];

  for (const key of invalidKeys) {
    it(`should reject invalid key format: ${key || '(empty)'}`, async () => {
      const res = await secrets.request('/proj-1/secrets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: 'test-value' }),
      });

      expect(res.status).toBe(400);
    });
  }
});

describe('Secrets - Metrics tracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should increment metrics on successful create', async () => {
    const { recordSecretsOperation } = await import('../../src/lib/metrics');

    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });
    vi.mocked(secretsStore.getSecret).mockResolvedValue(null);
    vi.mocked(encryptSecret).mockResolvedValue('encrypted');
    vi.mocked(secretsStore.storeSecret).mockResolvedValue({
      id: 'secret-123',
      key: 'API_KEY',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    } as any);

    await secrets.request('/proj-1/secrets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'API_KEY', value: 'test' }),
    });

    expect(recordSecretsOperation).toHaveBeenCalledWith('create', 'success');
  });

  it('should increment metrics on failed operation', async () => {
    const { recordSecretsOperation } = await import('../../src/lib/metrics');

    vi.mocked(getAuthContext).mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });
    vi.mocked(secretsStore.getSecret).mockResolvedValue(null);
    vi.mocked(encryptSecret).mockRejectedValue(new Error('KMS error'));

    await secrets.request('/proj-1/secrets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'API_KEY', value: 'test' }),
    });

    expect(recordSecretsOperation).toHaveBeenCalledWith('create', 'error');
  });
});
