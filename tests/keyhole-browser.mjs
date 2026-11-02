// Scene setup and the slow inspection clock exist only in intercepted test Workers.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
const base = 'http://127.0.0.1:5184';
const server = spawn(process.execPath, ['server/local.js'], {
  env: { ...process.env, PORT: '5184', RDS_NO_HMR: '1' },
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
    if (i === 99) throw Error('server not ready');
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
    await page.route('**/src/solo-worker.js*', async (route) => {
      const response = await route.fetch(),
        source = await response.text();
      assert.ok(source.includes('sim.start(true);'));
      await route.fulfill({
        response,
        body:
          "import { hides,props } from '/shared/map.js';\n" +
          source.replace('sim.start(true);', 'sim.start(true);\n' + fixture),
      });
    });
    await page.goto(base);
    await page.locator('#solo-fps').click();
    await page.waitForFunction(() => window.__RDS?.state?.mode === 'solo');
    return page;
  };
  for (const [name, count, dark, torch] of [
    ['one-person', 1, false, false],
    ['two-people', 2, false, false],
    ['dark-room', 2, true, false],
    ['one-light', 2, true, true],
  ]) {
    const page = await open(`const tick=sim.tick.bind(sim);sim.tick=dt=>tick(dt*0.25);
   Object.assign(sim.players[0],{f:1,x:-8.9,z:8});
   sim.guards=sim.guards.slice(0,${count});
   sim.guards.forEach((g,i)=>Object.assign(g,{x:-13.5-i*0.7,z:7.2+i*0.9,home:{f:1,x:-13.5-i*0.7,z:7.2+i*0.9},socialNext:Infinity,socialSpot:null,socialStyle:'listen',angle:Math.PI,armed:${torch}&&i===0}));
   sim.lightStates['r1-3']=!${dark};`);
    await page.keyboard.down('ShiftLeft');
    await page.keyboard.down('KeyE');
    await page.waitForFunction(() => window.__RDS.state.players[0].peeking === 'd1-3');
    await page.waitForFunction(
      () => window.__RDS.keyholeBlend > 0 && window.__RDS.keyholeBlend < 1,
    );
    const approach = await page.evaluate(() => window.__RDS.eye.x);
    await page.waitForFunction(
      () => window.__RDS.keyholeBlend === 1 && window.__RDS.eye.x < -10.15,
    );
    await page.waitForFunction(
      () =>
        Math.abs(
          Math.atan2(
            Math.sin(window.__RDS.eye.viewYaw + Math.PI / 2),
            Math.cos(window.__RDS.eye.viewYaw + Math.PI / 2),
          ),
        ) < 0.03,
    );
    const data = await page.evaluate(() => ({
      eye: window.__RDS.eye,
      body: window.__RDS.state.players[0],
      ambient: window.__RDS.roomAmbient['r1-3'],
      beams: window.__RDS.beamLights,
      door: window.__RDS.doorLeaves['d1-3'],
      guards: window.__RDS.state.guards.length,
    }));
    assert.ok(data.eye.x < approach, 'head must approach progressively');
    assert.equal(data.body.x, -8.9);
    assert.equal(data.body.z, 8);
    assert.equal(data.guards, count);
    assert.equal(await page.evaluate(() => window.__RDS.state.doors['d1-3']), false);
    assert.equal(data.door.opaque, true);
    assert.ok(Math.abs(data.door.angle) < 0.02);
    assert.equal(await page.locator('#observation-mask').getAttribute('class'), 'keyhole-mask');
    assert.ok(data.ambient.every((v) => (dark ? v === 0 : v > 0)));
    if (torch)
      assert.ok(
        data.beams.some((v) => v > 0),
        'the real lamp inside must remain visible through the keyhole',
      );
    await page.screenshot({ path: `test-results/keyhole-${name}.png` });
    await page.keyboard.up('KeyE');
    await page.keyboard.up('ShiftLeft');
    await page.waitForFunction(() => window.__RDS.keyholeBlend === 0);
    await page.close();
    results.push(name);
    console.log('PASS keyhole:', name);
  }
  const page = await open(`sim.guards=[];const h=hides.find(h=>h.kind==='wardrobe'&&h.f===1);
  Object.assign(sim.players[0],{f:1,x:h.x,z:h.z});const step=sim.tick.bind(sim);sim.tick=dt=>step(dt*0.25);`);
  const before = await page.evaluate(() => window.__RDS.eye.x);
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__RDS.hideTransitionActive);
  await page.waitForFunction(() =>
    Object.values(window.__RDS.cabinets).some((a) => a.some((v) => Math.abs(v) > 0.3)),
  );
  await page.screenshot({ path: 'test-results/wardrobe-entry-motion.png' });
  await page.waitForFunction(() => !window.__RDS.hideTransitionActive);
  await page.waitForFunction(
    () => document.querySelector('#observation-mask').className === 'cabinet-closed-mask',
  );
  const inside = await page.evaluate(() => window.__RDS.eye.x);
  assert.ok(inside > before + 0.5);
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__RDS.hideTransitionActive);
  await page.waitForFunction(() =>
    Object.values(window.__RDS.cabinets).some((a) => a.some((v) => Math.abs(v) > 0.3)),
  );
  await page.screenshot({ path: 'test-results/wardrobe-exit-motion.png' });
  await page.waitForFunction(() => !window.__RDS.hideTransitionActive);
  await page.waitForFunction((x) => Math.abs(window.__RDS.eye.x - x) < 0.2, before);
  await page.close();
  results.push('wardrobe-entry-exit');
  assert.deepEqual(errors, []);
  await fs.writeFile(
    'test-results/keyhole-browser.json',
    JSON.stringify({ passed: true, results, errors }, null, 2),
  );
  console.log('PASS wardrobe opening, movement inside, closing and reverse exit');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
