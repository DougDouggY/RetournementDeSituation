import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../shared/simulation.js';
import { blocked, pathfind } from '../shared/map.js';
function game() {
  const s = new Simulation();
  s.addPlayer('p');
  s.start(true);
  return s;
}
function advance(s, seconds) {
  for (let i = 0; i < seconds * 20; i++) s.tick(0.05);
}
test('attacks consume energy, cannot chain while exhausted and delay regeneration', () => {
  const s = game(),
    p = s.players[0],
    victim = s.guards[0];
  const other = s.guards[1];
  s.guards = [victim, other];
  Object.assign(other, { f: 2, x: 14, z: -6 });
  Object.assign(p, { f: 1, x: -34, z: 8 });
  Object.assign(victim, { f: 1, x: -33, z: 8 });
  s.stab(p);
  assert.equal(victim.alive, false);
  assert.equal(p.stamina, 60);
  p.stamina = 30;
  p.attackCooldown = 0;
  victim.alive = true;
  s.stab(p);
  assert.equal(victim.alive, true);
  victim.alive = false;
  advance(s, 2);
  assert.equal(p.stamina, 30);
  advance(s, 4);
  assert.ok(p.stamina > 30);
});
test('a closed bathroom can be locked inside, blocks guests and cannot be unlocked from the hall', () => {
  const s = game(),
    p = s.players[0],
    g = s.guards[0];
  Object.assign(p, { f: 1, x: 12, z: 3 });
  s.doorStates['d1-4'] = true;
  s.action('p', 'lock');
  assert.ok(s.doorLocks['d1-4']);
  assert.equal(s.doorStates['d1-4'], false);
  Object.assign(g, { f: 1, x: 10, z: 3 });
  s.navigate(g, { f: 1, x: 14, z: 3 }, 0.05, 2);
  assert.equal(s.doorStates['d1-4'], false);
  Object.assign(p, { x: 10 });
  s.action('p', 'lock');
  assert.ok(s.doorLocks['d1-4']);
  s.action('p', 'interact');
  assert.equal(s.doorStates['d1-4'], false);
  Object.assign(p, { x: 12 });
  s.action('p', 'lock');
  assert.equal(s.doorLocks['d1-4'], undefined);
});
test('remaining barricaded attracts investigation and the lock eventually gives way', () => {
  const s = game(),
    p = s.players[0];
  Object.assign(p, { f: 1, x: 12, z: 3 });
  s.action('p', 'lock');
  advance(s, 26);
  assert.ok(s.doorLocks['d1-4'].questioned);
  assert.ok(s.events.some((e) => e.text.includes('vérifier')));
  // A door does not break on its own: an alerted guest must actually strike it.
  s.phase = 'playing';
  const g = s.guards[0];
  Object.assign(g, { f: 1, x: 9.8, z: 3, path: [], pathAt: -2 });
  for (let i = 0; i < 120; i++) s.navigate(g, { f: 1, x: 13, z: 3 }, 0.05, 2);
  assert.equal(s.doorLocks['d1-4'], undefined);
  assert.equal(s.brokenDoors['d1-4'], true);
});
test('opening the garage window is audible nearby but never across the house or upstairs', () => {
  const s = game(),
    p = s.players[0];
  Object.assign(p, { f: 1, x: 15, z: 17, input: { use: true } });
  s.guards = s.guards.slice(0, 3);
  Object.assign(s.guards[0], { f: 1, x: 15, z: 18 });
  Object.assign(s.guards[1], { f: 1, x: 21, z: -6 });
  Object.assign(s.guards[2], { f: 2, x: 15, z: 14 });
  s.interact('p');
  assert.equal(p.opening, 'window-garage');
  advance(s, 2.1);
  assert.equal(s.doorStates['window-garage'], true);
  assert.ok(s.events.some((e) => e.text.includes('grincement')));
  assert.equal(s.guards[1].state, 'party');
  assert.equal(s.guards[2].state, 'party');
});
test('cached navigation still respects pool, furniture and exterior boundaries on repeated paths', () => {
  for (let n = 0; n < 3; n++) {
    const path = pathfind(1, { x: -8, z: -33 }, { x: 16, z: -33 });
    assert.ok(path.length);
    for (const p of path) assert.equal(blocked(1, p.x, p.z, {}, 0.35, true), false);
  }
});
