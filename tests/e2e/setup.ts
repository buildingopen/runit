/**
 * E2E Test Setup
 *
 * Shared utilities and fixtures for Playwright E2E tests.
 */

import { test as base, expect } from '@playwright/test';

/**
 * Custom test fixture with common setup
 */
export const test = base.extend({
  // Add custom fixtures here if needed
});

export { expect };

/**
 * Common test data
 */
export const testData = {
  demoProjectId: 'demo-project-id',
  demoVersionId: 'demo-version-id',
};

/**
 * Wait for page to be fully loaded
 */
export async function waitForPageLoad(page: any) {
  await page.waitForLoadState('networkidle');
  await page.waitForLoadState('domcontentloaded');
}

/**
 * Check if element exists (without throwing)
 */
export async function elementExists(locator: any): Promise<boolean> {
  try {
    await locator.waitFor({ state: 'visible', timeout: 1000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get visible text content
 */
export async function getVisibleText(page: any, selector: string): Promise<string> {
  const element = page.locator(selector).first();
  if (await elementExists(element)) {
    return element.textContent() || '';
  }
  return '';
}
