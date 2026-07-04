const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ 
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(30000);
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().substring(0,120)); });
  
  // Login
  await page.goto('http://localhost:4200/#/login', { waitUntil: 'commit' });
  await page.waitForFunction(() => document.querySelectorAll('input').length >= 2, { timeout: 20000 });
  await page.locator('.demo-card').nth(5).click();
  await page.waitForTimeout(300);
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => window.location.hash !== '#/login', { timeout: 15000 });
  await page.waitForTimeout(2000);
  console.log('Logged in');
  
  // Try navigating to clinical-detail directly with ID=1
  await page.goto('http://localhost:4200/#/app/clinical/dental-records/1', { waitUntil: 'commit' });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/s1-detail.png', fullPage: true });
  console.log('URL:', page.url());
  
  // Check what's rendered
  const bodySnippet = await page.evaluate(() => document.body.innerText.substring(0, 300));
  console.log('Page text:', bodySnippet.replace(/\n/g, ' ').substring(0, 150));
  
  // Find all tabs / navigation elements
  const allBtns = await page.locator('button').all();
  console.log('Buttons found:', allBtns.length);
  for (const btn of allBtns.slice(0, 20)) {
    const text = await btn.textContent();
    if (text && text.trim()) console.log('  btn:', text.trim().substring(0, 40));
  }
  
  // Look for tab buttons
  const tabBtns = await page.locator('[role="tab"], .tab-btn, .tab-item').all();
  console.log('Tab elements:', tabBtns.length);
  
  await browser.close();
  console.log('DONE');
})().catch(e => { console.error('FATAL:', e.message.split('\n')[0]); });
