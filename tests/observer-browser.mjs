import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const base = 'http://127.0.0.1:5177';
const server = spawn(process.execPath, ['server/local.js', '--production'], {
  env: { ...process.env, PORT: '5177' },
  stdio: 'ignore',
});
let browser;
const errors = [];
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(base + '/api/health')).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    headless: true,
    args: [
      '--no-sandbox',
      '--enable-unsafe-swiftshader',
      '--use-angle=swiftshader',
      '--disable-dev-shm-usage',
    ],
  });
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.addInitScript(() =>
    localStorage.setItem(
      'rds-settings',
      JSON.stringify({ music: 0, effects: 0, voices: 0, low: true }),
    ),
  );
  await page.goto(base);
  await page.locator('#observe').click();
  await page.waitForFunction(
    () => window.__RDS?.state?.observer === true && window.__RDS.visibleRooms.length === 8,
  );
  assert.equal(await page.locator('#mode-label').textContent(), 'OBSERVATEUR');
  assert.ok(await page.evaluate(() => window.__RDS.observerLight > 0));
  assert.equal(await page.locator('.hud-bottom').isVisible(), false);
  assert.equal(await page.locator('[data-floor="0"]').count(), 0, 'the basement must be removed');
  await page.locator('[data-floor="2"]').click();
  await page.waitForFunction(
    () => window.__RDS.observerFloor === 2 && window.__RDS.visibleRooms.includes('r2-5'),
  );
  await page.locator('#observe-view').selectOption('follow');
  await page.waitForFunction(
    () =>
      window.__RDS.observerZoom > 0.7 &&
      window.__RDS.observerFloor === window.__RDS.state.players[0].f,
  );
  await page.locator('[data-floor="2"]').click();
  assert.equal(await page.locator('#observe-view').inputValue(), 'house');
  await page.locator('[data-floor="1"]').click();
  await page.locator('#observe-view').selectOption('full');
  await page.locator('#observe-speed').selectOption('4');
  await page.waitForFunction(() => window.__RDS.state.bodies.length > 0, null, { timeout: 60000 });
  await fs.mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/observer-global.png' });
  await page.locator('#hud-settings').click();
  await page.waitForFunction(() => window.__RDS.state.paused);
  const paused = await page.evaluate(() => window.__RDS.state.time);
  await page.waitForTimeout(1100);
  assert.equal(await page.evaluate(() => window.__RDS.state.time), paused);
  await page.locator('#settings-close').click();
  await page.waitForFunction(() => !window.__RDS.state.paused);
  console.log(
    'PASS spectator: autonomous kill, all rooms revealed, floor switching, speed and pause',
  );
  await page.goto(base);
  await page.locator('#solo').click();
  await page.waitForFunction(() => window.__RDS?.state?.mode === 'solo');
  await page.keyboard.down('KeyG');
  await page.waitForFunction(
    () => window.__RDS.state.players[0].throwCharge > 0.3 && window.__RDS.aimVisible,
  );
  assert.equal(await page.evaluate(() => window.__RDS.state.players[0].bottles), 3);
  await page.screenshot({ path: 'test-results/bottle-aim.png' });
  await page.keyboard.up('KeyG');
  await page.waitForFunction(
    () => window.__RDS.state.players[0].bottles === 2 && !window.__RDS.state.players[0].charging,
  );
  await page.waitForFunction(() => window.__RDS.state.noises.some((n) => n.radius === 16));
  console.log(
    'PASS holding G previews trajectory, release consumes one bottle and impact creates noise',
  );
  await page.goto(base + '/plans.html');
  await page.locator('#plan').waitFor();
  assert.ok(await page.locator('#plan').evaluate((img) => img.complete && img.naturalWidth > 1000));
  await page.locator('[data-map="niveau-2"]').click();
  await page.waitForFunction(
    () =>
      document.querySelector('#plan').src.endsWith('niveau-2.svg') &&
      document.querySelector('#plan').complete,
  );
  await page.locator('[data-map="niveau-1"]').click();
  await page.waitForFunction(
    () =>
      document.querySelector('#plan').src.endsWith('niveau-1.svg') &&
      document.querySelector('#plan').complete,
  );
  assert.deepEqual(errors, []);
  await fs.writeFile(
    'test-results/observer-browser.json',
    JSON.stringify(
      {
        passed: true,
        errors,
        checks: [
          'AI killer',
          'omniscient top view',
          'two floor selectors, no basement',
          'speed x4',
          'pause',
          'hold/release G trajectory',
          'impact sound',
          'playable villa floor plans',
        ],
      },
      null,
      2,
    ),
  );
  console.log('PASS two-level villa plan navigation; no JavaScript/WebGL errors');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
