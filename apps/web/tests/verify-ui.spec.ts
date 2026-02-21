import { test, expect } from '@playwright/test';

test('Execution Layer UI renders with Tailwind CSS', async ({ page }) => {
  // Navigate to the app
  await page.goto('/');

  // Wait for page to fully load
  await page.waitForLoadState('networkidle');

  // Take a screenshot
  await page.screenshot({ path: '/tmp/ui-verification-browsertest.png', fullPage: true });

  // Verify the header exists
  const header = page.locator('header');
  await expect(header).toBeVisible();

  // Verify "Execution Layer" title exists
  const title = page.locator('h1:has-text("Execution Layer")');
  await expect(title).toBeVisible();

  // Verify the subtitle "Colab for Apps" exists
  const subtitle = page.locator('text=Colab for Apps');
  await expect(subtitle).toBeVisible();

  // Verify API status indicator exists
  const apiStatus = page.locator('text=API');
  await expect(apiStatus).toBeVisible();

  // Verify Refresh button exists
  const refreshButton = page.locator('button:has-text("Refresh")');
  await expect(refreshButton).toBeVisible();

  // Check that Tailwind classes are applied by verifying computed styles
  const body = page.locator('body');
  const bgColor = await body.evaluate((el) => {
    return window.getComputedStyle(el).backgroundColor;
  });

  // Verify background color is not white (should be gray-50)
  expect(bgColor).not.toBe('rgba(255, 255, 255, 1)');
  expect(bgColor).not.toBe('rgb(255, 255, 255)');

  console.log('✅ All UI elements verified');
  console.log('✅ Background color:', bgColor);
  console.log('✅ Screenshot saved to /tmp/ui-verification-browsertest.png');
});
