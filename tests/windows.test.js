import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../shared/simulation.js';
import {
  rooms,
  props,
  doors,
  devices,
  roomAt,
  regionAt,
  blocked,
  lineClear,
  visibleRegions,
  windowNormal,
  windowLanding,
  nearWindow,
} from '../shared/map.js';
const advance = (s, t) => {
  for (let i = 0; i < Math.ceil(t / 0.05); i++) s.tick(0.05);
};
function solo() {
  const s = new Simulation();
  s.addPlayer('p');
  s.start(true);
  return s;
}
test('rooms have genuinely different areas and floor-specific arrangements, with furniture inside bounds', () => {
  assert.ok(new Set(rooms.map((r) => r.w * r.d)).size >= 5);
  assert.ok(
    Math.max(...rooms.map((r) => r.w * r.d)) / Math.min(...rooms.map((r) => r.w * r.d)) >= 2,
  );
  assert.notDeepEqual(
    rooms.filter((r) => r.f === 1).map((r) => r.x),
    rooms.filter((r) => r.f === 2).map((r) => r.x),
  );
  for (const r of rooms) {
    assert.equal(roomAt(r.f, r.x, r.z).id, r.id);
    for (const p of props.filter((p) => p.room === r.id)) {
      assert.ok(Math.abs(p.x - r.x) + p.w / 2 <= r.w / 2 + 0.01, `${p.id} across side wall`);
      assert.ok(Math.abs(p.z - r.z) + p.d / 2 <= r.d / 2 + 0.01, `${p.id} across end wall`);
    }
  }
});
test('six ground-floor rooms have their own window and free landings on both sides', () => {
  const windows = doors.filter((d) => d.window);
  assert.equal(windows.length, 6);
  assert.equal(new Set(windows.map((d) => d.room)).size, 6);
  for (const d of windows) {
    const n = windowNormal(d);
    for (const sign of [1, -1]) {
      const p = { f: d.f, x: d.x + n.x * 1.05 * sign, z: d.z + n.z * 1.05 * sign };
      assert.ok(nearWindow(p, d));
      const dest = windowLanding(p, d);
      assert.ok(dest, d.id);
      assert.equal(blocked(d.f, dest.x, dest.z), false);
    }
  }
});
test('closed glass reveals only its room when close and aligned, and hides it when walking away', () => {
  for (const d of doors.filter((d) => d.window)) {
    const n = windowNormal(d),
      p = { f: 1, x: d.x + n.x * 1.4, z: d.z + n.z * 1.4 };
    assert.ok(visibleRegions(p, {}).has(d.room), d.id);
    assert.ok(lineClear(1, p, { x: d.x - n.x, z: d.z - n.z }, {}));
    assert.equal(lineClear(1, p, { x: d.x - n.x, z: d.z - n.z }, {}, false, false), false);
    p.x += n.x * 3;
    p.z += n.z * 3;
    assert.equal(visibleRegions(p, {}).has(d.room), false);
  }
  const p = { f: 1, x: -26, z: 11 };
  assert.deepEqual([...visibleRegions(p, {})], ['outside']);
});
test('windows always block walking, even after unlocking; V climbs across with an animated height', () => {
  for (const d of doors.filter((d) => d.window)) {
    const s = solo(),
      p = s.players[0],
      n = windowNormal(d);
    Object.assign(p, { x: d.x + n.x * 1.05, z: d.z + n.z * 1.05 });
    s.action(p.id, 'climb');
    assert.equal(p.climb, null);
    s.doorStates[d.id] = true;
    s.move(p, -n.x * 2, -n.z * 2);
    assert.equal(regionAt(1, p.x, p.z), 'outside');
    s.action(p.id, 'climb');
    assert.ok(p.climb);
    advance(s, 0.35);
    assert.ok(p.climbHeight > 0.4);
    assert.ok(p.climb);
    advance(s, 0.6);
    assert.equal(p.climb, null);
    assert.equal(p.climbHeight, 0);
    assert.equal(regionAt(1, p.x, p.z), d.room);
    assert.equal(blocked(1, p.x, p.z, s.doorStates), false);
    s.action(p.id, 'climb');
    advance(s, 1);
    assert.equal(regionAt(1, p.x, p.z), 'outside');
  }
});
test('climbing requires proximity, a clear landing and free hands', () => {
  const s = solo(),
    p = s.players[0],
    d = doors.find((d) => d.id === 'window-office');
  s.doorStates[d.id] = true;
  Object.assign(p, { x: -29, z: 6 });
  s.action(p.id, 'climb');
  assert.equal(p.climb, null);
  Object.assign(p, { x: -26, z: 6, dragging: 'occupied' });
  s.action(p.id, 'climb');
  assert.equal(p.climb, null);
  p.dragging = null;
  s.action(p.id, 'climb');
  assert.ok(p.climb);
  s.action(p.id, 'throw');
  assert.equal(p.bottles, 3);
  advance(s, 1);
  assert.equal(regionAt(1, p.x, p.z), 'r1-3');
});
test('a closed window cannot be used to stab or pick up a body through the glass', () => {
  const s = solo(),
    p = s.players[0],
    d = doors.find((d) => d.id === 'window-office'),
    g = s.guards[0];
  Object.assign(p, { x: -25.5, z: 6 });
  Object.assign(g, { x: -24.2, z: 6 });
  s.guards = [g];
  s.action(p.id, 'attack');
  assert.equal(g.alive, true);
  s.bodies = [{ id: 'test', f: 1, x: -24.2, z: 6, draggedBy: null }];
  s.action(p.id, 'drag');
  assert.equal(p.dragging, null);
});
test('the outside breaker controls the whole villa; local switches cannot bypass an outage', () => {
  const s = solo(),
    p = s.players[0],
    outside = devices.find((d) => d.type === 'breaker' && d.room === 'outside');
  assert.equal(s.power, true);
  const initial = { ...s.lightStates };
  Object.assign(p, { f: outside.f, x: outside.x, z: outside.z });
  assert.equal(s.nearby(p).obj.id, outside.id);
  s.interact(p.id);
  assert.equal(s.power, false);
  assert.equal(s.snapshot().power, false);
  assert.deepEqual(s.lightStates, initial);
  const light = devices.find((d) => d.type === 'light');
  Object.assign(p, { f: light.f, x: light.x, z: light.z });
  s.interact(p.id);
  assert.equal(s.power, false);
  Object.assign(p, { f: outside.f, x: outside.x, z: outside.z });
  s.interact(p.id);
  assert.equal(s.power, true);
  assert.equal(s.lightStates[light.room], false);
  s.phase = 'ended';
  s.start(true);
  assert.equal(s.power, true);
  assert.ok(Object.values(s.lightStates).every(Boolean));
});
test('power outage reduces guest detection while a flashlight can still reveal the player', () => {
  const s = solo(),
    p = s.players[0],
    g = s.guards[0];
  Object.assign(g, { x: -34, z: 1, angle: Math.PI / 2 });
  Object.assign(p, { x: -28, z: 1, torch: false });
  assert.equal(s.canSee(g, p), true);
  s.power = false;
  assert.equal(s.canSee(g, p), false);
  p.torch = true;
  assert.equal(s.canSee(g, p), true);
});
test('guests use doors for navigation and do not unlock windows merely by walking nearby', () => {
  const s = solo(),
    g = s.guards[0];
  Object.assign(g, { f: 1, x: -16.9, z: 7, path: [], pathAt: 0 });
  s.navigate(g, { f: 1, x: -15, z: 7 }, 0.05, 1.25);
  assert.equal(s.doorStates['window-office'], false);
});
test('a window can be unlocked from an oblique approach without reaching through other walls', () => {
  const s = solo(),
    p = s.players[0];
  Object.assign(p, { x: -25.5925, z: 6.685 });
  assert.equal(s.nearby(p)?.obj.id, 'window-office');
  s.interact(p.id);
  s.setInput(p.id, { use: true });
  advance(s, 2.1);
  assert.equal(s.doorStates['window-office'], true);
  s.action(p.id, 'climb');
  advance(s, 1);
  assert.equal(regionAt(1, p.x, p.z), 'r1-3');
});
test('an outage also reduces the distance at which an unarmed guest can discover blood', () => {
  const s = solo(),
    g = s.guards[0],
    blood = { f: 1, x: -28, z: 8 };
  Object.assign(g, { f: 1, x: -32, z: 8, angle: Math.PI / 2 });
  assert.equal(s.seesEvidence(g, blood), true);
  s.power = false;
  assert.equal(s.seesEvidence(g, blood), false);
  g.x = -29.5;
  assert.equal(s.seesEvidence(g, blood), true);
});
