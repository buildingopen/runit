import { test, expect } from '@playwright/test';

test('Marketing page renders with correct content', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  await page.screenshot({ path: '/tmp/ui-verification-browsertest.png', fullPage: true });

  // Verify nav bar with Runtime branding
  const nav = page.locator('nav');
  await expect(nav).toBeVisible();
  await expect(nav.locator('text=Runtime')).toBeVisible();

  // Verify hero headline
  const hero = page.locator('h1');
  await expect(hero).toBeVisible();
  await expect(hero).toContainText('You built it with AI');

  // Verify primary CTA
  const cta = page.locator('a:has-text("Go live for free")').first();
  await expect(cta).toBeVisible();

  // Verify sign-in link
  const signIn = page.locator('a:has-text("Sign in")').first();
  await expect(signIn).toBeVisible();

  // Check that Tailwind classes are applied by verifying computed styles
  const body = page.locator('body');
  const bgColor = await body.evaluate((el) => {
    return window.getComputedStyle(el).backgroundColor;
  });

  expect(bgColor).not.toBe('rgba(255, 255, 255, 1)');
  expect(bgColor).not.toBe('rgb(255, 255, 255)');
});
