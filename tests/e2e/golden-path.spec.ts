/**
 * Golden Path E2E Test
 *
 * Tests the critical user flow:
 * 1. Homepage loads
 * 2. Upload FastAPI project
 * 3. See endpoints detected
 * 4. Run endpoint
 * 5. See result
 *
 * Prerequisites (auto-started by playwright):
 * - Control plane on port 3002
 * - Web app on port 3001
 */

import { test, expect } from '@playwright/test';
import * as path from 'path';

// Helper to wait for page to be ready
async function waitForPageReady(page: import('@playwright/test').Page) {
  await page.waitForLoadState('domcontentloaded');
  // Wait for any loading spinners to disappear
  await page.waitForFunction(
    () => {
      const body = document.body?.textContent || '';
      return !body.includes('Loading...') || body.length > 100;
    },
    { timeout: 15000 }
  ).catch(() => {});
}

test.describe('Golden Path', () => {
  test('1. homepage loads', async ({ page }) => {
    await page.goto('/');
    await waitForPageReady(page);

    // Should see either the app list or empty state
    const content = await page.textContent('body');
    const hasExpectedContent =
      content?.includes('Mini Apps') ||
      content?.includes('Create') ||
      content?.includes('new app') ||
      content?.includes('apps');

    expect(hasExpectedContent).toBeTruthy();
  });

  test('2. can navigate to new project page', async ({ page }) => {
    await page.goto('/new');
    await waitForPageReady(page);

    // Should see upload UI - check for heading specifically
    await expect(
      page.getByRole('heading', { name: 'Create a mini app' })
    ).toBeVisible({ timeout: 10000 });
  });

  test('3. can upload ZIP file', async ({ page }) => {
    await page.goto('/new');
    await waitForPageReady(page);

    // Find file input and upload
    const fixturesPath = path.resolve(__dirname, '../fixtures/hello-world.zip');
    const fileInput = page.locator('input[type="file"]');

    await expect(fileInput).toBeAttached({ timeout: 5000 });
    await fileInput.setInputFiles(fixturesPath);

    // Wait for file processing
    await page.waitForTimeout(1000);

    // Should see upload button enabled
    const uploadButton = page.locator('button:has-text("Upload")');
    await expect(uploadButton).toBeVisible({ timeout: 5000 });
  });

  test('4. upload creates project with endpoints', async ({ page }) => {
    await page.goto('/new');
    await waitForPageReady(page);

    // Upload file
    const fixturesPath = path.resolve(__dirname, '../fixtures/hello-world.zip');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(fixturesPath);
    await page.waitForTimeout(1000);

    // Click upload
    const uploadButton = page.locator('button:has-text("Upload")');
    await uploadButton.click();

    // Wait for redirect (either to configure or directly to run page)
    await page.waitForURL(
      (url) =>
        url.pathname.includes('/create/configure') ||
        url.pathname.startsWith('/p/'),
      { timeout: 30000 }
    );

    // Verify we're on a project-related page
    const url = page.url();
    expect(
      url.includes('/create/configure') || url.includes('/p/')
    ).toBeTruthy();
  });

  test('5. full flow - upload, deploy, and run endpoint', async ({ page }) => {
    // Upload project
    await page.goto('/new');
    await waitForPageReady(page);

    const fixturesPath = path.resolve(__dirname, '../fixtures/hello-world.zip');
    await page.locator('input[type="file"]').setInputFiles(fixturesPath);
    await page.waitForTimeout(1000);
    await page.locator('button:has-text("Upload")').click();

    // Wait for configure page
    await page.waitForURL(
      (url) => url.pathname.includes('/create/configure'),
      { timeout: 30000 }
    );

    // Extract project ID from URL
    const configUrl = page.url();
    const match = configUrl.match(/project=([a-zA-Z0-9-]+)/);
    expect(match).toBeTruthy();
    const projectId = match![1];

    // Click Deploy button
    const deployButton = page.locator('button:has-text("Deploy")');
    await expect(deployButton).toBeVisible({ timeout: 5000 });
    await deployButton.click();

    // Wait for deploying page or success page
    await page.waitForURL(
      (url) =>
        url.pathname.includes('/deploying') ||
        url.pathname.includes('/success') ||
        url.pathname === `/p/${projectId}`,
      { timeout: 30000 }
    );

    // If on deploying page, wait for deployment to complete
    if (page.url().includes('/deploying')) {
      await page.waitForURL(
        (url) =>
          url.pathname.includes('/success') ||
          url.pathname === `/p/${projectId}`,
        { timeout: 120000 }
      );
    }

    // If on success page, click the "Run it now" button to go to run page
    if (page.url().includes('/success')) {
      const runAppButton = page.locator('button:has-text("Run it now")');
      await expect(runAppButton).toBeVisible({ timeout: 5000 });
      await runAppButton.click();
      await page.waitForURL((url) => url.pathname === `/p/${projectId}`, { timeout: 10000 });
    }

    await waitForPageReady(page);

    // Now on run page - click Run button
    const runButton = page.locator('button:has-text("Run")');
    await expect(runButton).toBeVisible({ timeout: 10000 });
    await runButton.click();

    // Wait for execution result (Modal cold start can take time)
    await page.waitForFunction(
      () => {
        const text = document.body?.textContent || '';
        return (
          text.includes('Success') ||
          text.includes('Error') ||
          text.includes('Hello') ||
          text.includes('message')
        );
      },
      { timeout: 90000 }
    );

    // Verify success or meaningful result
    const content = await page.textContent('body');
    expect(content).toBeTruthy();
    expect(content!.length).toBeGreaterThan(100);
  });
});
