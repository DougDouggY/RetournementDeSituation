import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../shared/simulation.js';
import { Room, validCode, makeCode, allowedOrigin } from '../server/room.js';
import {
  FLOOR_IDS,
  WORLD,
  doors,
  stairs,
  hides,
  blocked,
  pathfind,
  lineClear,
  distance,
} from '../shared/map.js';
function game(options) {
  const s = new Simulation({ scenario: 'hunt', ...options });
  s.addPlayer('a', 0);
  s.addPlayer('b', 1);
  s.start();
  return s;
}
function advance(s, seconds) {
  for (let i = 0; i < Math.ceil(seconds / 0.05); i++) s.tick(0.05);
}
const socket = () => ({
  readyState: 1,
  messages: [],
  send(m) {
    this.messages.push(JSON.parse(m));
  },
  close() {},
});
test('private two-seat rooms, unique characters, only host starts', () => {
  const code = makeCode();
  assert.ok(validCode(code));
  assert.ok(!validCode('../bad'));
  const r = new Room(code),
    a = socket(),
    b = socket(),
    c = socket();
  const ma = r.join(a, 'one'),
    mb = r.join(b, 'two');
  assert.equal(r.join(c, 'three'), undefined);
  assert.match(c.messages[0].message, /complet/);
  r.message(mb, JSON.stringify({ type: 'start' }));
  assert.equal(r.sim.phase, 'lobby');
  r.message(ma, JSON.stringify({ type: 'character', character: 1 }));
  assert.deepEqual(
    r.sim.players.map((p) => p.character),
    [1, 0],
  );
  r.message(ma, JSON.stringify({ type: 'start' }));
  assert.equal(r.sim.phase, 'infiltration');
});
test('disconnect pauses, reconnect preserves identity, duplicate rejected', () => {
  const r = new Room('ABC234'),
    a = socket(),
    b = socket();
  const ma = r.join(a, 'a');
  r.join(b, 'b');
  r.sim.start();
  r.leave(ma, a);
  r.tick(Date.now() + 50);
  assert.equal(r.paused, true);
  assert.equal(r.sim.players[0].connected, false);
  assert.equal(r.join(socket(), 'a').id, ma.id);
  r.tick(Date.now() + 100);
  assert.equal(r.paused, false);
  assert.equal(r.join(socket(), 'a'), undefined);
});
test('ten-second intro; solo practice explicit; rematch resets state', () => {
  const solo = new Simulation();
  solo.addPlayer('x');
  assert.equal(solo.start(), false);
  assert.equal(solo.start(true), true);
  const s = game();
  s.guards = [];
  advance(s, 9);
  assert.equal(s.phase, 'intro');
  advance(s, 1.1);
  assert.equal(s.phase, 'playing');
  s.phase = 'ended';
  s.players[0].bottles = 0;
  s.doorStates['d1-0'] = true;
  s.start();
  assert.equal(s.players[0].bottles, 3);
  assert.equal(s.doorStates['d1-0'], false);
});
test('all room entries, stairs and hide approaches reachable on both floors', () => {
  for (const f of FLOOR_IDS) {
    for (const d of doors.filter((d) => d.f === f))
      assert.ok(
        pathfind(f, { x: 0, z: 0 }, { x: d.x, z: d.z + (d.z < 0 ? -1.5 : 1.5) }).length,
        `door ${d.id}`,
      );
    for (const h of hides.filter((h) => h.f === f)) {
      assert.ok(!blocked(f, h.x, h.z, {}, 0.32, true), `hide approach ${h.id}`);
      assert.ok(pathfind(f, { x: 0, z: 0 }, h).length, `hide ${h.id}`);
    }
    for (const st of stairs.filter((st) => st.f === f))
      assert.ok(pathfind(f, { x: 0, z: 0 }, st).length);
  }
});
test('collisions: exterior, internal walls, doors, furniture', () => {
  const s = game(),
    p = s.players[0];
  Object.assign(p, { f: 1, x: 4, z: 1 });
  s.move(p, -3, 0);
  assert.ok(p.x > 3.3);
  s.doorStates['d1-0'] = true;
  s.move(p, -3, 0);
  assert.ok(p.x < 3);
  Object.assign(p, { x: -5, z: -7 });
  s.move(p, 2, 0);
  assert.ok(p.x < -4.3);
  Object.assign(p, { x: -17, z: -8 });
  s.move(p, 0, -4);
  assert.ok(p.z > -9);
  Object.assign(p, { x: WORLD.maxX - 1, z: 20 });
  s.move(p, 10, 0);
  assert.ok(p.x <= WORLD.maxX - 0.32);
});
test('every door toggles; both staircases transition to their own clear landing', () => {
  const s = game(),
    p = s.players[0];
  for (const d of doors.filter((d) => !d.window)) {
    const n = d.axis === 'z' ? { x: 1, z: 0 } : { x: 0, z: 1 };
    let found = false;
    for (const sign of [1, -1]) {
      Object.assign(p, {
        f: d.f,
        x: d.x + n.x * 0.8 * sign,
        z: d.z + n.z * 0.8 * sign,
        hidden: null,
      });
      if (s.nearby(p)?.obj.id === d.id) {
        found = true;
        break;
      }
    }
    assert.ok(found, d.id);
    s.interact(p.id);
    assert.equal(s.doorStates[d.id], true, d.id);
    s.interact(p.id);
    assert.equal(s.doorStates[d.id], false, d.id);
  }
  for (const st of stairs) {
    Object.assign(p, { f: st.f, x: st.x, z: st.z });
    s.interact(p.id);
    assert.equal(p.f, st.to);
    assert.equal(p.x, st.landing.x);
    assert.equal(p.z, st.landing.z);
    assert.equal(blocked(p.f, p.x, p.z, s.doorStates), false);
  }
});
test('directional vision blocked by walls, closed doors and opaque furniture; crouching helps', () => {
  const s = game(),
    g = s.guards[0],
    p = s.players[0];
  Object.assign(g, { f: 1, x: 4, z: 1, angle: -Math.PI / 2 });
  Object.assign(p, { f: 1, x: 2, z: 1, input: {} });
  assert.equal(s.canSee(g, p), false);
  s.doorStates['d1-0'] = true;
  assert.equal(s.canSee(g, p), true);
  g.angle = Math.PI / 2;
  assert.equal(s.canSee(g, p), false);
  Object.assign(g, { x: -5, z: -7, angle: Math.PI / 2 });
  Object.assign(p, { x: -3, z: -7 });
  assert.equal(s.canSee(g, p), false);
  assert.equal(lineClear(1, { x: -19, z: -10 }, { x: -15, z: -10 }, s.doorStates), false);
  Object.assign(g, { x: -34, z: 8, angle: Math.PI / 2 });
  Object.assign(p, { x: -28, z: 8 });
  assert.equal(s.canSee(g, p), true);
  p.input.crouch = true;
  assert.equal(s.canSee(g, p), false);
});
test('hearing follows noise source, attenuates through walls, ignores other floors', () => {
  const s = game(),
    g = s.guards[0];
  Object.assign(g, { f: 1, x: -34, z: 8, state: 'patrol' });
  s.noise(1, -31, 8, 8, 'bottle');
  assert.equal(g.state, 'suspicion');
  assert.deepEqual(g.last, { f: 1, x: -31, z: 8 });
  g.state = 'patrol';
  s.noise(2, -34, 8, 20, 'upstairs');
  assert.equal(g.state, 'patrol');
  Object.assign(g, { x: -6, z: -7 });
  s.noise(1, -2, -7, 5, 'wall');
  assert.equal(g.state, 'patrol');
});
test('hiding extinguishes torch, blocks vision, physical inspection finds player', () => {
  const s = game(),
    p = s.players[0],
    h = hides.find((h) => h.f === 1 && h.kind === 'sofa');
  Object.assign(p, { x: h.x, z: h.z, f: h.f, torch: true });
  s.interact(p.id);
  assert.equal(p.hidden, h.id);
  assert.equal(p.torch, false);
  const g = s.guards[0];
  Object.assign(g, { f: p.f, x: p.x, z: p.z + 1, angle: Math.PI });
  assert.equal(s.canSee(g, p), false);
  g.sawHide = h.id;
  g.state = 'inspection';
  s.updateGuard(g, 0.05);
  assert.equal(p.status, 'captured');
  assert.equal(p.hidden, null);
});
test('torch, bottle collision and inventory controlled by authority', () => {
  const s = game(),
    p = s.players[0];
  s.action('a', 'torch');
  assert.equal(p.torch, true);
  Object.assign(p, { x: 0, z: 0, angle: 0 });
  for (let i = 0; i < 5; i++) s.action('a', 'throw');
  assert.equal(p.bottles, 0);
  assert.equal(s.thrown.length, 3);
  for (const b of s.thrown) assert.ok(!blocked(b.f, b.x, b.z, s.doorStates, 0.04));
  assert.equal(
    s.noises.some((n) => n.radius === 16),
    false,
    'noise waits for impact',
  );
  for (let i = 0; i < 20; i++) s.tick(0.05);
  assert.ok(s.noises.some((n) => n.radius === 16));
});
test('capture, continuous 2.5-second rescue, 75-second elimination', () => {
  const s = game(),
    [p, mate] = s.players,
    g = s.guards[0];
  s.phase = 'playing';
  Object.assign(p, { x: 0, z: 0, hp: 1 });
  Object.assign(g, { f: 1, x: 0, z: -0.6, angle: 0, state: 'chase', attack: 0 });
  s.updateGuard(g, 0.05);
  assert.equal(p.status, 'captured');
  assert.equal(g.state, 'escort');
  s.guards = [];
  Object.assign(mate, { x: 0.8, z: 0, input: { use: true } });
  advance(s, 2);
  assert.equal(p.status, 'captured');
  advance(s, 0.7);
  assert.equal(p.status, 'free');
  assert.equal(p.hp, 2);
  assert.ok(p.invuln > 0);
  s.capture(g, p);
  s.guards = [];
  mate.input = {};
  advance(s, 76);
  assert.equal(p.status, 'eliminated');
});
test('double capture defeat; perfect and imperfect timed victories', () => {
  const lose = game();
  lose.players.forEach((p) => (p.status = 'captured'));
  lose.tick(0.05);
  assert.equal(lose.result, 'defeat');
  const win = game({ duration: 0.2 });
  win.guards = [];
  win.phase = 'playing';
  advance(win, 0.3);
  assert.equal(win.result, 'perfect');
  const half = game({ duration: 0.2 });
  half.guards = [];
  half.phase = 'playing';
  half.players[1].status = 'captured';
  half.players[1].bleed = 60;
  advance(half, 0.3);
  assert.equal(half.result, 'imperfect');
});
test('eight agents navigate full nine-minute night without crossing obstacles or teleporting', () => {
  const s = game();
  s.players.forEach((p) => (p.hidden = 'test-safety'));
  s.phase = 'playing';
  const floors = new Set(),
    states = new Set();
  let previous = s.guards.map((g) => ({ ...g }));
  const start = performance.now();
  for (let tick = 0; tick < 5401; tick++) {
    s.tick(0.1);
    for (let i = 0; i < 8; i++) {
      const g = s.guards[i],
        prev = previous[i];
      floors.add(g.f);
      states.add(g.state);
      assert.ok(!blocked(g.f, g.x, g.z, s.doorStates, 0.3), `${g.id} ${g.f}:${g.x},${g.z}`);
      if (g.f === prev.f) assert.ok(distance(g, prev) < 0.5, 'no teleport');
    }
    previous = s.guards.map((g) => ({ ...g }));
  }
  assert.deepEqual([...floors].sort(), [1, 2]);
  assert.ok(states.has('inspection'));
  assert.equal(s.phase, 'ended');
  assert.ok(performance.now() - start < 30000);
});
test('every hide can be entered and left; darkness reduces detection and lamps reveal', () => {
  const s = game(),
    p = s.players[0];
  for (const h of hides) {
    Object.assign(p, { f: h.f, x: h.x, z: h.z, hidden: null });
    assert.equal(s.nearby(p)?.kind, 'hide', h.id);
    s.interact('a');
    assert.equal(p.hidden, h.id);
    s.interact('a');
    assert.equal(p.hidden, null);
  }
  const g = s.guards[0];
  Object.assign(g, { f: 1, x: -16, z: -9, angle: Math.PI / 2 });
  Object.assign(p, { f: 1, x: -10, z: -9, input: {}, torch: false });
  assert.equal(s.canSee(g, p), true);
  s.lightStates['r1-0'] = false;
  assert.equal(s.canSee(g, p), false);
  p.torch = true;
  assert.equal(s.canSee(g, p), true);
});

test('malformed packets and origins are rejected without crashing authority', () => {
  const r = new Room('ABC234'),
    m = r.join(socket(), 'safe');
  for (const raw of ['null', '[]', 'bad json', '42', '"string"'])
    assert.doesNotThrow(() => r.message(m, raw));
  assert.equal(r.sim.phase, 'lobby');
  assert.equal(allowedOrigin('null', 'example.com'), false);
  assert.equal(allowedOrigin('https://evil.example', 'example.com'), false);
  assert.equal(allowedOrigin('https://example.com', 'example.com'), true);
});
test('solo has exactly one killer, eight hunters, singular introduction and a proper solo victory', () => {
  const s = new Simulation({ duration: 0.2, scenario: 'hunt' });
  s.addPlayer('solo', 1);
  assert.equal(s.start(true), true);
  assert.equal(s.players.length, 1);
  assert.equal(s.guards.length, 8);
  assert.equal(s.snapshot().mode, 'solo');
  assert.match(s.events[0].text, /IL EST TOUT SEUL/);
  assert.equal(s.addPlayer('unwanted', 0), null);
  s.guards = [];
  s.phase = 'playing';
  advance(s, 0.3);
  assert.equal(s.result, 'solo');
  assert.equal(s.start(true), true);
  assert.equal(s.players.length, 1);
  assert.equal(s.guards.length, 8);
});
test('solo capture ends the round without suggesting an impossible rescue', () => {
  const s = new Simulation();
  const p = s.addPlayer('solo');
  s.start(true);
  s.capture(s.guards[0], p);
  s.tick(0.05);
  assert.equal(s.result, 'defeat');
  assert.equal(s.phase, 'ended');
  assert.ok(s.events.some((e) => e.type === 'capture' && e.text.includes('Personne ne viendra')));
});
