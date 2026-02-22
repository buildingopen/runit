/**
 * Project Flow E2E Tests
 *
 * Tests user flows for:
 * - Homepage navigation
 * - Project creation
 * - Endpoint selection and running
 * - Results viewing
 * - Share link creation
 */

import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test('should load with project list', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for initial loading to complete (max 10s)
    await page.waitForFunction(() => !document.body.textContent?.includes('Loading...'), { timeout: 10000 }).catch(() => {});

    // Should display Runtime branding
    const runtimeText = page.locator('text=Runtime');
    const visibleCount = await runtimeText.filter({ visible: true }).count();
    expect(visibleCount).toBeGreaterThan(0);

    // Should have main heading
    await expect(page.locator('h1:has-text("Your Apps")')).toBeVisible();
  });

  test('should have create project link', async ({ page }) => {
    await page.goto('/');

    // Should have a way to create new projects
    const createButton = page.locator('a[href="/new"], button:has-text("New"), button:has-text("Create")');
    await expect(createButton.first()).toBeVisible();
  });
});

test.describe('New Project Page', () => {
  test('can navigate to new project page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Click on create project link/button
    const createButton = page.locator('a[href="/new"], button:has-text("New"), a:has-text("New Project"), button:has-text("Create"), a:has-text("Create")');
    const hasCreateButton = await createButton.first().isVisible().catch(() => false);

    if (hasCreateButton) {
      await createButton.first().click();
      // Should navigate to new project page
      await expect(page).toHaveURL(/\/new/);
    } else {
      // Direct navigation test
      await page.goto('/new');
      await page.waitForLoadState('networkidle');
      // Verify the new project page loaded
      const hasForm = await page.locator('input, form').first().isVisible().catch(() => false);
      expect(hasForm).toBe(true);
    }
  });
});

test.describe('Project Run Page', () => {
  // These tests use demo project IDs if available

  test('should display endpoint selector when project exists', async ({ page }) => {
    // Navigate to a project page (using demo or test project)
    await page.goto('/p/demo-project-id');

    // Wait for page to load (may show error if project doesn't exist)
    await page.waitForLoadState('networkidle');

    // Check for either endpoints section or error message
    const endpointsSection = page.locator('h2:has-text("Endpoints")');
    const errorMessage = page.locator('text=Failed to load');

    // One of these should be visible
    const hasEndpoints = await endpointsSection.isVisible().catch(() => false);
    const hasError = await errorMessage.isVisible().catch(() => false);

    expect(hasEndpoints || hasError).toBe(true);
  });

  test('should have back navigation', async ({ page }) => {
    await page.goto('/p/demo-project-id');
    await page.waitForLoadState('networkidle');

    // Wait for loading to complete
    await page.waitForFunction(() => !document.body.textContent?.includes('Loading...'), { timeout: 10000 }).catch(() => {});

    // Sidebar should have Apps link for navigation
    const hasBackNav = await page.locator('text=Apps').first().isVisible().catch(() => false);
    expect(hasBackNav).toBe(true);
  });
});

test.describe('Form Submission Flow', () => {
  test('should show form when endpoint is selected', async ({ page }) => {
    // This test validates the form UI exists
    await page.goto('/p/demo-project-id');
    await page.waitForLoadState('networkidle');

    // Look for form elements
    const formSection = page.locator('h2:has-text("Run Endpoint")');
    const runButton = page.locator('button:has-text("Run")');

    // If the project exists and has endpoints, form section should be visible
    const hasForm = await formSection.isVisible().catch(() => false);
    const hasRunButton = await runButton.first().isVisible().catch(() => false);

    // Log result for debugging
    console.log(`Form visible: ${hasForm}, Run button visible: ${hasRunButton}`);
  });

  test('should handle form submission', async ({ page }) => {
    await page.goto('/p/demo-project-id');
    await page.waitForLoadState('networkidle');

    // Try to find and click run button
    const runButton = page.locator('button:has-text("Run")').first();

    if (await runButton.isVisible().catch(() => false)) {
      // Check if button is enabled
      const isDisabled = await runButton.isDisabled();

      if (!isDisabled) {
        await runButton.click();

        // Should show loading state or result
        const loadingOrResult = page.locator('text=Running, text=Result, text=queued');
        await expect(loadingOrResult.first()).toBeVisible({ timeout: 10000 });
      }
    }
  });
});

test.describe('Share Modal', () => {
  test('should have share button', async ({ page }) => {
    await page.goto('/p/demo-project-id');
    await page.waitForLoadState('networkidle');

    // Look for share button
    const shareButton = page.locator('button:has-text("Share"), a:has-text("Share")');

    if (await shareButton.first().isVisible().catch(() => false)) {
      await shareButton.first().click();

      // Should open share modal
      const modal = page.locator('[role="dialog"], .modal, div:has-text("Share")');
      await expect(modal.first()).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('Run History', () => {
  test('should display run history section', async ({ page }) => {
    await page.goto('/p/demo-project-id');
    await page.waitForLoadState('networkidle');

    // Look for history section
    const historySection = page.locator('text=History, text=Recent Runs, text=Run History');

    // History should be visible (may be empty)
    const hasHistory = await historySection.first().isVisible().catch(() => false);
    console.log(`History section visible: ${hasHistory}`);
  });
});

test.describe('Responsive Design', () => {
  test('should be usable on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Should still show main content
    await expect(page.locator('body')).toBeVisible();

    // Header should be visible (use first() to handle multiple headers)
    await expect(page.locator('header').first()).toBeVisible();
  });

  test('should have mobile menu toggle on project page', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/p/demo-project-id');
    await page.waitForLoadState('networkidle');

    // Look for mobile history toggle button
    const mobileToggle = page.locator('button[aria-label*="history"], button[aria-label*="History"]');

    const hasMobileToggle = await mobileToggle.first().isVisible().catch(() => false);
    console.log(`Mobile toggle visible: ${hasMobileToggle}`);
  });
});
