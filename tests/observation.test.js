import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../shared/simulation.js';
import { bottleTrajectory, devices, blocked, distance } from '../shared/map.js';
function solo(observer = false) {
  const s = new Simulation({ observer });
  s.addPlayer('p');
  s.start(true);
  return s;
}
function advance(s, t) {
  for (let i = 0; i < Math.ceil(t / 0.05); i++) s.tick(0.05);
}

test('charged throws share their prediction, cap at twelve metres and make noise only at impact', () => {
  const s = solo(),
    p = s.players[0];
  Object.assign(p, { x: -24, z: -17, angle: Math.PI / 2 });
  s.guards = [];
  s.setInput(p.id, { angle: Math.PI / 2 });
  s.action(p.id, 'charge');
  advance(s, 0.1);
  s.action(p.id, 'throw');
  const short = s.thrown[0];
  assert.ok(short.range < 4);
  assert.equal(p.bottles, 2);
  assert.equal(s.noises.length, 0);
  advance(s, short.duration + 0.1);
  assert.equal(s.noises.length, 1);
  assert.equal(s.noises[0].x, short.x);
  s.action(p.id, 'charge');
  advance(s, 3);
  assert.equal(p.throwCharge, 1);
  const expected = bottleTrajectory(p, s.doorStates, 1);
  s.action(p.id, 'throw');
  const long = s.thrown.at(-1);
  assert.ok(long.range > short.range + 7);
  assert.ok(long.range <= 12.01);
  assert.equal(long.x, expected.x);
  assert.equal(long.z, expected.z);
  assert.equal(p.charging, false);
  assert.equal(p.bottles, 1);
});

test('a predicted throw stops at walls and cancellation keeps the bottle', () => {
  const s = solo(),
    p = s.players[0];
  Object.assign(p, { x: -19, z: 0, angle: Math.PI / 2 });
  const path = bottleTrajectory(p, s.doorStates, 1);
  assert.ok(path.x < -18.1);
  assert.equal(blocked(p.f, path.x, path.z, s.doorStates, 0.04), false);
  s.action(p.id, 'charge');
  advance(s, 0.5);
  s.action(p.id, 'cancelThrow');
  assert.equal(p.charging, false);
  assert.equal(p.bottles, 3);
  assert.equal(s.thrown.length, 0);
});

test('hearing behind a guest causes a gradual turn, with no visual detection until the player is actually in front', () => {
  const s = solo(),
    p = s.players[0],
    g = s.guards[0];
  s.guards = [g];
  Object.assign(g, { x: -10, z: 0, angle: 0, path: [] });
  Object.assign(p, { x: -10, z: -1, torch: true });
  assert.equal(s.canSee(g, p), false);
  s.noise(1, p.x, p.z, 10, 'Des pas', p.id);
  s.updateGuest(g, 0.05);
  assert.ok(Math.abs(g.angle) <= 0.111);
  assert.equal(s.canSee(g, p), false);
  assert.equal(s.phase, 'infiltration');
  for (let i = 0; i < 10; i++) s.updateGuest(g, 0.05);
  assert.equal(s.canSee(g, p), false);
  g.angle = Math.PI;
  assert.equal(s.canSee(g, p), true);
});

test('blood immediately behind a guest cannot be seen even within arm reach', () => {
  const s = solo(),
    g = s.guards[0];
  Object.assign(g, { x: -10, z: 0, angle: 0 });
  assert.equal(s.seesEvidence(g, { f: 1, x: -10, z: -0.6 }), false);
  assert.equal(s.seesEvidence(g, { f: 1, x: -10, z: 0.6 }), true);
});

test('a single guest physically reaches the breaker and restores power after a three-second repair', () => {
  const s = solo(),
    p = s.players[0],
    d = devices.find((d) => d.type === 'breaker' && d.room === 'outside');
  Object.assign(p, { x: d.x, z: d.z });
  s.interact(p.id);
  Object.assign(p, { x: -26, z: -20 });
  advance(s, 0.1);
  assert.equal(s.power, false);
  assert.equal(s.guards.filter((g) => g.repair).length, 1);
  const worker = s.guards.find((g) => g.repair);
  const before = { ...worker };
  advance(s, 1);
  assert.equal(s.power, false);
  assert.ok(distance(before, worker) < 2);
  for (let i = 0; i < 2400 && !s.power; i++) s.tick(0.05);
  assert.equal(s.power, true);
  assert.equal(s.phase, 'infiltration');
  assert.ok(worker.f === d.f && distance(worker, d) < 2);
  assert.ok(s.guards.every((g) => !g.repair));
});

test('an unfounded investigation decays back to the party rather than leaving permanent patrols', () => {
  const s = solo();
  s.nextRoutine = 10000;
  s.socialAt = 10000;
  const g = s.guards[0];
  s.noise(1, g.x, g.z, 18, 'Un bruit isolé', 'p');
  assert.ok(s.tension > 0);
  advance(s, 60);
  assert.equal(s.tension, 0);
  assert.equal(s.phase, 'infiltration');
  assert.ok(s.guards.every((g) => g.state === 'party' && !g.armed));
});

test('a missing friend prompts a local enquiry at a remembered place, without granting knowledge of a hidden corpse', () => {
  const s = solo(),
    missing = s.guards[0];
  missing.alive = false;
  s.bodies = [{ id: 'hidden', guard: missing.id, hidden: 'h', f: 0, x: 5, z: 5 }];
  s.time = 75;
  const memory = s.socialMemory.find((m) => m.id === missing.id);
  memory.lastSeen = 0;
  s.updateSocialMemory();
  const investigator = s.guards.find((g) => g.last);
  assert.ok(investigator);
  assert.deepEqual(investigator.last, memory.point);
  assert.notEqual(investigator.last.f, 0);
  assert.equal(s.phase, 'infiltration');
  assert.ok(s.guards.every((g) => !g.armed));
});

test('an open window alone does not trigger panic or suspicion', () => {
  const s = solo();
  s.doorStates['window-salon'] = true;
  advance(s, 15);
  assert.equal(s.phase, 'infiltration');
  assert.equal(s.tension, 0);
  assert.ok(s.guards.every((g) => g.state === 'party'));
});

test('the spectator killer is autonomous, uses physical movement and can eliminate a guest without user input', () => {
  const s = solo(true),
    p = s.players[0];
  let previous = { ...p };
  let moved = false;
  for (let i = 0; i < 1800 && s.phase !== 'ended' && !s.bodies.length; i++) {
    s.tick(0.05);
    assert.equal(blocked(p.f, p.x, p.z, s.doorStates, 0.3), false);
    if (previous.f === p.f) assert.ok(distance(previous, p) < 0.2);
    if (distance(previous, p) > 0.01) moved = true;
    previous = { ...p };
  }
  assert.equal(s.snapshot().observer, true);
  assert.ok(moved);
  assert.ok(p.botSabotaged);
  assert.ok(s.bodies.length > 0);
});

test('an available survivor can repair the power during the hunt too', () => {
  const s = solo(),
    p = s.players[0],
    d = devices.find((d) => d.type === 'breaker' && d.room === 'outside');
  Object.assign(p, { x: d.x, z: d.z });
  s.interact(p.id);
  Object.assign(p, { x: -26, z: -20 });
  s.phase = 'playing';
  s.assignRepair();
  assert.equal(s.guards.filter((g) => g.repair).length, 1);
  for (let i = 0; i < 2400 && !s.power; i++) s.tick(0.05);
  assert.equal(s.power, true);
});
