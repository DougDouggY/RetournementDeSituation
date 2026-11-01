// Deterministic visual fixtures live only in intercepted development Worker responses.
// No test controls are added to the published application.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
const base = 'http://127.0.0.1:5183';
const server = spawn(process.execPath, ['server/local.js'], {
  env: { ...process.env, PORT: '5183', RDS_NO_HMR: '1' },
  stdio: 'ignore',
});
let browser;
const errors = [],
  results = [];
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(base + '/api/health')).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
    if (i === 99) throw new Error('visual review server did not become ready');
  }
  await fs.mkdir('test-results', { recursive: true });
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
  const open = async (fixture) => {
    const page = await browser.newPage({ viewport: { width: 960, height: 640 } });
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
      const response = await route.fetch(),
        source = await response.text();
      assert.ok(source.includes('sim.start(true);'));
      await route.fulfill({
        response,
        body:
          "import { props, hides, bushes } from '/shared/map.js';\n" +
          source.replace('sim.start(true);', 'sim.start(true);\n' + fixture),
      });
    });
    await page.goto(base);
    await page.locator('#solo-fps').click();
    await page.waitForFunction(() => window.__RDS?.state?.mode === 'solo');
    return page;
  };
  const shot = async (page, name) => {
    await page.screenshot({ path: `test-results/review-${name}.png` });
    results.push(name);
    console.log('PASS visual fixture:', name);
  };

  let page = await open('sim.guards = []; Object.assign(sim.players[0], {x:-26.1,z:-1});');
  await page.waitForFunction(() =>
    window.__RDS.doorLeaves['entry-west'].surfaceGlow.every((v) => v > 0.1),
  );
  await shot(page, 'door-brown');
  await page.keyboard.press('KeyB');
  assert.equal(await page.evaluate(() => window.__RDS.state.doors['entry-west']), false);
  await page.keyboard.down('KeyE');
  await page.waitForFunction(() => window.__RDS.state.players[0].doorPeek === 'entry-west');
  await page.waitForFunction(() => window.__RDS.doorLeaves['entry-west'].angle > 0.3);
  assert.equal(await page.evaluate(() => window.__RDS.doorLeaves['entry-west'].opaque), true);
  assert.equal(await page.evaluate(() => window.__RDS.state.players[0].x), -26.1);
  await shot(page, 'door-slit');
  await page.keyboard.up('KeyE');
  await page.waitForFunction(() => window.__RDS.state.doors['entry-west'] === false);
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__RDS.state.doors['entry-west'] === true);
  await page.close();

  page = await open(`const g = sim.guards[0]; sim.guards = [g]; Object.assign(g, {
    x:-14,z:-24.5,home:{f:1,x:-14,z:-24.5},socialNext:Infinity,socialStyle:'dance',socialSpot:null
  }); Object.assign(sim.players[0], {x:-22,z:-24.5});`);
  await page.waitForFunction(() => window.__RDS.visibleGuards.includes('g0'));
  await shot(page, 'bar-standing-silhouette');
  await page.keyboard.press('F2');
  await page.waitForFunction(() => window.__RDS.viewMode === 'top');
  assert.ok(await page.evaluate(() => window.__RDS.visibleGuards.includes('g0')));
  await shot(page, 'terrace-top');
  await page.close();

  page = await open('sim.guards = []; Object.assign(sim.players[0], {x:14,z:-28});');
  await page.keyboard.down('ShiftLeft');
  await page.waitForFunction(() => window.__RDS.state.players[0].crouching);
  await page.waitForFunction(() => window.__RDS.foliage.some((b) => b.opacity < 0.5));
  await shot(page, 'bush-observation');
  await page.close();

  page = await open(`sim.guards = []; const shelter = props.find(p=>p.outdoor);
    const h = hides.find(h=>h.prop===shelter.id); Object.assign(sim.players[0],{x:h.x,z:h.z});`);
  const before = await page.evaluate(() => ({
    x: window.__RDS.state.players[0].x,
    z: window.__RDS.state.players[0].z,
  }));
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => !!window.__RDS.state.players[0].hidden);
  await page.keyboard.down('KeyE');
  await page.waitForFunction(() => window.__RDS.state.players[0].hidePeek);
  await page.waitForFunction(() =>
    Object.values(window.__RDS.cabinets).some((angles) => angles.some((a) => Math.abs(a) > 0.1)),
  );
  await shot(page, 'garden-shelter-observation');
  await page.keyboard.up('KeyE');
  await page.waitForFunction(() => !window.__RDS.state.players[0].hidePeek);
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => !window.__RDS.state.players[0].hidden);
  assert.deepEqual(
    await page.evaluate(() => ({
      x: window.__RDS.state.players[0].x,
      z: window.__RDS.state.players[0].z,
    })),
    before,
  );
  await page.close();

  for (const [name, x, z] of [
    ['salon', -22, -8],
    ['office', -23, 8],
  ]) {
    page = await open(`sim.guards = []; Object.assign(sim.players[0], {x:${x},z:${z}});`);
    await shot(page, name + '-fps');
    await page.keyboard.press('F2');
    await page.waitForFunction(() => window.__RDS.viewMode === 'top');
    await shot(page, name + '-top');
    await page.close();
  }
  assert.deepEqual(errors, []);
  await fs.writeFile(
    'test-results/visual-review.json',
    JSON.stringify({ passed: true, fixtures: results, errors }, null, 2),
  );
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
