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
  page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
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
  assert.equal(
    await page.locator('.coop-options').isVisible(),
    false,
    'default solo build must hide multiplayer setup',
  );
  assert.equal(await page.getByText('Swonni', { exact: true }).count(), 2);
  await page.locator('[data-solo-character="1"]').click();
  await page.locator('#solo').click();
  await page.waitForFunction(() => window.__RDS?.state?.mode === 'solo');
  await page.waitForFunction(() => window.__RDS.visibleRooms.includes('outside'));
  const state = await page.evaluate(() => window.__RDS.state);
  assert.equal(state.players.length, 1);
  assert.equal(state.players[0].character, 1);
  assert.equal(state.guards.length, 8);
  assert.equal(state.host, 'solo-player');
  assert.equal(state.phase, 'infiltration');
  assert.equal(state.bodies.length, 0);
  assert.ok(state.players[0].x < -18);
  assert.deepEqual(await page.evaluate(() => window.__RDS.visibleRooms), ['outside']);
  assert.deepEqual(await page.evaluate(() => window.__RDS.visibleGuards), []);
  await page.screenshot({ path: 'test-results/infiltration-outside.png' });
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
  await page.keyboard.down('KeyC');
  await page.keyboard.press('KeyF');
  await page.waitForFunction(() => window.__RDS.state.players[0].torch === true);
  await page.keyboard.down('KeyD');
  await page.waitForFunction(() => window.__RDS.state.players[0].x > -19.6);
  await page.keyboard.up('KeyD');
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__RDS.state.doors['entry-west'] === true);
  await page.waitForFunction(() => window.__RDS.visibleRooms.includes('hall1'));
  console.log(
    'PASS exterior start, room fog, blocked house view and reveal through an opened entry',
  );
  await page.keyboard.press('KeyG');
  await page.waitForFunction(() => window.__RDS.state.players[0].bottles === 2);
  await page.screenshot({ path: 'test-results/infiltration-entry.png' });
  // Step away from the doorway before approaching the meter along the outer wall.
  await page.keyboard.down('KeyS');
  await page.waitForFunction(() => window.__RDS.state.players[0].z > 2.5);
  await page.keyboard.up('KeyS');
  // Walk to the external meter; test real controls and actual rendered lights.
  await page.keyboard.down('KeyD');
  await page.waitForFunction(() => window.__RDS.state.players[0].x > -19);
  await page.keyboard.up('KeyD');
  await page.keyboard.down('KeyS');
  await page.waitForFunction(() => window.__RDS.state.players[0].z > 3.35);
  await page.keyboard.up('KeyS');
  await page.keyboard.press('KeyE');
  await page.waitForFunction(
    () =>
      window.__RDS.state.power === false &&
      window.__RDS.gardenLights.every((v) => v === 0) &&
      Object.values(window.__RDS.roomLights).every((v) => v === 0) &&
      window.__RDS.windowLights.every((v) => v.emission === 0),
  );
  await page.screenshot({ path: 'test-results/power-off.png' });
  await page.keyboard.press('KeyE');
  await page.waitForFunction(
    () =>
      window.__RDS.state.power === true &&
      window.__RDS.gardenLights.some((v) => v > 0) &&
      Object.values(window.__RDS.roomLights).every((v) => v > 0),
  );
  console.log(
    'PASS external breaker cuts and restores room lights, path lamps and glowing windows',
  );
  await page.keyboard.down('KeyS');
  await page.waitForFunction(() => window.__RDS.state.players[0].z > 6.55);
  await page.keyboard.up('KeyS');
  await page.waitForFunction(() => window.__RDS.visibleRooms.includes('r1-3'));
  assert.equal(await page.evaluate(() => window.__RDS.state.doors['window-office']), false);
  await page.screenshot({ path: 'test-results/window-scouting.png' });
  await page.keyboard.down('KeyE');
  await page.waitForFunction(() => window.__RDS.state.doors['window-office'] === true);
  await page.keyboard.up('KeyE');
  await page.keyboard.press('KeyV');
  await page.waitForFunction(
    () => window.__RDS.state.players[0].x > -18 && window.__RDS.state.players[0].climb === null,
  );
  assert.ok(await page.evaluate(() => window.__RDS.visibleRooms.includes('r1-3')));
  await page.screenshot({ path: 'test-results/window-inside.png' });
  await page.keyboard.press('KeyV');
  await page.waitForFunction(
    () => window.__RDS.state.players[0].x < -18.02 && window.__RDS.state.players[0].climb === null,
  );
  console.log('PASS observing through closed glass, unlocking, climbing in and climbing back out');

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
} catch (error) {
  if (page) {
    console.error(
      'SOLO_DIAGNOSTIC',
      await page
        .evaluate(() => ({
          player: window.__RDS?.state?.players[0],
          visible: window.__RDS?.visibleRooms,
          power: window.__RDS?.state?.power,
        }))
        .catch(() => null),
    );
    await page.screenshot({ path: 'test-results/solo-failure.png' }).catch(() => {});
  }
  throw error;
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
