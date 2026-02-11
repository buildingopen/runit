/**
 * E2E Test Setup
 *
 * Provides test Supabase client setup, user creation helpers,
 * and cleanup utilities for end-to-end testing.
 *
 * Tests are skipped if SUPABASE_URL_TEST is not set (for CI without secrets).
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { beforeAll, afterAll, beforeEach } from 'vitest';

// ============================================================================
// Configuration
// ============================================================================

const SUPABASE_URL_TEST = process.env.SUPABASE_URL_TEST;
const SUPABASE_ANON_KEY_TEST = process.env.SUPABASE_ANON_KEY_TEST;
const SUPABASE_SERVICE_ROLE_KEY_TEST = process.env.SUPABASE_SERVICE_ROLE_KEY_TEST;

/**
 * Check if E2E tests should run
 * Tests are skipped if test Supabase is not configured
 */
export function shouldRunE2ETests(): boolean {
  return !!(SUPABASE_URL_TEST && SUPABASE_ANON_KEY_TEST && SUPABASE_SERVICE_ROLE_KEY_TEST);
}

/**
 * Skip message for when E2E tests are disabled
 */
export const E2E_SKIP_MESSAGE = 'E2E tests skipped: SUPABASE_URL_TEST not configured';

// ============================================================================
// Test Supabase Clients
// ============================================================================

let testAnonClient: SupabaseClient | null = null;
let testServiceClient: SupabaseClient | null = null;

/**
 * Get the anonymous Supabase client for tests
 * Used for operations that respect RLS
 */
export function getTestSupabaseClient(): SupabaseClient {
  if (!SUPABASE_URL_TEST || !SUPABASE_ANON_KEY_TEST) {
    throw new Error('Test Supabase is not configured. Set SUPABASE_URL_TEST and SUPABASE_ANON_KEY_TEST.');
  }

  if (!testAnonClient) {
    testAnonClient = createClient(SUPABASE_URL_TEST, SUPABASE_ANON_KEY_TEST, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
  }

  return testAnonClient;
}

/**
 * Get the service role Supabase client for tests
 * Used for admin operations that bypass RLS (cleanup, seeding, etc.)
 */
export function getTestServiceSupabaseClient(): SupabaseClient {
  if (!SUPABASE_URL_TEST || !SUPABASE_SERVICE_ROLE_KEY_TEST) {
    throw new Error('Test Supabase service role is not configured. Set SUPABASE_URL_TEST and SUPABASE_SERVICE_ROLE_KEY_TEST.');
  }

  if (!testServiceClient) {
    testServiceClient = createClient(SUPABASE_URL_TEST, SUPABASE_SERVICE_ROLE_KEY_TEST, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
  }

  return testServiceClient;
}

// ============================================================================
// Test User Helpers
// ============================================================================

export interface TestUser {
  id: string;
  email: string;
  password: string;
}

/**
 * Create a test user for E2E testing
 * Returns user credentials that can be used for authentication
 */
export async function createTestUser(prefix: string = 'e2e'): Promise<TestUser> {
  const uniqueId = uuidv4().substring(0, 8);
  const email = `${prefix}-${uniqueId}@test.local`;
  const password = `TestPassword123!${uniqueId}`;
  const id = uuidv4();

  // For now, we use a simplified approach with just an ID
  // In a full implementation, you would create the user via Supabase Auth Admin API
  return {
    id,
    email,
    password,
  };
}

/**
 * Get a mock JWT token for test user
 * In a real implementation, this would authenticate against Supabase
 */
export function getMockAuthToken(userId: string): string {
  // For E2E tests, we may need to create real tokens or use service role
  // This is a placeholder that should be replaced with actual auth flow
  return `test-token-${userId}`;
}

// ============================================================================
// Test Data Cleanup
// ============================================================================

/**
 * Track test data for cleanup
 */
interface TestData {
  projectIds: string[];
  secretKeys: Map<string, string[]>; // projectId -> secretKeys[]
  userIds: string[];
}

const testData: TestData = {
  projectIds: [],
  secretKeys: new Map(),
  userIds: [],
};

/**
 * Register a project for cleanup after tests
 */
export function registerProjectForCleanup(projectId: string): void {
  testData.projectIds.push(projectId);
}

/**
 * Register a secret for cleanup after tests
 */
export function registerSecretForCleanup(projectId: string, key: string): void {
  const keys = testData.secretKeys.get(projectId) || [];
  keys.push(key);
  testData.secretKeys.set(projectId, keys);
}

/**
 * Register a user for cleanup after tests
 */
export function registerUserForCleanup(userId: string): void {
  testData.userIds.push(userId);
}

/**
 * Clean up all test data
 * Should be called in afterAll or afterEach hooks
 */
export async function cleanupTestData(): Promise<void> {
  if (!shouldRunE2ETests()) {
    return;
  }

  const supabase = getTestServiceSupabaseClient();

  // Clean up secrets first (due to foreign key constraints)
  const secretEntries = Array.from(testData.secretKeys.entries());
  for (const entry of secretEntries) {
    const projectId = entry[0];
    const keys = entry[1];
    for (const key of keys) {
      try {
        await supabase.from('secrets').delete().eq('project_id', projectId).eq('key', key);
      } catch (error) {
        console.warn(`Failed to cleanup secret ${key} for project ${projectId}:`, error);
      }
    }
  }
  testData.secretKeys.clear();

  // Clean up projects (this should cascade to versions, runs, etc.)
  for (const projectId of testData.projectIds) {
    try {
      // Delete related data first
      await supabase.from('project_versions').delete().eq('project_id', projectId);
      await supabase.from('runs').delete().eq('project_id', projectId);
      await supabase.from('secrets').delete().eq('project_id', projectId);
      await supabase.from('share_links').delete().eq('project_id', projectId);
      await supabase.from('contexts').delete().eq('project_id', projectId);
      // Finally delete the project
      await supabase.from('projects').delete().eq('id', projectId);
    } catch (error) {
      console.warn(`Failed to cleanup project ${projectId}:`, error);
    }
  }
  testData.projectIds.length = 0;

  // Note: User cleanup would typically be done via Supabase Auth Admin API
  testData.userIds.length = 0;
}

/**
 * Clean up all test data for a specific project
 */
export async function cleanupProject(projectId: string): Promise<void> {
  if (!shouldRunE2ETests()) {
    return;
  }

  const supabase = getTestServiceSupabaseClient();

  try {
    // Delete related data first
    await supabase.from('project_versions').delete().eq('project_id', projectId);
    await supabase.from('runs').delete().eq('project_id', projectId);
    await supabase.from('secrets').delete().eq('project_id', projectId);
    await supabase.from('share_links').delete().eq('project_id', projectId);
    await supabase.from('contexts').delete().eq('project_id', projectId);
    // Finally delete the project
    await supabase.from('projects').delete().eq('id', projectId);
  } catch (error) {
    console.warn(`Failed to cleanup project ${projectId}:`, error);
  }
}

// ============================================================================
// Test Lifecycle Hooks
// ============================================================================

/**
 * Setup hooks for E2E test suites
 * Call this in your test file to set up proper lifecycle management
 */
export function setupE2EHooks(): void {
  beforeAll(async () => {
    if (!shouldRunE2ETests()) {
      console.log(E2E_SKIP_MESSAGE);
      return;
    }

    // Ensure test environment variables are set for the control-plane code
    if (SUPABASE_URL_TEST) {
      process.env.SUPABASE_URL = SUPABASE_URL_TEST;
    }
    if (SUPABASE_ANON_KEY_TEST) {
      process.env.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY_TEST;
    }
    if (SUPABASE_SERVICE_ROLE_KEY_TEST) {
      process.env.SUPABASE_SERVICE_ROLE_KEY = SUPABASE_SERVICE_ROLE_KEY_TEST;
    }

    // Ensure encryption key is set for tests
    if (!process.env.MASTER_ENCRYPTION_KEY) {
      process.env.MASTER_ENCRYPTION_KEY = 'dGVzdC1tYXN0ZXIta2V5LTMyLWJ5dGVzLWxvbmch';
    }

    // Test connectivity
    const supabase = getTestServiceSupabaseClient();
    const { error } = await supabase.from('projects').select('id').limit(1);
    if (error) {
      console.error('Failed to connect to test Supabase:', error.message);
      throw new Error(`E2E test setup failed: ${error.message}`);
    }

    console.log('E2E test setup complete');
  });

  afterAll(async () => {
    if (!shouldRunE2ETests()) {
      return;
    }

    await cleanupTestData();
    console.log('E2E test cleanup complete');
  });
}

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Generate a unique test project name
 */
export function generateTestProjectName(prefix: string = 'e2e-test'): string {
  const uniqueId = uuidv4().substring(0, 8);
  return `${prefix}-${uniqueId}`;
}

/**
 * Wait for a condition to be true (useful for async operations)
 */
export async function waitFor(
  condition: () => Promise<boolean>,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const { timeout = 5000, interval = 100 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`Condition not met within ${timeout}ms`);
}

/**
 * Create a minimal valid ZIP file as base64 for testing
 * This is an empty ZIP file that passes validation
 */
export function createTestZipBase64(): string {
  // Minimal valid ZIP file bytes (empty archive)
  const zipBytes = new Uint8Array([
    0x50, 0x4b, 0x05, 0x06, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00
  ]);
  return Buffer.from(zipBytes).toString('base64');
}
