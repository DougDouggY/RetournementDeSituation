import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
const base = 'http://127.0.0.1:5175';
const server = spawn(process.execPath, ['server/local.js', '--production'], {
  env: { ...process.env, PORT: '5175' },
  stdio: 'ignore',
});
let browser, page;
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
  page = await browser.newPage({ viewport: { width: 640, height: 480 } });
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
  await fs.mkdir('test-results', { recursive: true });
  await page.goto(base);
  assert.equal(await page.locator('.coop-options').isVisible(), false);
  await page.locator('[data-solo-character="1"]').click();
  await page.locator('#solo').click();
  await page.waitForFunction(() => window.__RDS?.state?.mode === 'solo');
  const state = await page.evaluate(() => window.__RDS.state);
  assert.equal(state.players.length, 1);
  assert.equal(state.players[0].character, 1);
  assert.equal(state.guards.length, 8);
  assert.equal(state.phase, 'infiltration');
  assert.ok(state.players[0].x < -25);
  assert.deepEqual(await page.evaluate(() => window.__RDS.visibleRooms), ['outside']);
  const lightCount = await page.evaluate(() => window.__RDS.activePointLights);
  assert.equal(lightCount, 10);
  await page.screenshot({ path: 'test-results/villa-outside.png' });
  await page.locator('#hud-settings').click();
  await page.waitForFunction(() => window.__RDS.state.paused);
  const paused = await page.evaluate(() => window.__RDS.state.time);
  await page.waitForTimeout(1100);
  assert.equal(await page.evaluate(() => window.__RDS.state.time), paused);
  await page.locator('#settings-close').click();
  await page.waitForFunction(() => !window.__RDS.state.paused);
  console.log('PASS new villa: direct Swonni solo, exterior spawn, room fog and pause');
  await page.keyboard.down('KeyC');
  await page.keyboard.press('KeyF');
  await page.waitForFunction(() => window.__RDS.state.players[0].torch);
  await page.keyboard.down('KeyD');
  await page.waitForFunction(() => window.__RDS.state.players[0].x > -26.05, null, { polling: 50 });
  await page.keyboard.up('KeyD');
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__RDS.state.doors['entry-west']);
  await page.waitForFunction(() => window.__RDS.visibleRooms.includes('hall1'));
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => !window.__RDS.state.doors['entry-west']);
  await page.keyboard.down('KeyG');
  await page.waitForFunction(() => window.__RDS.state.players[0].throwCharge > 0.15);
  await page.keyboard.up('KeyG');
  await page.waitForFunction(() => window.__RDS.state.players[0].bottles === 2);
  console.log('PASS real-key door interaction and charged bottle inventory');
  await page.keyboard.down('KeyS');
  await page.waitForFunction(() => window.__RDS.state.players[0].z > 5.2, null, { polling: 50 });
  await page.keyboard.up('KeyS');
  await page.waitForFunction(() => window.__RDS.visibleRooms.includes('r1-3'));
  assert.equal(await page.evaluate(() => window.__RDS.state.doors['window-office']), false);
  await page.screenshot({ path: 'test-results/villa-window-scouting.png' });
  await page.keyboard.down('KeyE');
  await page.waitForFunction(() => window.__RDS.state.doors['window-office']);
  await page.keyboard.up('KeyE');
  await page.waitForFunction(() => window.__RDS.windowSlides['window-office'].height > 1.25);
  assert.equal(
    await page.evaluate(() => {
      const w = window.__RDS.windowSlides['window-office'];
      return w.angle === w.baseAngle;
    }),
    true,
  );
  await page.keyboard.press('KeyV');
  await page.waitForFunction(
    () => window.__RDS.state.players[0].x > -25 && !window.__RDS.state.players[0].climb,
  );
  assert.ok(await page.evaluate(() => window.__RDS.visibleRooms.includes('r1-3')));
  await page.screenshot({ path: 'test-results/villa-window-inside.png' });
  await page.keyboard.press('KeyV');
  await page.waitForFunction(
    () => window.__RDS.state.players[0].x < -25 && !window.__RDS.state.players[0].climb,
  );
  assert.equal(
    await page.evaluate(() => window.__RDS.activePointLights),
    lightCount,
    'revealing rooms and crossing windows must keep the shader light count fixed',
  );
  await page.keyboard.up('KeyC');
  assert.deepEqual(apiRequests, []);
  assert.deepEqual(sockets, []);
  assert.deepEqual(errors, []);
  await fs.writeFile(
    'test-results/solo-browser.json',
    JSON.stringify(
      { passed: true, map: 'villa', players: 1, character: 'Swonni', apiRequests, sockets, errors },
      null,
      2,
    ),
  );
  console.log(
    'PASS closed-glass scouting, sliding sash and climbing both ways; no API, WebSocket or JS/WebGL errors',
  );
} catch (error) {
  if (page)
    console.error(
      'SOLO_DIAGNOSTIC',
      await page
        .evaluate(() => ({
          p: window.__RDS?.state?.players[0],
          phase: window.__RDS?.state?.phase,
          visible: window.__RDS?.visibleRooms,
        }))
        .catch(() => null),
    );
  throw error;
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
