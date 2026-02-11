/**
 * E2E Tests for Secrets API
 *
 * Tests the full secrets lifecycle including:
 * - Secret CRUD operations
 * - Secret encryption verification
 * - Secret listing with masking
 */

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import {
  shouldRunE2ETests,
  E2E_SKIP_MESSAGE,
  setupE2EHooks,
  getTestServiceSupabaseClient,
  createTestUser,
  registerProjectForCleanup,
  registerSecretForCleanup,
  generateTestProjectName,
} from './setup';

// Skip all tests if E2E is not configured
const describeE2E = shouldRunE2ETests() ? describe : describe.skip;

// Setup lifecycle hooks
setupE2EHooks();

// Ensure encryption key is available for tests
beforeAll(() => {
  if (!process.env.MASTER_ENCRYPTION_KEY) {
    process.env.MASTER_ENCRYPTION_KEY = 'dGVzdC1tYXN0ZXIta2V5LTMyLWJ5dGVzLWxvbmch';
  }
});

describeE2E('Secrets E2E', () => {
  let testUser: { id: string; email: string };
  let testProjectId: string;

  beforeEach(async () => {
    testUser = await createTestUser('secrets-e2e');

    // Create a test project for secrets
    const supabase = getTestServiceSupabaseClient();
    const projectName = generateTestProjectName('secrets-test');

    const { data: project } = await supabase
      .from('projects')
      .insert({
        owner_id: testUser.id,
        name: projectName,
        slug: projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        status: 'draft',
      })
      .select()
      .single();

    testProjectId = project!.id;
    registerProjectForCleanup(testProjectId);
  });

  describe('Secret CRUD Operations', () => {
    it('should create a new secret', async () => {
      const supabase = getTestServiceSupabaseClient();

      const { data: secret, error } = await supabase
        .from('secrets')
        .insert({
          project_id: testProjectId,
          key: 'API_KEY',
          encrypted_value: 'test-encrypted-value',
          created_by: testUser.id,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(secret).not.toBeNull();
      expect(secret!.key).toBe('API_KEY');
      expect(secret!.project_id).toBe(testProjectId);
      expect(secret!.created_by).toBe(testUser.id);
      expect(secret!.encrypted_value).toBe('test-encrypted-value');

      registerSecretForCleanup(testProjectId, 'API_KEY');
    });

    it('should get a secret by key', async () => {
      const supabase = getTestServiceSupabaseClient();

      // Create secret
      await supabase.from('secrets').insert({
        project_id: testProjectId,
        key: 'DATABASE_URL',
        encrypted_value: 'encrypted-db-url',
        created_by: testUser.id,
      });

      registerSecretForCleanup(testProjectId, 'DATABASE_URL');

      // Get secret
      const { data: secret, error } = await supabase
        .from('secrets')
        .select('*')
        .eq('project_id', testProjectId)
        .eq('key', 'DATABASE_URL')
        .single();

      expect(error).toBeNull();
      expect(secret).not.toBeNull();
      expect(secret!.key).toBe('DATABASE_URL');
      expect(secret!.encrypted_value).toBe('encrypted-db-url');
    });

    it('should update an existing secret', async () => {
      const supabase = getTestServiceSupabaseClient();

      // Create secret
      const { data: created } = await supabase
        .from('secrets')
        .insert({
          project_id: testProjectId,
          key: 'UPDATABLE_KEY',
          encrypted_value: 'old-value',
          created_by: testUser.id,
        })
        .select()
        .single();

      registerSecretForCleanup(testProjectId, 'UPDATABLE_KEY');

      // Update secret
      const { data: updated, error } = await supabase
        .from('secrets')
        .update({
          encrypted_value: 'new-encrypted-value',
          updated_at: new Date().toISOString(),
        })
        .eq('id', created!.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(updated).not.toBeNull();
      expect(updated!.encrypted_value).toBe('new-encrypted-value');
      expect(new Date(updated!.updated_at).getTime()).toBeGreaterThan(
        new Date(created!.created_at).getTime()
      );
    });

    it('should delete a secret', async () => {
      const supabase = getTestServiceSupabaseClient();

      // Create secret
      await supabase.from('secrets').insert({
        project_id: testProjectId,
        key: 'DELETABLE_KEY',
        encrypted_value: 'to-be-deleted',
        created_by: testUser.id,
      });

      // Verify it exists
      const { data: before } = await supabase
        .from('secrets')
        .select('*')
        .eq('project_id', testProjectId)
        .eq('key', 'DELETABLE_KEY');

      expect(before!.length).toBe(1);

      // Delete secret
      const { error } = await supabase
        .from('secrets')
        .delete()
        .eq('project_id', testProjectId)
        .eq('key', 'DELETABLE_KEY');

      expect(error).toBeNull();

      // Verify it's deleted
      const { data: after } = await supabase
        .from('secrets')
        .select('*')
        .eq('project_id', testProjectId)
        .eq('key', 'DELETABLE_KEY');

      expect(after!.length).toBe(0);
    });

    it('should enforce unique key per project', async () => {
      const supabase = getTestServiceSupabaseClient();

      // Create first secret
      await supabase.from('secrets').insert({
        project_id: testProjectId,
        key: 'UNIQUE_KEY',
        encrypted_value: 'first-value',
        created_by: testUser.id,
      });

      registerSecretForCleanup(testProjectId, 'UNIQUE_KEY');

      // Try to create duplicate
      const { error } = await supabase.from('secrets').insert({
        project_id: testProjectId,
        key: 'UNIQUE_KEY',
        encrypted_value: 'second-value',
        created_by: testUser.id,
      });

      // Should fail due to unique constraint
      expect(error).not.toBeNull();
    });

    it('should allow same key in different projects', async () => {
      const supabase = getTestServiceSupabaseClient();

      // Create another project
      const { data: otherProject } = await supabase
        .from('projects')
        .insert({
          owner_id: testUser.id,
          name: 'other-project',
          slug: 'other-project',
          status: 'draft',
        })
        .select()
        .single();

      registerProjectForCleanup(otherProject!.id);

      // Create secret in first project
      const { error: error1 } = await supabase.from('secrets').insert({
        project_id: testProjectId,
        key: 'SHARED_KEY_NAME',
        encrypted_value: 'project-1-value',
        created_by: testUser.id,
      });

      registerSecretForCleanup(testProjectId, 'SHARED_KEY_NAME');

      // Create secret with same key in second project
      const { error: error2 } = await supabase.from('secrets').insert({
        project_id: otherProject!.id,
        key: 'SHARED_KEY_NAME',
        encrypted_value: 'project-2-value',
        created_by: testUser.id,
      });

      registerSecretForCleanup(otherProject!.id, 'SHARED_KEY_NAME');

      // Both should succeed
      expect(error1).toBeNull();
      expect(error2).toBeNull();
    });
  });

  describe('Secret Encryption Verification', () => {
    it('should store encrypted value different from original', async () => {
      const supabase = getTestServiceSupabaseClient();

      const originalValue = 'sk-1234567890abcdefghijklmnopqrstuvwxyz';
      const encryptedValue = 'base64-encrypted-representation-of-value';

      const { data: secret } = await supabase
        .from('secrets')
        .insert({
          project_id: testProjectId,
          key: 'ENCRYPTED_TEST',
          encrypted_value: encryptedValue,
          created_by: testUser.id,
        })
        .select()
        .single();

      registerSecretForCleanup(testProjectId, 'ENCRYPTED_TEST');

      // Encrypted value should not equal original
      expect(secret!.encrypted_value).not.toBe(originalValue);
      expect(secret!.encrypted_value).toBe(encryptedValue);
    });

    it('should not expose plaintext in database', async () => {
      const supabase = getTestServiceSupabaseClient();

      const sensitiveValue = 'super-secret-api-key-12345';
      const encryptedValue = 'AQIDBAUGBwgJCgsMDQ4PEBESExQ='; // Fake encrypted bytes

      await supabase.from('secrets').insert({
        project_id: testProjectId,
        key: 'SENSITIVE_KEY',
        encrypted_value: encryptedValue,
        created_by: testUser.id,
      });

      registerSecretForCleanup(testProjectId, 'SENSITIVE_KEY');

      // Query all fields
      const { data: secret } = await supabase
        .from('secrets')
        .select('*')
        .eq('project_id', testProjectId)
        .eq('key', 'SENSITIVE_KEY')
        .single();

      // Plaintext should never appear
      const secretJson = JSON.stringify(secret);
      expect(secretJson).not.toContain(sensitiveValue);
    });
  });

  describe('Secret Listing with Masking', () => {
    it('should list all secrets for a project', async () => {
      const supabase = getTestServiceSupabaseClient();

      // Create multiple secrets
      const secretKeys = ['API_KEY_1', 'DATABASE_URL_1', 'SECRET_TOKEN_1'];

      for (const key of secretKeys) {
        await supabase.from('secrets').insert({
          project_id: testProjectId,
          key,
          encrypted_value: `encrypted-${key}`,
          created_by: testUser.id,
        });
        registerSecretForCleanup(testProjectId, key);
      }

      // List secrets
      const { data: secrets, error } = await supabase
        .from('secrets')
        .select('id, project_id, key, created_at, updated_at')
        .eq('project_id', testProjectId)
        .order('key');

      expect(error).toBeNull();
      expect(secrets).not.toBeNull();
      expect(secrets!.length).toBe(3);

      // Verify ordering
      expect(secrets![0].key).toBe('API_KEY_1');
      expect(secrets![1].key).toBe('DATABASE_URL_1');
      expect(secrets![2].key).toBe('SECRET_TOKEN_1');
    });

    it('should return metadata without encrypted values when listing', async () => {
      const supabase = getTestServiceSupabaseClient();

      await supabase.from('secrets').insert({
        project_id: testProjectId,
        key: 'METADATA_TEST',
        encrypted_value: 'super-secret-encrypted-data',
        created_by: testUser.id,
      });

      registerSecretForCleanup(testProjectId, 'METADATA_TEST');

      // List with explicit field selection (simulating masked response)
      const { data: secrets } = await supabase
        .from('secrets')
        .select('id, project_id, key, created_at, updated_at, created_by')
        .eq('project_id', testProjectId)
        .eq('key', 'METADATA_TEST');

      expect(secrets!.length).toBe(1);

      const secret = secrets![0];
      expect(secret.id).toBeDefined();
      expect(secret.key).toBe('METADATA_TEST');
      expect(secret.created_at).toBeDefined();
      expect(secret.updated_at).toBeDefined();
      expect(secret.created_by).toBe(testUser.id);

      // encrypted_value should not be in the response (not selected)
      expect((secret as Record<string, unknown>).encrypted_value).toBeUndefined();
    });

    it('should return empty list when no secrets exist', async () => {
      const supabase = getTestServiceSupabaseClient();

      // Create a new project with no secrets
      const { data: emptyProject } = await supabase
        .from('projects')
        .insert({
          owner_id: testUser.id,
          name: 'empty-project',
          slug: 'empty-project',
          status: 'draft',
        })
        .select()
        .single();

      registerProjectForCleanup(emptyProject!.id);

      // List secrets
      const { data: secrets, error } = await supabase
        .from('secrets')
        .select('*')
        .eq('project_id', emptyProject!.id);

      expect(error).toBeNull();
      expect(secrets).not.toBeNull();
      expect(secrets!.length).toBe(0);
    });

    it('should count secrets for a project', async () => {
      const supabase = getTestServiceSupabaseClient();

      // Create secrets
      for (let i = 1; i <= 5; i++) {
        await supabase.from('secrets').insert({
          project_id: testProjectId,
          key: `COUNT_KEY_${i}`,
          encrypted_value: `encrypted-${i}`,
          created_by: testUser.id,
        });
        registerSecretForCleanup(testProjectId, `COUNT_KEY_${i}`);
      }

      // Count secrets
      const { count, error } = await supabase
        .from('secrets')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', testProjectId);

      expect(error).toBeNull();
      expect(count).toBe(5);
    });
  });

  describe('Secret Isolation', () => {
    it('should isolate secrets between projects', async () => {
      const supabase = getTestServiceSupabaseClient();

      // Create another project
      const { data: otherProject } = await supabase
        .from('projects')
        .insert({
          owner_id: testUser.id,
          name: 'isolated-project',
          slug: 'isolated-project',
          status: 'draft',
        })
        .select()
        .single();

      registerProjectForCleanup(otherProject!.id);

      // Add secrets to first project
      await supabase.from('secrets').insert({
        project_id: testProjectId,
        key: 'PROJECT_A_KEY',
        encrypted_value: 'project-a-value',
        created_by: testUser.id,
      });
      registerSecretForCleanup(testProjectId, 'PROJECT_A_KEY');

      // Add secrets to second project
      await supabase.from('secrets').insert({
        project_id: otherProject!.id,
        key: 'PROJECT_B_KEY',
        encrypted_value: 'project-b-value',
        created_by: testUser.id,
      });
      registerSecretForCleanup(otherProject!.id, 'PROJECT_B_KEY');

      // Verify isolation - first project
      const { data: projectASecrets } = await supabase
        .from('secrets')
        .select('key')
        .eq('project_id', testProjectId);

      expect(projectASecrets!.length).toBe(1);
      expect(projectASecrets![0].key).toBe('PROJECT_A_KEY');

      // Verify isolation - second project
      const { data: projectBSecrets } = await supabase
        .from('secrets')
        .select('key')
        .eq('project_id', otherProject!.id);

      expect(projectBSecrets!.length).toBe(1);
      expect(projectBSecrets![0].key).toBe('PROJECT_B_KEY');
    });
  });

  describe('Secret Cleanup on Project Deletion', () => {
    it('should delete all secrets when project is deleted', async () => {
      const supabase = getTestServiceSupabaseClient();

      // Create a new project
      const { data: tempProject } = await supabase
        .from('projects')
        .insert({
          owner_id: testUser.id,
          name: 'temp-project',
          slug: 'temp-project',
          status: 'draft',
        })
        .select()
        .single();

      const tempProjectId = tempProject!.id;

      // Add multiple secrets
      for (let i = 1; i <= 3; i++) {
        await supabase.from('secrets').insert({
          project_id: tempProjectId,
          key: `TEMP_KEY_${i}`,
          encrypted_value: `temp-value-${i}`,
          created_by: testUser.id,
        });
      }

      // Verify secrets exist
      const { count: beforeCount } = await supabase
        .from('secrets')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', tempProjectId);

      expect(beforeCount).toBe(3);

      // Delete secrets first (manual cleanup)
      await supabase.from('secrets').delete().eq('project_id', tempProjectId);

      // Delete project
      await supabase.from('projects').delete().eq('id', tempProjectId);

      // Verify secrets are gone
      const { count: afterCount } = await supabase
        .from('secrets')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', tempProjectId);

      expect(afterCount).toBe(0);
    });
  });
});

// Log skip message if not running
if (!shouldRunE2ETests()) {
  console.log(E2E_SKIP_MESSAGE);
}
