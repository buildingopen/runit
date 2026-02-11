/**
 * E2E Tests for Projects API
 *
 * Tests the full project lifecycle including:
 * - Create, get, list, delete projects
 * - Project with secrets
 * - Project deployment flow (with mocked Modal)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  shouldRunE2ETests,
  E2E_SKIP_MESSAGE,
  setupE2EHooks,
  getTestServiceSupabaseClient,
  createTestUser,
  registerProjectForCleanup,
  generateTestProjectName,
  createTestZipBase64,
  cleanupProject,
} from './setup';

// Skip all tests if E2E is not configured
const describeE2E = shouldRunE2ETests() ? describe : describe.skip;

// Setup lifecycle hooks
setupE2EHooks();

describeE2E('Projects E2E', () => {
  let testUser: { id: string; email: string };

  beforeEach(async () => {
    testUser = await createTestUser('projects-e2e');
  });

  describe('Project Lifecycle', () => {
    it('should create a new project', async () => {
      const supabase = getTestServiceSupabaseClient();
      const projectName = generateTestProjectName('create-test');

      // Create project directly in database (simulating API behavior)
      const { data: project, error } = await supabase
        .from('projects')
        .insert({
          owner_id: testUser.id,
          name: projectName,
          slug: projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          status: 'draft',
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(project).not.toBeNull();
      expect(project!.name).toBe(projectName);
      expect(project!.owner_id).toBe(testUser.id);
      expect(project!.status).toBe('draft');

      registerProjectForCleanup(project!.id);
    });

    it('should get a project by ID', async () => {
      const supabase = getTestServiceSupabaseClient();
      const projectName = generateTestProjectName('get-test');

      // Create project
      const { data: created } = await supabase
        .from('projects')
        .insert({
          owner_id: testUser.id,
          name: projectName,
          slug: projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          status: 'draft',
        })
        .select()
        .single();

      registerProjectForCleanup(created!.id);

      // Get project by ID
      const { data: project, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', created!.id)
        .single();

      expect(error).toBeNull();
      expect(project).not.toBeNull();
      expect(project!.id).toBe(created!.id);
      expect(project!.name).toBe(projectName);
    });

    it('should list projects for a user', async () => {
      const supabase = getTestServiceSupabaseClient();
      const projectName1 = generateTestProjectName('list-test-1');
      const projectName2 = generateTestProjectName('list-test-2');

      // Create two projects
      const { data: project1 } = await supabase
        .from('projects')
        .insert({
          owner_id: testUser.id,
          name: projectName1,
          slug: projectName1.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          status: 'draft',
        })
        .select()
        .single();

      const { data: project2 } = await supabase
        .from('projects')
        .insert({
          owner_id: testUser.id,
          name: projectName2,
          slug: projectName2.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          status: 'draft',
        })
        .select()
        .single();

      registerProjectForCleanup(project1!.id);
      registerProjectForCleanup(project2!.id);

      // List projects for user
      const { data: projects, error } = await supabase
        .from('projects')
        .select('*')
        .eq('owner_id', testUser.id)
        .order('created_at', { ascending: false });

      expect(error).toBeNull();
      expect(projects).not.toBeNull();
      expect(projects!.length).toBeGreaterThanOrEqual(2);

      const projectIds = projects!.map((p) => p.id);
      expect(projectIds).toContain(project1!.id);
      expect(projectIds).toContain(project2!.id);
    });

    it('should delete a project', async () => {
      const supabase = getTestServiceSupabaseClient();
      const projectName = generateTestProjectName('delete-test');

      // Create project
      const { data: created } = await supabase
        .from('projects')
        .insert({
          owner_id: testUser.id,
          name: projectName,
          slug: projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          status: 'draft',
        })
        .select()
        .single();

      const projectId = created!.id;

      // Verify project exists
      const { data: before } = await supabase
        .from('projects')
        .select('id')
        .eq('id', projectId)
        .single();

      expect(before).not.toBeNull();

      // Delete project
      const { error } = await supabase.from('projects').delete().eq('id', projectId);

      expect(error).toBeNull();

      // Verify project is deleted
      const { data: after } = await supabase
        .from('projects')
        .select('id')
        .eq('id', projectId)
        .single();

      expect(after).toBeNull();
    });

    it('should update project status', async () => {
      const supabase = getTestServiceSupabaseClient();
      const projectName = generateTestProjectName('status-test');

      // Create project
      const { data: created } = await supabase
        .from('projects')
        .insert({
          owner_id: testUser.id,
          name: projectName,
          slug: projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          status: 'draft',
        })
        .select()
        .single();

      registerProjectForCleanup(created!.id);

      // Update status
      const { data: updated, error } = await supabase
        .from('projects')
        .update({
          status: 'live',
          deployed_at: new Date().toISOString(),
          runtime_url: 'https://test.modal.run',
        })
        .eq('id', created!.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(updated!.status).toBe('live');
      expect(updated!.deployed_at).not.toBeNull();
      expect(updated!.runtime_url).toBe('https://test.modal.run');
    });
  });

  describe('Project with Versions', () => {
    it('should create a project version', async () => {
      const supabase = getTestServiceSupabaseClient();
      const projectName = generateTestProjectName('version-test');

      // Create project
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

      registerProjectForCleanup(project!.id);

      // Create version
      const { data: version, error } = await supabase
        .from('project_versions')
        .insert({
          project_id: project!.id,
          version_hash: 'abc123def456',
          code_bundle_ref: createTestZipBase64(),
          openapi: { openapi: '3.0.0', info: { title: 'Test', version: '1.0' } },
          endpoints: [{ id: 'ep-1', path: '/hello', method: 'GET' }],
          entrypoint: 'main.py',
          detected_env_vars: ['API_KEY'],
          status: 'ready',
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(version).not.toBeNull();
      expect(version!.project_id).toBe(project!.id);
      expect(version!.version_hash).toBe('abc123def456');
      expect(version!.entrypoint).toBe('main.py');
      expect(version!.detected_env_vars).toContain('API_KEY');
    });

    it('should list versions for a project', async () => {
      const supabase = getTestServiceSupabaseClient();
      const projectName = generateTestProjectName('versions-list-test');

      // Create project
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

      registerProjectForCleanup(project!.id);

      // Create multiple versions
      await supabase.from('project_versions').insert({
        project_id: project!.id,
        version_hash: 'version-1',
        code_bundle_ref: 'bundle-1',
        status: 'ready',
      });

      await supabase.from('project_versions').insert({
        project_id: project!.id,
        version_hash: 'version-2',
        code_bundle_ref: 'bundle-2',
        status: 'ready',
      });

      // List versions
      const { data: versions, error } = await supabase
        .from('project_versions')
        .select('*')
        .eq('project_id', project!.id)
        .order('created_at', { ascending: false });

      expect(error).toBeNull();
      expect(versions).not.toBeNull();
      expect(versions!.length).toBe(2);
    });
  });

  describe('Project with Secrets', () => {
    it('should create a project and add secrets', async () => {
      const supabase = getTestServiceSupabaseClient();
      const projectName = generateTestProjectName('secrets-test');

      // Create project
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

      registerProjectForCleanup(project!.id);

      // Add secrets
      const { data: secret, error } = await supabase
        .from('secrets')
        .insert({
          project_id: project!.id,
          key: 'API_KEY',
          encrypted_value: 'encrypted-test-value',
          created_by: testUser.id,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(secret).not.toBeNull();
      expect(secret!.key).toBe('API_KEY');
      expect(secret!.project_id).toBe(project!.id);
    });

    it('should list secrets for a project', async () => {
      const supabase = getTestServiceSupabaseClient();
      const projectName = generateTestProjectName('secrets-list-test');

      // Create project
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

      registerProjectForCleanup(project!.id);

      // Add multiple secrets
      await supabase.from('secrets').insert({
        project_id: project!.id,
        key: 'API_KEY',
        encrypted_value: 'encrypted-1',
        created_by: testUser.id,
      });

      await supabase.from('secrets').insert({
        project_id: project!.id,
        key: 'DATABASE_URL',
        encrypted_value: 'encrypted-2',
        created_by: testUser.id,
      });

      // List secrets
      const { data: secrets, error } = await supabase
        .from('secrets')
        .select('*')
        .eq('project_id', project!.id)
        .order('key');

      expect(error).toBeNull();
      expect(secrets).not.toBeNull();
      expect(secrets!.length).toBe(2);
      expect(secrets![0].key).toBe('API_KEY');
      expect(secrets![1].key).toBe('DATABASE_URL');
    });

    it('should delete project secrets when project is deleted', async () => {
      const supabase = getTestServiceSupabaseClient();
      const projectName = generateTestProjectName('secrets-cascade-test');

      // Create project
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

      const projectId = project!.id;

      // Add secret
      await supabase.from('secrets').insert({
        project_id: projectId,
        key: 'API_KEY',
        encrypted_value: 'encrypted-value',
        created_by: testUser.id,
      });

      // Verify secret exists
      const { data: before } = await supabase
        .from('secrets')
        .select('*')
        .eq('project_id', projectId);

      expect(before!.length).toBe(1);

      // Delete project (using cleanup helper which handles cascade)
      await cleanupProject(projectId);

      // Verify secrets are deleted
      const { data: after } = await supabase
        .from('secrets')
        .select('*')
        .eq('project_id', projectId);

      expect(after!.length).toBe(0);
    });
  });

  describe('Project Deployment Flow (Mocked Modal)', () => {
    it('should update project status through deployment lifecycle', async () => {
      const supabase = getTestServiceSupabaseClient();
      const projectName = generateTestProjectName('deploy-flow-test');

      // Create project
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

      registerProjectForCleanup(project!.id);

      // Create a version
      await supabase.from('project_versions').insert({
        project_id: project!.id,
        version_hash: 'deploy-version-1',
        code_bundle_ref: createTestZipBase64(),
        entrypoint: 'main.py',
        status: 'ready',
      });

      // Simulate deployment start
      const { data: deploying } = await supabase
        .from('projects')
        .update({ status: 'deploying', deploy_error: null })
        .eq('id', project!.id)
        .select()
        .single();

      expect(deploying!.status).toBe('deploying');

      // Simulate successful deployment
      const deployedAt = new Date().toISOString();
      const { data: deployed } = await supabase
        .from('projects')
        .update({
          status: 'live',
          deployed_at: deployedAt,
          runtime_url: 'https://test-project.modal.run',
        })
        .eq('id', project!.id)
        .select()
        .single();

      expect(deployed!.status).toBe('live');
      expect(deployed!.deployed_at).toBe(deployedAt);
      expect(deployed!.runtime_url).toBe('https://test-project.modal.run');
    });

    it('should handle failed deployment', async () => {
      const supabase = getTestServiceSupabaseClient();
      const projectName = generateTestProjectName('deploy-fail-test');

      // Create project
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

      registerProjectForCleanup(project!.id);

      // Simulate deployment start
      await supabase
        .from('projects')
        .update({ status: 'deploying' })
        .eq('id', project!.id);

      // Simulate failed deployment
      const { data: failed } = await supabase
        .from('projects')
        .update({
          status: 'failed',
          deploy_error: 'Modal deployment failed: Container build error',
        })
        .eq('id', project!.id)
        .select()
        .single();

      expect(failed!.status).toBe('failed');
      expect(failed!.deploy_error).toContain('Container build error');
    });

    it('should track deployment with version and endpoints', async () => {
      const supabase = getTestServiceSupabaseClient();
      const projectName = generateTestProjectName('deploy-full-test');

      // Create project
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

      registerProjectForCleanup(project!.id);

      // Create version with endpoints
      const endpoints = [
        { id: 'ep-1', path: '/hello', method: 'GET', summary: 'Hello endpoint' },
        { id: 'ep-2', path: '/data', method: 'POST', summary: 'Data endpoint' },
      ];

      const { data: version } = await supabase
        .from('project_versions')
        .insert({
          project_id: project!.id,
          version_hash: 'full-deploy-v1',
          code_bundle_ref: createTestZipBase64(),
          openapi: {
            openapi: '3.0.0',
            info: { title: 'Test API', version: '1.0.0' },
            paths: {
              '/hello': { get: { summary: 'Hello endpoint' } },
              '/data': { post: { summary: 'Data endpoint' } },
            },
          },
          endpoints,
          entrypoint: 'app.py',
          detected_env_vars: ['API_KEY', 'DATABASE_URL'],
          status: 'ready',
        })
        .select()
        .single();

      // Deploy
      await supabase
        .from('projects')
        .update({
          status: 'live',
          deployed_at: new Date().toISOString(),
          runtime_url: 'https://test-full.modal.run',
        })
        .eq('id', project!.id);

      // Verify full deployment state
      const { data: deployed } = await supabase
        .from('projects')
        .select('*, project_versions(*)')
        .eq('id', project!.id)
        .single();

      expect(deployed!.status).toBe('live');
      expect(deployed!.project_versions.length).toBeGreaterThanOrEqual(1);

      const latestVersion = deployed!.project_versions[0];
      expect(latestVersion.endpoints.length).toBe(2);
      expect(latestVersion.detected_env_vars).toContain('API_KEY');
    });
  });
});

// Log skip message if not running
if (!shouldRunE2ETests()) {
  console.log(E2E_SKIP_MESSAGE);
}
