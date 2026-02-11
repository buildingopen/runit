# E2E Tests for Control Plane

End-to-end tests that verify the control plane functionality against a real Supabase instance.

## Overview

These tests validate:
- **Projects**: Full project lifecycle (create, get, list, delete)
- **Secrets**: Secret CRUD operations, encryption verification, masking
- **Deployment**: Deployment flow with mocked Modal

## Prerequisites

1. **Separate Test Supabase Project**: Create a dedicated Supabase project for testing
   - Do NOT use your production or development project
   - E2E tests will create and delete data

2. **Environment Variables**: Set the following in your `.env` file:
   ```bash
   SUPABASE_URL_TEST=https://your-test-project.supabase.co
   SUPABASE_ANON_KEY_TEST=your-test-anon-key
   SUPABASE_SERVICE_ROLE_KEY_TEST=your-test-service-role-key
   ```

3. **Encryption Key**: For secret encryption tests:
   ```bash
   MASTER_ENCRYPTION_KEY=your-32-byte-base64-encoded-key
   ```
   Generate with: `openssl rand -base64 32`

## Running Tests

### Run E2E Tests Locally

```bash
# From the control-plane directory
npm run test:e2e
```

### Run E2E Tests in CI

```bash
npm run test:e2e:ci
```

This uses verbose output and no color for CI environments.

### Run Unit Tests Only

```bash
npm run test
```

## Test Configuration

### vitest.config.e2e.ts

The E2E test configuration includes:
- **Longer timeouts**: 30 seconds for database operations
- **Sequential execution**: Tests run one at a time to avoid conflicts
- **Retry**: Failed tests retry once (for network flakiness)
- **Single fork**: All tests run in one process for database consistency

## Test Structure

```
tests/e2e/
├── setup.ts                  # Test helpers, cleanup, lifecycle hooks
├── projects.e2e.test.ts      # Project lifecycle tests
├── secrets.e2e.test.ts       # Secrets CRUD tests
└── README.md                 # This file
```

## Setup Module (setup.ts)

The setup module provides:

### Test Clients
- `getTestSupabaseClient()` - Anonymous client (respects RLS)
- `getTestServiceSupabaseClient()` - Service role client (bypasses RLS)

### Test Helpers
- `createTestUser()` - Create a test user identity
- `generateTestProjectName()` - Generate unique project names
- `createTestZipBase64()` - Create minimal valid ZIP for uploads

### Cleanup
- `registerProjectForCleanup(projectId)` - Track projects for cleanup
- `registerSecretForCleanup(projectId, key)` - Track secrets for cleanup
- `cleanupTestData()` - Clean all registered test data
- `cleanupProject(projectId)` - Clean a specific project

### Lifecycle
- `setupE2EHooks()` - Call in test files to set up beforeAll/afterAll
- `shouldRunE2ETests()` - Check if E2E is configured
- `E2E_SKIP_MESSAGE` - Message displayed when skipping

## Writing New E2E Tests

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import {
  shouldRunE2ETests,
  E2E_SKIP_MESSAGE,
  setupE2EHooks,
  getTestServiceSupabaseClient,
  createTestUser,
  registerProjectForCleanup,
  generateTestProjectName,
} from './setup';

// Skip if not configured
const describeE2E = shouldRunE2ETests() ? describe : describe.skip;

// Setup lifecycle
setupE2EHooks();

describeE2E('My Feature E2E', () => {
  let testUser: { id: string; email: string };

  beforeEach(async () => {
    testUser = await createTestUser('my-feature');
  });

  it('should do something', async () => {
    const supabase = getTestServiceSupabaseClient();
    const projectName = generateTestProjectName('my-test');

    const { data: project } = await supabase
      .from('projects')
      .insert({ /* ... */ })
      .select()
      .single();

    registerProjectForCleanup(project!.id);

    // Test assertions...
    expect(project).not.toBeNull();
  });
});

// Log skip message
if (!shouldRunE2ETests()) {
  console.log(E2E_SKIP_MESSAGE);
}
```

## CI Integration

E2E tests are designed to be skipped gracefully when test credentials are not available:

```yaml
# GitHub Actions example
- name: Run E2E Tests
  env:
    SUPABASE_URL_TEST: ${{ secrets.SUPABASE_URL_TEST }}
    SUPABASE_ANON_KEY_TEST: ${{ secrets.SUPABASE_ANON_KEY_TEST }}
    SUPABASE_SERVICE_ROLE_KEY_TEST: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY_TEST }}
    MASTER_ENCRYPTION_KEY: ${{ secrets.MASTER_ENCRYPTION_KEY }}
  run: npm run test:e2e:ci
```

If secrets are not configured, tests will skip with a message.

## Troubleshooting

### Tests Skip with "SUPABASE_URL_TEST not configured"

Ensure all three environment variables are set:
- `SUPABASE_URL_TEST`
- `SUPABASE_ANON_KEY_TEST`
- `SUPABASE_SERVICE_ROLE_KEY_TEST`

### Database Connection Errors

1. Verify your Supabase URL is correct
2. Check that your service role key has the right permissions
3. Ensure the test project has the required tables (run migrations)

### Cleanup Failures

If tests leave orphaned data:
1. Check the Supabase dashboard
2. Manually delete test data (projects starting with `e2e-`)
3. Review cleanup logs for errors

### Flaky Tests

E2E tests have built-in retry (1 attempt). If tests are still flaky:
1. Check for race conditions
2. Increase timeouts if needed
3. Ensure proper test isolation

## Best Practices

1. **Cleanup Everything**: Always register created resources for cleanup
2. **Unique Names**: Use `generateTestProjectName()` to avoid conflicts
3. **Test Isolation**: Each test should be independent
4. **Minimal Data**: Create only what's needed for the test
5. **Clear Assertions**: Test one thing per assertion
6. **Descriptive Names**: Use clear test descriptions
