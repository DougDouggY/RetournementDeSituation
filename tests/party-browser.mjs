// A deterministic scene is injected into the development worker by Playwright only.
// Production exposes no controls for teleporting players or spawning evidence.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const base = 'http://127.0.0.1:5176';
const server = spawn(process.execPath, ['server/local.js'], {
  env: { ...process.env, PORT: '5176', RDS_NO_HMR: '1' },
  stdio: 'ignore',
});
let browser;
const errors = [];
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
  await page.route('**/src/solo-worker.js*', async (route) => {
    const response = await route.fetch();
    let source = await response.text();
    assert.ok(source.includes('sim.start(true);'));
    // Imports remain ordinary Vite modules. This fixture exists only in this test response.
    source =
      "import { hides, regionAt } from '/shared/map.js';\n" +
      source.replace(
        'sim.start(true);',
        `sim.start(true);
      const h = hides.find(h => h.f === 1 && regionAt(h.f, h.x, h.z) === 'r1-3');
      Object.assign(sim.players[0], { x: h.x, z: h.z });
      sim.guards[0].alive = false;
      sim.bodies.push({ id: 'fixture-body', guard: 'g0', index: 0, name: 'Invité', f: 1, x: h.x, z: h.z, angle: 0, draggedBy: null, lastBlood: { x: h.x, z: h.z } });
      sim.addBlood(sim.players[0], 0.65);
    `,
      );
    await route.fulfill({ response, body: source });
  });
  await page.goto(base);
  await page.locator('#solo').click();
  await page.waitForFunction(() => window.__RDS?.state?.blood?.length === 1);
  await page.keyboard.down('KeyE');
  await page.waitForFunction(() => window.__RDS.state.players[0].cleanProgress > 0.4);
  assert.equal(await page.locator('#rescue-bar span').textContent(), 'NETTOYER LE SANG');
  await page.keyboard.up('KeyE');
  await page.waitForFunction(() => window.__RDS.state.players[0].cleanProgress === 0);
  assert.equal(await page.evaluate(() => window.__RDS.state.blood.length), 1);
  await page.keyboard.down('KeyE');
  await page.waitForFunction(() => window.__RDS.state.blood.length === 0);
  await page.keyboard.up('KeyE');
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => !!window.__RDS.state.players[0].dragging);
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => !!window.__RDS.state.bodies[0].hidden);
  assert.equal(await page.evaluate(() => window.__RDS.state.players[0].dragging), null);
  await fs.mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/party-clean-stash.png' });
  await page.keyboard.press('KeyE');
  await page.waitForFunction(
    () => !!window.__RDS.state.players[0].dragging && !window.__RDS.state.bodies[0].hidden,
  );
  assert.deepEqual(errors, []);
  await fs.writeFile(
    'test-results/party-browser.json',
    JSON.stringify(
      {
        passed: true,
        errors,
        fixture: 'development worker response only',
        checks: [
          'hold E progress and cancellation',
          'blood removal',
          'E drag',
          'E stash',
          'E retrieve',
        ],
      },
      null,
      2,
    ),
  );
  console.log(
    'PASS actual keyboard E cleaning and cancellation, E drag, E stash and E retrieve; no JavaScript/WebGL errors',
  );
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
