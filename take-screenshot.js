const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('Navigating to http://localhost:3000...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });

  console.log('Waiting 3 seconds for React to hydrate...');
  await page.waitForTimeout(3000);

  console.log('Taking screenshot...');
  await page.screenshot({ path: '/tmp/production-ui-final.png', fullPage: true });

  console.log('✅ Screenshot saved to /tmp/production-ui-final.png');

  // Get page content
  const title = await page.title();
  const content = await page.content();

  console.log(`\nPage Title: ${title}`);
  console.log(`Has "Execution Layer": ${content.includes('Execution Layer')}`);
  console.log(`Has "API Online": ${content.includes('API Online')}`);
  console.log(`Has "API Offline": ${content.includes('API Offline')}`);
  console.log(`Has "Colab for Apps": ${content.includes('Colab for Apps')}`);

  await browser.close();
  process.exit(0);
})();
