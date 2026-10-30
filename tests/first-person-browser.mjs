import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const base = 'http://127.0.0.1:5180';
const server = spawn(process.execPath, ['server/local.js', '--production'], {
  env: { ...process.env, PORT: '5180' },
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
  assert.ok(await page.locator('#solo').isVisible());
  await page.locator('#solo-fps').click();
  await page.waitForFunction(
    () => window.__RDS?.state?.mode === 'solo' && window.__RDS.viewMode === 'first-person',
  );
  await page.waitForFunction(() => window.__RDS.eye.y > 1.5);
  assert.equal(await page.locator('#fps-reticle').isVisible(), true);
  assert.equal(await page.evaluate(() => window.__RDS.activePointLights), 10);
  await fs.mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/first-person-outside.png' });
  const officeAmbient = await page.evaluate(() => window.__RDS.roomAmbient['r1-3']);
  assert.ok(officeAmbient.length > 0 && officeAmbient.every((v) => v > 0));
  const first = await page.evaluate(() => window.__RDS.state.players[0]);
  await page.keyboard.down('KeyW');
  await page.waitForFunction(() => window.__RDS.state.players[0].x > -26.05, null, { polling: 50 });
  await page.keyboard.up('KeyW');
  const moved = await page.evaluate(() => window.__RDS.state.players[0]);
  assert.ok(moved.x > first.x + 2);
  assert.ok(Math.abs(moved.z - first.z) < 0.3);
  await page.keyboard.down('KeyE');
  await page.waitForFunction(() => window.__RDS.state.doors['entry-west'] === 'ajar');
  await page.waitForFunction(
    () => Math.abs(window.__RDS.doorLeaves['entry-west'].angle - Math.PI / 5) < 0.02,
  );
  assert.equal(await page.evaluate(() => window.__RDS.doorLeaves['entry-west'].opaque), true);
  const bodyBeforePeek = await page.evaluate(() => window.__RDS.state.players[0].x);
  assert.ok(await page.evaluate(() => window.__RDS.eye.x > window.__RDS.state.players[0].x));
  await page.screenshot({ path: 'test-results/held-e-peek.png' });
  assert.equal(await page.evaluate(() => window.__RDS.state.players[0].x), bodyBeforePeek);
  await page.keyboard.up('KeyE');
  await page.waitForFunction(() => window.__RDS.state.doors['entry-west'] === false);
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__RDS.state.doors['entry-west'] === true);
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => !window.__RDS.state.doors['entry-west']);
  await page.keyboard.down('KeyD');
  await page.waitForFunction(() => window.__RDS.state.players[0].z > 5.2, null, { polling: 50 });
  await page.keyboard.up('KeyD');
  await page.keyboard.down('KeyE');
  await page.waitForFunction(() => window.__RDS.state.doors['window-office']);
  await page.keyboard.up('KeyE');
  assert.deepEqual(
    await page.evaluate(() => window.__RDS.roomAmbient['r1-3']),
    officeAmbient,
    'room illumination must not depend on window proximity',
  );
  await page.screenshot({ path: 'test-results/office-window-permanently-lit.png' });
  await page.keyboard.press('KeyV');
  await page.waitForFunction(
    () => window.__RDS.state.players[0].x > -25 && !window.__RDS.state.players[0].climb,
  );
  await page.screenshot({ path: 'test-results/first-person-office.png' });
  await page.keyboard.down('KeyW');
  await page.waitForFunction(() => window.__RDS.state.players[0].x > -22.2, null, { polling: 50 });
  await page.keyboard.up('KeyW');
  await page.keyboard.down('KeyD');
  await page.waitForFunction(() => window.__RDS.state.players[0].z > 8.3, null, { polling: 50 });
  await page.keyboard.up('KeyD');
  await page.keyboard.down('KeyW');
  await page.waitForFunction(() => window.__RDS.state.players[0].x > -11.5, null, { polling: 50 });
  await page.keyboard.up('KeyW');
  await page.keyboard.down('KeyA');
  await page.waitForFunction(() => window.__RDS.state.players[0].z < 6.6, null, { polling: 50 });
  await page.keyboard.up('KeyA');
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__RDS.state.lights['r1-3'] === false);
  await page.waitForFunction(() =>
    window.__RDS.fixtures.filter((f) => f.room === 'r1-3').every((f) => f.intensity === 0),
  );
  assert.ok(
    await page.evaluate(() => window.__RDS.fixtures.filter((f) => f.room === 'r1-3').length >= 2),
  );
  assert.ok(await page.evaluate(() => window.__RDS.roomAmbient['r1-3'].every((v) => v === 0)));
  assert.equal(await page.evaluate(() => window.__RDS.moonLight), 0);
  assert.ok(await page.evaluate(() => window.__RDS.ambientLight < 0.02));
  assert.ok(await page.evaluate(() => window.__RDS.renderedLights.every((v) => v === 0)));
  await page.screenshot({ path: 'test-results/first-person-lights-off.png' });
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() =>
    window.__RDS.fixtures.filter((f) => f.room === 'r1-3').every((f) => f.intensity === 1),
  );
  await page.keyboard.press('KeyF');
  await page.waitForFunction(() => window.__RDS.state.players[0].torch);
  await page.keyboard.down('KeyC');
  await page.waitForFunction(() => window.__RDS.eye.y < 1.1);
  await page.keyboard.up('KeyC');
  await page.keyboard.down('KeyG');
  await page.waitForFunction(
    () => window.__RDS.state.players[0].throwCharge > 0.3 && window.__RDS.aimVisible,
  );
  await page.keyboard.up('KeyG');
  await page.waitForFunction(() => window.__RDS.state.players[0].bottles === 2);
  const before = await page.evaluate(() => window.__RDS.eye.yaw);
  await page.locator('#fps-look').click();
  await page.waitForFunction(() => !!document.pointerLockElement);
  await page.mouse.move(440, 300);
  await page.mouse.move(520, 320);
  await page.waitForFunction((yaw) => Math.abs(window.__RDS.eye.yaw - yaw) > 0.05, before);
  await page.keyboard.press('F2');
  await page.waitForFunction(() => window.__RDS.viewMode === 'top');
  assert.equal(await page.locator('#fps-reticle').isVisible(), false);
  await page.keyboard.press('F2');
  await page.waitForFunction(() => window.__RDS.viewMode === 'first-person');
  assert.equal(await page.evaluate(() => window.__RDS.state.bodies.length), 0);
  assert.equal(await page.evaluate(() => window.__RDS.activePointLights), 10);
  assert.deepEqual(errors, []);
  console.log(
    'PASS both menu versions, FPS eye/crouch, view-relative movement, door, window opening/climb, torch, pointer-lock look and F2 without resetting the round; no JS/WebGL errors',
  );
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
