import { test, expect } from '@playwright/test';

test('Production UI loads and shows correct UI', async ({ page }) => {
  // Navigate to Next.js app
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 10000 });

  // Wait for the page to fully load
  await page.waitForSelector('h1', { timeout: 10000 });

  // Take screenshot FIRST before assertions
  await page.screenshot({ path: '/tmp/production-ui-screenshot.png', fullPage: true });
  console.log('✅ Screenshot saved to /tmp/production-ui-screenshot.png');

  // Now check content
  const title = await page.locator('h1').textContent();
  console.log(`Page title: ${title}`);

  // Check if we have the right page
  expect(title).toContain('Execution Layer');

  // Check for API status
  const hasStatusIndicator = await page.locator('.w-2.h-2.rounded-full').count() > 0;
  console.log(`Has status indicator: ${hasStatusIndicator}`);
  expect(hasStatusIndicator).toBeTruthy();
});

test('Production UI attempts to connect to API', async ({ page }) => {
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 10000 });

  // Wait for loading to finish (either success or error state)
  await page.waitForFunction(
    () => {
      const loadingText = document.querySelector('text=Loading projects...');
      const hasProjects = document.querySelector('text=Your Projects');
      const hasEmpty = document.querySelector('text=No projects yet');
      const hasError = document.querySelector('text=Error');
      return !loadingText || hasProjects || hasEmpty || hasError;
    },
    { timeout: 15000 }
  );

  // Take screenshot of the loaded state
  await page.screenshot({ path: '/tmp/production-ui-loaded.png', fullPage: true });
  console.log('✅ Loaded state screenshot saved to /tmp/production-ui-loaded.png');

  // Log what we got
  const pageContent = await page.content();
  const hasProjects = pageContent.includes('Your Projects');
  const hasEmpty = pageContent.includes('No projects yet');
  const hasError = pageContent.includes('Error');
  const apiOnline = pageContent.includes('API Online');

  console.log(`\nUI State:`);
  console.log(`  - Has Projects: ${hasProjects}`);
  console.log(`  - Empty State: ${hasEmpty}`);
  console.log(`  - Has Error: ${hasError}`);
  console.log(`  - API Online: ${apiOnline}`);

  // We should have SOME state (not stuck loading)
  expect(hasProjects || hasEmpty || hasError).toBeTruthy();
});
