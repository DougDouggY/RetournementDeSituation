import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
const port = 5174,
  base = `http://127.0.0.1:${port}`;
await fs.mkdir('test-results', { recursive: true });
const server = spawn(process.execPath, ['server/local.js', '--production'], {
  env: { ...process.env, PORT: String(port), RDS_NIGHT_SECONDS: '25', RDS_NO_HMR: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverOutput = '';
server.stdout.on('data', (d) => (serverOutput += d));
server.stderr.on('data', (d) => (serverOutput += d));
let browser;
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`${base}/api/health`)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
    if (i === 99) throw Error(serverOutput);
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
  const contexts = await Promise.all([
    browser.newContext({ viewport: { width: 800, height: 600 } }),
    browser.newContext({ viewport: { width: 800, height: 600 } }),
  ]);
  const errors = [],
    pages = [];
  for (const c of contexts) {
    await c.addInitScript(() =>
      localStorage.setItem(
        'rds-settings',
        JSON.stringify({ music: 0, effects: 0, voices: 0, low: true }),
      ),
    );
    const p = await c.newPage();
    p.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    p.on('pageerror', (e) => {
      errors.push(e.message);
      console.error(e.stack);
    });
    pages.push(p);
  }
  const [a, b] = pages;
  await Promise.all(pages.map((p) => p.goto(base)));
  await a.locator('.coop-options summary').click();
  await a.locator('#create').click();
  await a.waitForFunction(() => window.__RDS?.myId);
  const code = await a.locator('#room-code').textContent();
  assert.match(code, /^[A-HJ-NP-Z2-9]{6}$/);
  await b.locator('.coop-options summary').click();
  await b.locator('#join-open').click();
  await b.locator('#join-code').fill(code);
  await b.locator('#join').click();
  await b.waitForFunction(() => window.__RDS?.state?.players.length === 2);
  await a.waitForFunction(() => window.__RDS?.state?.players.length === 2);
  console.log('PASS two independent browser contexts joined same private room');
  await b.locator('[data-character="0"]').click();
  await a.waitForFunction(
    () => window.__RDS.state.players.find((p) => p.id === window.__RDS.myId).character === 1,
  );
  console.log('PASS distinct characters synchronize');
  await a.locator('#start').click();
  await Promise.all(
    pages.map((p) => p.waitForFunction(() => window.__RDS.state?.phase === 'infiltration')),
  );
  const id = await a.evaluate(() => window.__RDS.myId),
    getMe = () =>
      a.evaluate(() => window.__RDS.state.players.find((p) => p.id === window.__RDS.myId));
  await a.keyboard.down('KeyD');
  await a.waitForFunction(
    () => window.__RDS.state.players.find((p) => p.id === window.__RDS.myId).x > -19.6,
  );
  await a.keyboard.up('KeyD');
  await a.keyboard.press('KeyE');
  await a.waitForFunction(() => window.__RDS.state.doors['entry-west'] === true);
  await b.waitForFunction(() => window.__RDS.state.doors['entry-west'] === true);
  console.log('PASS door interaction synchronized');
  const original = await getMe();
  await a.keyboard.down('KeyD');
  await a.waitForFunction(
    (x) => window.__RDS.state.players.find((p) => p.id === window.__RDS.myId).x > x + 1,
    original.x,
    { timeout: 12000 },
  );
  await a.keyboard.up('KeyD');
  await b.waitForFunction(
    ({ id, x }) => window.__RDS.state.players.find((p) => p.id === id).x > x + 1,
    { id, x: original.x },
  );
  console.log('PASS real keyboard movement reaches both clients');
  await a.keyboard.press('KeyF');
  await a.waitForFunction(
    () => window.__RDS.state.players.find((p) => p.id === window.__RDS.myId).torch === true,
  );
  await b.waitForFunction(
    (id) => window.__RDS.state.players.find((p) => p.id === id).torch === true,
    id,
  );
  console.log('PASS flashlight synchronization');
  const bottles = (await getMe()).bottles;
  await a.keyboard.press('KeyG');
  await a.waitForFunction(
    (bottles) =>
      window.__RDS.state.players.find((p) => p.id === window.__RDS.myId).bottles === bottles - 1,
    bottles,
  );
  await b.waitForFunction((id) => window.__RDS.state.events.some((e) => e.type === 'noise'), id);
  console.log('PASS bottle inventory and noise event');
  await a.keyboard.down('Tab');
  await a.locator('#scoreboard').waitFor({ state: 'visible' });
  await a.keyboard.up('Tab');
  await a.locator('#scoreboard').waitFor({ state: 'hidden' });
  // Reload closes the transport; sessionStorage restores the same slot/token.
  const partnerId = await b.evaluate(() => window.__RDS.myId);
  await b.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
  await b.locator('#join').click();
  await b.waitForFunction((id) => window.__RDS.myId === id, partnerId);
  await a.waitForFunction(() => !window.__RDS.state.paused);
  console.log('PASS reconnect with same identity, no duplicate player');
  await a.waitForFunction(() => window.__RDS.state.phase === 'ended', null, { timeout: 90000 });
  await b.waitForFunction(() => window.__RDS.state.phase === 'ended', null, { timeout: 15000 });
  const results = await Promise.all(
    pages.map((p) =>
      p.evaluate(() => ({
        result: window.__RDS.state.result,
        remaining: window.__RDS.state.remaining,
        phase: window.__RDS.state.phase,
        guards: window.__RDS.state.guards.length,
        fps: window.__RDS.fps,
        calls: window.__RDS.drawCalls,
      })),
    ),
  );
  assert.equal(results[0].result, results[1].result);
  assert.equal(results[0].guards, 8);
  assert.ok(['defeat', 'perfect', 'imperfect'].includes(results[0].result));
  console.log('PASS complete accelerated round with two real browser clients', results);
  await a.screenshot({ path: 'test-results/two-clients-round.png' });
  assert.deepEqual(errors, [], `browser errors: ${errors.join('\n')}`);
  await fs.writeFile(
    'test-results/browser.json',
    JSON.stringify({ passed: true, contexts: 2, nightSeconds: 25, results, errors }, null, 2),
  );
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
