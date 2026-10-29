import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
await fs.mkdir('test-results', { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  headless: true,
  args: [
    '--no-sandbox',
    '--enable-unsafe-swiftshader',
    '--use-angle=swiftshader',
    '--disable-dev-shm-usage',
  ],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
await page.goto('http://localhost:5173');
await page.waitForTimeout(4000);
await page.screenshot({ path: 'test-results/home.png' });
console.log(await page.evaluate(() => window.__RDS));
await page.locator('.coop-options summary').click();
await page.locator('#create').click();
await page.waitForTimeout(2000);
await page.screenshot({ path: 'test-results/lobby.png' });
console.log(await page.locator('#room-code').textContent());
await page.locator('#practice').click();
await page.waitForTimeout(2500);
await page.screenshot({ path: 'test-results/game.png' });
console.log(
  await page.evaluate(() => ({
    fps: window.__RDS.fps,
    calls: window.__RDS.drawCalls,
    triangles: window.__RDS.triangles,
    phase: window.__RDS.state?.phase,
  })),
);
await browser.close();
assert.deepEqual(errors, []);
console.log('PASS visual inspection: no JavaScript or WebGL console errors');
