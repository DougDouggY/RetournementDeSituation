import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../shared/simulation.js';
import {
  regionAt,
  visibleRegions,
  canObserve,
  lineClear,
  blocked,
  doors,
  distance,
} from '../shared/map.js';
const advance = (s, t) => {
  for (let i = 0; i < Math.ceil(t / 0.05); i++) s.tick(0.05);
};
function solo() {
  const s = new Simulation();
  s.addPlayer('solo');
  s.start(true);
  return s;
}
function killSetup() {
  const s = solo(),
    p = s.players[0],
    [g, other] = s.guards;
  s.guards = [g, other];
  Object.assign(p, { x: -12, z: 0, f: 1 });
  Object.assign(g, { x: -10.9, z: 0, f: 1, angle: 0, path: [], goal: null });
  Object.assign(other, { x: 12, z: 0, f: 0, path: [], goal: null });
  return { s, p, g, other };
}
test('solo and coop begin outside, with living unarmed guests, no body and no forced alarm', () => {
  for (const n of [1, 2]) {
    const s = new Simulation();
    for (let i = 0; i < n; i++) s.addPlayer(`p${i}`, i);
    s.start(n === 1);
    assert.equal(s.phase, 'infiltration');
    for (const p of s.players) {
      assert.equal(regionAt(p.f, p.x, p.z), 'outside');
      assert.equal(blocked(p.f, p.x, p.z, s.doorStates), false);
    }
    assert.equal(s.bodies.length, 0);
    assert.equal(s.guards.length, 8);
    assert.ok(s.guards.every((g) => g.alive && !g.armed));
    advance(s, 12);
    assert.equal(s.phase, 'infiltration');
    assert.equal(s.alarmAt, null);
  }
});
test('real external wall blocks passage until door is opened, then movement crosses into hall', () => {
  const s = solo(),
    p = s.players[0];
  Object.assign(p, { x: -19, z: 0 });
  s.move(p, 2, 0);
  assert.ok(p.x < -18.4);
  s.interact(p.id);
  assert.equal(s.doorStates['entry-west'], true);
  s.move(p, 2, 0);
  assert.equal(regionAt(p.f, p.x, p.z), 'hall1');
  Object.assign(p, { x: -19, z: 5 });
  s.move(p, 4, 0);
  assert.ok(p.x < -18.4, 'solid wall remains solid');
});
test('windows require two seconds of continuous use; cancelling does not open them', () => {
  const s = solo(),
    p = s.players[0];
  Object.assign(p, { x: -12, z: -13 });
  s.interact(p.id);
  s.setInput(p.id, { use: true });
  advance(s, 0.8);
  assert.equal(s.doorStates['window-salon'], false);
  s.setInput(p.id, {});
  advance(s, 0.3);
  assert.equal(p.openProgress, 0);
  s.interact(p.id);
  s.setInput(p.id, { use: true });
  advance(s, 2.1);
  assert.equal(s.doorStates['window-salon'], true);
  s.move(p, 0, 2);
  assert.equal(regionAt(p.f, p.x, p.z), 'r1-0');
});
test('visibility is current-room only, open nearby doors reveal adjacent rooms, closing removes visibility', () => {
  const p = { f: 1, x: -12, z: -3 },
    state = {};
  let visible = visibleRegions(p, state);
  assert.deepEqual([...visible], ['r1-0']);
  assert.equal(canObserve(p, { f: 1, x: -12, z: 0 }, state), false);
  state['d1-0'] = true;
  visible = visibleRegions(p, state);
  assert.ok(visible.has('hall1'));
  assert.equal(visible.has('r1-1'), false);
  assert.equal(canObserve(p, { f: 1, x: -12, z: 0 }, state), true);
  state['d1-0'] = false;
  assert.equal(visibleRegions(p, state).has('hall1'), false);
  const outside = { f: 1, x: -19, z: 0 };
  assert.deepEqual([...visibleRegions(outside, state)], ['outside']);
  state['entry-west'] = true;
  assert.ok(visibleRegions(outside, state).has('hall1'));
});
test('guests do not see behind themselves even at close distance, or through closed doors', () => {
  const s = solo(),
    p = s.players[0],
    g = s.guards[0];
  Object.assign(g, { f: 1, x: 0, z: 0, angle: 0 });
  Object.assign(p, { f: 1, x: 0, z: -1 });
  assert.equal(s.canSee(g, p), false);
  p.z = 1;
  assert.equal(s.canSee(g, p), true);
  Object.assign(g, { x: -12, z: 0, angle: Math.PI });
  Object.assign(p, { x: -12, z: -3 });
  assert.equal(s.canSee(g, p), false);
  s.doorStates['d1-0'] = true;
  assert.equal(s.canSee(g, p), true);
});
test('isolated elimination leaves a body and permanent blood without starting the hunt automatically', () => {
  const { s, p, g } = killSetup();
  s.action(p.id, 'attack');
  assert.equal(g.alive, false);
  assert.equal(s.bodies.length, 1);
  assert.equal(s.blood.length, 1);
  assert.equal(s.phase, 'infiltration');
  assert.equal(s.bodies[0].guard, g.id);
  s.tick(0.05);
  assert.equal(s.phase, 'infiltration');
  assert.equal(s.guards.filter((g) => g.alive).length, 1);
});
test('nearby witnesses prevent an isolated elimination, but a wall screens a witness', () => {
  const { s, p, g, other } = killSetup();
  Object.assign(other, { f: 1, x: -8, z: 0 });
  s.action(p.id, 'attack');
  assert.equal(g.alive, true);
  assert.equal(s.bodies.length, 0);
  assert.ok(s.events.some((e) => e.type === 'warning'));
  Object.assign(p, { x: -8, z: -4 });
  Object.assign(g, { x: -7, z: -4 });
  Object.assign(other, { x: -5, z: -4 });
  assert.equal(lineClear(1, g, other, s.doorStates), false);
  s.action(p.id, 'attack');
  assert.equal(g.alive, false);
});
test('dragging actually moves the corpse, slows running, leaves a permanent trail, and R drops it', () => {
  const { s, p, g } = killSetup();
  s.action(p.id, 'attack');
  const pool = { ...s.blood[0] },
    body = s.bodies[0],
    before = { ...body };
  s.action(p.id, 'drag');
  assert.equal(p.dragging, body.id);
  s.setInput(p.id, { x: -1, z: 0, run: true });
  advance(s, 2);
  assert.ok(distance(body, before) > 1);
  assert.ok(s.blood.length > 3);
  assert.deepEqual(s.blood[0], pool);
  assert.equal(p.running, false);
  assert.ok(p.x >= -14.6);
  s.action(p.id, 'drag');
  assert.equal(p.dragging, null);
  assert.equal(body.draggedBy, null);
  const dropped = { ...body };
  s.setInput(p.id, { x: 1, z: 0 });
  advance(s, 1);
  assert.equal(body.x, dropped.x);
  assert.equal(body.z, dropped.z);
  assert.ok(s.blood.some((b) => b.x === pool.x && b.z === pool.z));
});
test('seeing blood starts an armed search at the evidence, not magically at the player', () => {
  const { s, p, other } = killSetup();
  s.action(p.id, 'attack');
  const body = s.bodies[0];
  body.x = -17;
  Object.assign(other, { f: 1, x: -8, z: 0, angle: -Math.PI / 2 });
  Object.assign(p, { x: 20, z: 0 });
  s.updateGuard(other, 0.05);
  assert.equal(s.phase, 'playing');
  assert.equal(s.alarmAt, s.time);
  assert.equal(other.armed, true);
  assert.equal(other.last.x, -10.9);
  assert.notEqual(other.last.x, p.x);
});
test('evidence behind a wall or behind the guest does not raise alarm', () => {
  const { s, p, other } = killSetup();
  s.action(p.id, 'attack');
  Object.assign(other, { f: 1, x: -8, z: 0, angle: Math.PI / 2 });
  assert.ok(s.bodies.every((b) => !s.seesEvidence(other, b)));
  s.updateGuard(other, 0.05);
  assert.equal(s.phase, 'infiltration');
  Object.assign(other, { x: -5, z: -4, angle: -Math.PI / 2 });
  s.bodies[0].x = -7;
  s.bodies[0].z = -4;
  s.blood = [];
  assert.equal(s.seesEvidence(other, s.bodies[0]), false);
});
test('eliminating the last guest wins; surviving to dawn also wins before or after alarm', () => {
  const { s, p, g } = killSetup();
  s.guards = [g];
  s.action(p.id, 'attack');
  s.tick(0.05);
  assert.equal(s.result, 'elimination');
  for (const phase of ['infiltration', 'playing']) {
    const sim = solo();
    sim.phase = phase;
    sim.remaining = 0.05;
    sim.tick(0.1);
    assert.equal(sim.result, 'solo');
  }
});
test('rematch clears bodies, blood and alarm, restores all guests and both outside spawn points', () => {
  const { s, p } = killSetup();
  s.action(p.id, 'attack');
  s.phase = 'ended';
  s.start(true);
  assert.equal(s.blood.length, 0);
  assert.equal(s.bodies.length, 0);
  assert.equal(s.guards.length, 8);
  assert.equal(s.alarmAt, null);
  assert.equal(regionAt(p.f, p.x, p.z), 'outside');
  assert.equal(p.dragging, null);
});
test('AI speech has global and individual cooldowns instead of repeating each chase transition', () => {
  const s = solo(),
    [a, b] = s.guards;
  s.speak(a, 'Première');
  s.speak(a, 'Encore');
  s.speak(b, 'Encore');
  assert.equal(s.events.filter((e) => e.type === 'voice').length, 1);
  s.time += 6;
  s.speak(a, 'Encore');
  s.speak(b, 'Autre');
  assert.equal(s.events.filter((e) => e.type === 'voice').length, 2);
});
test('default infiltration runs for a complete nine-minute night with physical guests on all floors', () => {
  const s = solo(),
    floors = new Set();
  let prev = s.guards.map((g) => ({ ...g }));
  for (let i = 0; i < 5401 && s.phase !== 'ended'; i++) {
    s.tick(0.1);
    for (let j = 0; j < s.guards.length; j++) {
      const g = s.guards[j];
      floors.add(g.f);
      assert.ok(!blocked(g.f, g.x, g.z, s.doorStates, 0.3), `${g.id} crossed obstacle`);
      if (prev[j].f === g.f) assert.ok(distance(prev[j], g) < 0.3);
    }
    prev = s.guards.map((g) => ({ ...g }));
  }
  assert.equal(s.phase, 'ended');
  assert.equal(s.result, 'solo');
  assert.equal(s.alarmAt, null);
  assert.ok(s.guards.every((g) => g.alive && !g.armed));
  assert.deepEqual([...floors].sort(), [0, 1, 2]);
});
