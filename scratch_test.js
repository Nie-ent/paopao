const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  // Set demo mode bypass cookie
  await page.setCookie({
    name: 'demo_mode_bypass',
    value: 'true',
    domain: 'wealthness-jwug5a017-nies-projects-a749def7.vercel.app',
  });

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
  
  console.log("Navigating...");
  await page.goto('https://wealthness-jwug5a017-nies-projects-a749def7.vercel.app/', { waitUntil: 'networkidle0' });
  
  console.log("Waiting for error state or content...");
  await new Promise(r => setTimeout(r, 5000));
  
  // Get text of error toast or on screen
  const textContent = await page.evaluate(() => document.body.innerText);
  console.log("BODY TEXT:\n", textContent);
  
  await browser.close();
})();
