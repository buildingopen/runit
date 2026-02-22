import { test, expect } from '@playwright/test';

test('Production UI loads and shows correct UI', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle', timeout: 10000 });

  await page.waitForSelector('h1', { timeout: 10000 });

  await page.screenshot({ path: '/tmp/production-ui-screenshot.png', fullPage: true });

  // Marketing page hero headline
  const title = await page.locator('h1').textContent();
  expect(title).toContain('You built it with AI');

  // Nav bar has Runtime branding
  const nav = page.locator('nav');
  await expect(nav.locator('text=Runtime')).toBeVisible();

  // Has a round status indicator (dot in the hero badge)
  const hasStatusIndicator = await page.locator('.rounded-full').count() > 0;
  expect(hasStatusIndicator).toBeTruthy();
});

test('Production UI has working navigation', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle', timeout: 10000 });

  await page.screenshot({ path: '/tmp/production-ui-loaded.png', fullPage: true });

  const pageContent = await page.content();
  const hasHero = pageContent.includes('You built it with AI');
  const hasSignIn = pageContent.includes('Sign in');
  const hasCta = pageContent.includes('Go live for free');

  // Marketing page has expected content
  expect(hasHero).toBeTruthy();
  expect(hasSignIn).toBeTruthy();
  expect(hasCta).toBeTruthy();
});
