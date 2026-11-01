import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../shared/simulation.js';
import {
  illuminationAt,
  inBush,
  bushes,
  peekView,
  props,
  hides,
  devices,
  doors,
  pathfind,
  distance,
  canObserve,
  stairs,
  stairVoids,
  blocked,
} from '../shared/map.js';
function game() {
  const s = new Simulation();
  s.addPlayer('p');
  s.start(true);
  return s;
}
function advance(s, t) {
  for (let i = 0; i < t * 20; i++) s.tick(0.05);
}

test('darkness prevents sight, light requires facing, and crouched bushes provide cover without blocking walking', () => {
  const s = game(),
    p = s.players[0],
    g = s.guards[0];
  Object.assign(g, { f: 1, x: -34, z: 8, angle: Math.PI / 2, armed: false });
  Object.assign(p, { f: 1, x: -31, z: 8, input: {}, torch: false });
  assert.equal(illuminationAt(p, s.lightStates, s.power), 0);
  assert.equal(s.canSee(g, p), false);
  Object.assign(g, { x: -34, z: 1 });
  Object.assign(p, { x: -31, z: 1 });
  assert.ok(illuminationAt(p) > 0.18);
  assert.equal(s.canSee(g, p), true);
  g.angle = -Math.PI / 2;
  assert.equal(s.canSee(g, p), false);
  const b = bushes.find((b) => b.x === -32 && b.z === -8);
  Object.assign(p, { x: b.x, z: b.z, input: { crouch: true } });
  assert.ok(inBush(p));
  assert.equal(b.solid, false);
  p.torch = true;
  Object.assign(g, { x: b.x - 3, z: b.z, angle: Math.PI / 2 });
  assert.equal(s.canSee(g, p), true, 'a torch exposes the player even in bushes');
  p.torch = false;
  assert.equal(s.canSee(g, p), false);
});

test('terrace cover spans both approaches and garden shelters allow E observation and safe exit', () => {
  assert.ok(bushes.some((b) => b.z <= -27 && b.x > 18));
  assert.ok(bushes.some((b) => b.z <= -27 && b.x < -18));
  const shelters = props.filter((p) => p.outdoor && p.type === 'wardrobe');
  assert.equal(shelters.length, 2);
  for (const shelter of shelters) {
    const s = game(),
      p = s.players[0];
    const h = hides.find((h) => h.prop === shelter.id);
    assert.equal(blocked(1, h.x, h.z), false);
    Object.assign(p, { f: 1, x: h.x, z: h.z });
    const before = { x: p.x, z: p.z };
    s.setInput('p', { use: true });
    s.action('p', 'beginUse');
    s.action('p', 'endUse');
    assert.equal(p.hidden, h.id);
    s.action('p', 'beginUse');
    s.time += 0.5;
    s.updatePeek(p, false);
    assert.equal(p.hidePeek, true);
    assert.equal(
      blocked(1, peekView(p, s.doorStates).x, peekView(p, s.doorStates).z, s.doorStates, 0.05),
      false,
    );
    s.action('p', 'endUse');
    assert.equal(p.hidePeek, false);
    s.action('p', 'beginUse');
    s.action('p', 'endUse');
    assert.equal(p.hidden, null);
    assert.deepEqual({ x: p.x, z: p.z }, before);
  }
});

test('E hold opens a narrow slit and release closes it', () => {
  const s = game(),
    p = s.players[0];
  Object.assign(p, { x: -26.1, z: -1 });
  s.setInput('p', { crouch: true, use: true });
  s.action('p', 'beginUse');
  s.time += 0.6;
  s.updatePeek(p, false);
  assert.equal(p.doorPeek, 'entry-west');
  assert.equal(s.doorStates['entry-west'], 'ajar');
  assert.ok(peekView(p, s.doorStates).x < -25);
  assert.equal(p.x, -26.1);
  s.action('p', 'endUse');
  assert.equal(p.doorPeek, null);
  assert.equal(s.doorStates['entry-west'], false);
});

test('E hides inside a wardrobe, hold peeks with exposure, release closes, short E exits to free floor', () => {
  const s = game(),
    p = s.players[0],
    h = hides.find((h) => h.kind === 'wardrobe' && h.f === 1),
    prop = props.find((p) => p.id === h.prop);
  Object.assign(p, { x: h.x, z: h.z, f: h.f });
  const outside = { x: p.x, z: p.z };
  s.setInput('p', { use: true });
  s.action('p', 'beginUse');
  s.action('p', 'endUse');
  assert.equal(p.hidden, h.id);
  assert.equal(p.x, prop.x);
  assert.equal(p.z, prop.z);
  s.action('p', 'beginUse');
  s.time += 0.5;
  s.updatePeek(p, false);
  assert.equal(p.hidePeek, true);
  const eye = peekView(p, s.doorStates),
    g = s.guards[0];
  Object.assign(g, { f: p.f, x: eye.x - 2, z: eye.z, angle: Math.PI / 2, armed: false });
  assert.equal(s.canSee(g, p), true, 'someone looking at the opened cabinet can see its occupant');
  s.action('p', 'endUse');
  assert.equal(p.hidePeek, false);
  assert.equal(s.canSee(g, p), false);
  s.action('p', 'beginUse');
  s.action('p', 'endUse');
  assert.equal(p.hidden, null);
  assert.equal(p.x, outside.x);
  assert.equal(p.z, outside.z);
});

test('an invited guest reacts to a local switch and walks over to restore it', () => {
  const s = game(),
    p = s.players[0],
    g = s.guards[0],
    d = devices.find((d) => d.type === 'light' && d.room === 'r1-3');
  Object.assign(g, { f: d.f, x: d.x - 0.4, z: d.z, challenge: null, state: 'party' });
  Object.assign(p, { f: d.f, x: d.x, z: d.z });
  s.interact('p');
  assert.equal(s.lightStates[d.room], false);
  assert.equal(g.lightRepair.device, d.id);
  assert.ok(g.say.includes('lumière'));
  p.f = 2;
  p.x = -15;
  p.z = -10;
  for (let i = 0; i < 40; i++) s.updateRepair(g, 0.05);
  assert.equal(s.lightStates[d.room], true);
});

test('alert pursuer breaks a blocked door and its destroyed state persists', () => {
  const s = game(),
    g = s.guards[0],
    p = s.players[0],
    id = 'd1-3';
  s.phase = 'playing';
  s.doorLocks[id] = { region: 'r1-3', at: s.time, player: 'p' };
  Object.assign(g, {
    f: 1,
    x: -8.8,
    z: 8,
    path: [],
    pathAt: -2,
    pathEnd: null,
    angle: -Math.PI / 2,
  });
  const destination = { f: 1, x: -12, z: 8 };
  for (let i = 0; i < 140; i++) s.navigate(g, destination, 0.05, 2);
  assert.equal(s.brokenDoors[id], true);
  assert.equal(s.doorStates[id], true);
  assert.equal(s.doorLocks[id], undefined);
  Object.assign(p, { f: 1, x: -11, z: 8 });
  s.toggleLock(p);
  assert.equal(s.doorLocks[id], undefined);
  assert.equal(s.doorStates[id], true);
});

test('alternate-route planner never crosses a locked door', () => {
  const d = doors.find((d) => d.id === 'wc-garage'),
    a = { f: 1, x: 19, z: 5 },
    b = { f: 1, x: 19, z: 7 };
  const route = pathfind(1, a, b, {}, [d.id]);
  assert.ok(route.length);
  assert.ok(route.every((p) => Math.abs(p.z - d.z) > 0.35 || Math.abs(p.x - d.x) > 0.85));
});

test('stairs retain a timed ascending and descending transition rather than a visual teleport', () => {
  const s = game(),
    p = s.players[0],
    up = stairs.find((s) => s.id === 'main-up');
  s.beginStair(p, up);
  assert.equal(p.f, 2);
  assert.equal(p.stair.fromF, 1);
  advance(s, 0.5);
  assert.ok(p.stair.elapsed > 0 && p.stair.elapsed < p.stair.duration);
  advance(s, 1.0);
  assert.equal(p.stair, null);
  s.beginStair(
    p,
    stairs.find((s) => s.id === 'main-down'),
  );
  assert.equal(p.stair.fromF, 2);
  assert.equal(p.f, 1);
});

test('bar occludes its own geometry without hiding complete people in visual visibility checks', () => {
  const viewer = { f: 1, x: -18, z: -26 },
    guest = { f: 1, x: -18, z: -23 };
  assert.equal(canObserve(viewer, guest, {}), true);
});

test('pursuer uses an accessible alternate entrance before bashing a nearby locked door', () => {
  const s = game(),
    g = s.guards[0];
  s.phase = 'playing';
  s.doorLocks['wc-garage'] = { region: 'r1-4', at: 0 };
  Object.assign(g, { f: 1, x: 19, z: 5, path: [], pathAt: -2, angle: -Math.PI / 2 });
  s.navigate(g, { f: 1, x: 12, z: 10 }, 0.05, 2);
  assert.equal(g.bashing, null);
  assert.ok(g.path.some((p) => p.x <= 11));
  assert.ok(g.path.every((p) => Math.hypot(p.x - 19, p.z - 6) > 0.5));
});

test('one E action moves and drops a body; holding E at its blood cleans instead', () => {
  const s = game(),
    p = s.players[0];
  Object.assign(p, { f: 1, x: -31, z: 8 });
  s.bodies.push({ id: 'body', f: 1, x: -31, z: 8, draggedBy: null });
  s.addBlood(p);
  s.setInput('p', { use: true });
  s.action('p', 'beginUse');
  s.action('p', 'endUse');
  assert.equal(p.dragging, 'body');
  s.action('p', 'beginUse');
  assert.equal(p.dragging, null);
  s.action('p', 'beginUse');
  s.time += 0.5;
  for (let i = 0; i < 65; i++) {
    s.time += 0.05;
    s.updatePeek(p, false, 0.05);
  }
  s.action('p', 'endUse');
  assert.equal(s.blood.length, 0);
  assert.equal(p.dragging, null);
});

test('a closed keyhole reveals the office light state without opening or moving the player', () => {
  const s = game(),
    p = s.players[0];
  Object.assign(p, { f: 1, x: -8.9, z: 8, peeking: 'd1-3' });
  const eye = peekView(p, s.doorStates);
  s.lightStates['r1-3'] = false;
  assert.equal(illuminationAt(eye, s.lightStates, s.power), 0);
  s.lightStates['r1-3'] = true;
  assert.equal(illuminationAt(eye, s.lightStates, s.power), 1);
  assert.equal(s.doorStates['d1-3'], false);
  assert.equal(p.x, -8.9);
});

test('rematch clears stair and cabinet observation transitions', () => {
  const s = game(),
    p = s.players[0];
  p.stair = { fromF: 1, toF: 2 };
  p.hidePeek = true;
  p.hideReturn = { x: 0, z: 0 };
  s.phase = 'ended';
  s.start(true);
  assert.equal(s.players[0].stair, null);
  assert.equal(s.players[0].hidePeek, false);
  assert.equal(s.players[0].hideReturn, null);
});

test('stair openings cannot be walked over; movement along the flight automatically uses stairs', () => {
  const s = game(),
    p = s.players[0],
    hole = stairVoids[0];
  assert.equal(blocked(2, hole.x, hole.z, {}, 0.32), true);
  Object.assign(p, { f: 1, x: -3, z: 10.6 });
  s.setInput('p', { x: 0, z: -1 });
  s.tick(0.05);
  assert.equal(p.f, 2);
  assert.equal(p.stair.fromF, 1);
  p.stair = null;
  Object.assign(p, { x: -3, z: 5.5 });
  s.setInput('p', { x: 0, z: 1 });
  s.tick(0.05);
  assert.equal(p.f, 1);
  assert.equal(p.stair.fromF, 2);
});
