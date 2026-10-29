import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
const base = 'http://127.0.0.1:5175';
const server = spawn(process.execPath, ['server/local.js', '--production'], {
  env: { ...process.env, PORT: '5175' },
  stdio: 'ignore',
});
let browser;
await fs.mkdir('test-results', { recursive: true });
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`${base}/api/health`)).ok) break;
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
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  const errors = [],
    apiRequests = [],
    sockets = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('websocket', (ws) => sockets.push(ws.url()));
  await page.route('**/api/**', (route) => {
    apiRequests.push(route.request().url());
    return route.abort();
  });
  await page.addInitScript(() =>
    localStorage.setItem(
      'rds-settings',
      JSON.stringify({ music: 0, effects: 0, voices: 0, low: true }),
    ),
  );
  await page.goto(base);
  await page.locator('#solo').waitFor();
  assert.equal(await page.getByText('Swonni', { exact: true }).count(), 2);
  await page.locator('[data-solo-character="1"]').click();
  await page.locator('#solo').click();
  await page.waitForFunction(() => window.__RDS?.state?.mode === 'solo');
  const state = await page.evaluate(() => window.__RDS.state);
  assert.equal(state.players.length, 1);
  assert.equal(state.players[0].character, 1);
  assert.equal(state.guards.length, 8);
  assert.equal(state.host, 'solo-player');
  console.log(
    'PASS direct solo launch: Swonni is the only killer; eight hunters; no invitation code',
  );
  await page.locator('#hud-settings').click();
  await page.waitForFunction(() => window.__RDS.state.paused === true);
  const pausedAt = await page.evaluate(() => window.__RDS.state.time);
  await page.waitForTimeout(1100);
  assert.equal(await page.evaluate(() => window.__RDS.state.time), pausedAt);
  await page.locator('#settings-close').click();
  await page.waitForFunction(() => window.__RDS.state.paused === false);
  console.log('PASS solo pause and resume');
  await page.keyboard.press('KeyF');
  await page.waitForFunction(() => window.__RDS.state.players[0].torch === true);
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__RDS.state.doors['d1-0'] === true);
  await page.keyboard.press('KeyG');
  await page.waitForFunction(() => window.__RDS.state.players[0].bottles === 2);
  await page.locator('#hud-settings').click();
  await page.waitForFunction(() => window.__RDS.state.paused === true);
  assert.deepEqual(apiRequests, []);
  assert.deepEqual(sockets, []);
  assert.deepEqual(errors, []);
  await page.screenshot({ path: 'test-results/solo-swonni.png' });
  await fs.writeFile(
    'test-results/solo-browser.json',
    JSON.stringify(
      { passed: true, players: 1, character: 'Swonni', hunters: 8, apiRequests, sockets, errors },
      null,
      2,
    ),
  );
  console.log('PASS solo interactions, lamp and bottles without any HTTP game API or WebSocket');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
