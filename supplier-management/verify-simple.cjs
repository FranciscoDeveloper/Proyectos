const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ 
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--single-process'],
  });
  const page = await browser.newPage();
  
  console.log('Navigating...');
  const response = await page.goto('http://localhost:4200/login', { waitUntil: 'commit', timeout: 30000 });
  console.log('Status:', response?.status());
  
  // Wait for Angular to render
  await page.waitForTimeout(8000);
  const html = await page.content();
  console.log('Has app-root:', html.includes('app-root'));
  console.log('Has email input:', html.includes('email'));
  console.log('URL:', page.url());
  await page.screenshot({ path: '/tmp/simple-test.png' });
  
  await browser.close();
  console.log('Done');
})().catch(e => console.error('Error:', e.message));
