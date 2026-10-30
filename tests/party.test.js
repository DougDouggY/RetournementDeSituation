import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../shared/simulation.js';
import {
  rooms,
  walls,
  props,
  hides,
  doors,
  regionAt,
  roomFloorParts,
  blocked,
  lineClear,
  distance,
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

test('undisturbed guests spend the opening at the party, with only one ordinary errand at a time', () => {
  const s = solo();
  assert.ok(s.guards.every((g) => g.state === 'party'));
  assert.deepEqual([...new Set(s.guards.map((g) => regionAt(g.f, g.x, g.z)))].sort(), [
    'outside',
    'r1-0',
  ]);
  advance(s, 20);
  assert.ok(s.guards.every((g) => g.state === 'party' && !g.armed));
  advance(s, 15);
  assert.equal(s.guards.filter((g) => g.errand).length, 1);
  assert.equal(s.guards.filter((g) => g.state === 'party').length, 7);
  assert.equal(s.phase, 'infiltration');
  assert.equal(s.tension, 0);
});

test('quiet and loud noises send limited groups; repeated incidents gradually add patrols without arming everyone', () => {
  for (const [radius, expected] of [
    [10, 1],
    [18, 2],
  ]) {
    const s = solo();
    s.guards.forEach((g, i) => Object.assign(g, { x: -34 + i * 1.2, z: 8, f: 1 }));
    s.noise(1, -30, 8, radius, 'Test', 'p');
    assert.equal(s.guards.filter((g) => g.state === 'suspicion').length, expected);
    assert.equal(s.phase, 'infiltration');
    assert.ok(s.guards.every((g) => !g.armed));
    s.time += 8;
    s.noise(1, -30, 8, radius, 'Second incident', 'p');
    assert.equal(s.tension, 2);
    for (const g of s.guards) {
      g.last = null;
      g.goal = null;
      s.updateGuest(g, 0.05);
    }
    assert.equal(s.guards.filter((g) => g.state === 'patrol').length, 1);
  }
});

test('an isolated attack makes an audible noise and summons nearby listeners before they see any evidence', () => {
  const s = solo(),
    p = s.players[0],
    [victim, listener] = s.guards;
  s.guards = [victim, listener];
  Object.assign(p, { x: -34, z: 8 });
  Object.assign(victim, { x: -33, z: 8 });
  Object.assign(listener, { x: -25.5, z: 8, angle: Math.PI / 2 });
  s.stab(p);
  assert.equal(victim.alive, false);
  assert.equal(listener.state, 'suspicion');
  assert.equal(listener.last.x, victim.x);
  assert.equal(s.phase, 'infiltration');
  assert.ok(s.noises.some((n) => n.radius === 18 && n.source === p.id));
});

test('cleaning requires three continuous seconds and removes nearby drag marks but leaves distant blood and the corpse', () => {
  const s = solo(),
    p = s.players[0];
  Object.assign(p, { x: -34, z: 8 });
  for (const x of [-34, -33.5, -30]) s.addBlood({ f: 1, x, z: 8 });
  s.bodies = [{ id: 'corpse', f: 1, x: -34, z: 8 }];
  s.guards.forEach((g) => (g.f = 2));
  s.setInput(p.id, { clean: true });
  advance(s, 1.5);
  assert.ok(p.cleanProgress > 1 && s.blood.length === 3);
  s.setInput(p.id, {});
  advance(s, 0.1);
  assert.equal(p.cleanProgress, 0);
  s.setInput(p.id, { clean: true });
  advance(s, 2.8);
  assert.equal(s.blood.length, 3);
  advance(s, 0.3);
  assert.equal(s.blood.length, 1);
  assert.equal(s.blood[0].x, -30);
  assert.equal(s.bodies.length, 1);
  assert.equal(s.phase, 'infiltration');
  s.setInput(p.id, { x: 1, clean: true });
  advance(s, 0.1);
  assert.equal(p.cleanProgress, 0);
});

test('cleaning cannot reach through closed windows, across floors or while dragging', () => {
  const s = solo(),
    p = s.players[0];
  Object.assign(p, { x: -25.6, z: 6 });
  s.addBlood({ f: 1, x: -24.2, z: 6 });
  s.addBlood({ f: 2, x: p.x, z: p.z });
  s.setInput(p.id, { clean: true });
  advance(s, 3.2);
  assert.equal(s.blood.length, 2);
  s.addBlood(p);
  p.dragging = 'occupied';
  advance(s, 3.2);
  assert.equal(s.blood.length, 3);
  assert.equal(p.cleanProgress, 0);
});

test('a corpse can be stashed, blocks the occupied hide, leaves blood, and can be retrieved with R', () => {
  const s = solo(),
    p = s.players[0];
  const h = hides.find((h) => h.f === 1 && regionAt(h.f, h.x, h.z) === 'r1-3');
  Object.assign(p, { f: h.f, x: h.x, z: h.z });
  assert.equal(s.nearby(p).obj.id, h.id);
  const body = { id: 'corpse', f: p.f, x: p.x, z: p.z, draggedBy: p.id };
  s.bodies.push(body);
  s.addBlood(p);
  p.dragging = body.id;
  s.interact(p.id);
  assert.equal(body.hidden, h.id);
  assert.equal(p.dragging, null);
  assert.equal(s.blood.length, 1);
  assert.equal(s.seesEvidence(s.guards[0], body), false);
  s.interact(p.id);
  assert.equal(p.hidden, null);
  s.toggleDrag(p);
  assert.equal(body.hidden, null);
  assert.equal(p.dragging, body.id);
});

test('a masked player gets one short challenge, then fleeing or staying too long triggers general alarm', () => {
  for (const fleeing of [true, false]) {
    const s = solo(),
      p = s.players[0],
      g = s.guards[0];
    Object.assign(g, { x: -34, z: 8, angle: Math.PI / 2 });
    Object.assign(p, { x: -31, z: 8 });
    s.updateGuest(g, 0.05);
    assert.equal(g.state, 'confrontation');
    assert.equal(s.phase, 'infiltration');
    if (fleeing) p.running = true;
    else s.time += 2.6;
    s.updateGuest(g, 0.05);
    assert.equal(s.phase, 'playing');
    assert.ok(s.guards.every((a) => a.armed));
    assert.ok(s.events.some((e) => e.type === 'hunt' && e.text.includes('MASQUÉ')));
    assert.ok(g.say.includes('intrus'), 'panic must interrupt the initial challenge');
  }
});

test('losing sight of the challenged masked intruder also raises the alarm', () => {
  const s = solo(),
    p = s.players[0],
    g = s.guards[0];
  Object.assign(g, { x: -34, z: 8, angle: Math.PI / 2 });
  Object.assign(p, { x: -31, z: 8 });
  s.updateGuest(g, 0.05);
  Object.assign(p, { x: -34, z: 3 });
  s.updateGuest(g, 0.05);
  assert.equal(s.phase, 'playing');
});

test('irregular room footprints, furniture and wall placement stay consistent', () => {
  const irregular = rooms.filter((r) => r.parts.length > 1);
  assert.ok(irregular.length >= 3);
  for (const r of irregular) {
    const area = roomFloorParts(r).reduce((a, p) => a + p.w * p.d, 0);
    assert.equal(area, r.area);
    assert.ok(area < r.w * r.d);
  }
  for (const p of props.filter((p) => p.solid && p.room !== 'outside'))
    for (const sx of [-0.499, 0.499])
      for (const sz of [-0.499, 0.499])
        assert.equal(
          regionAt(p.f, p.x + p.w * sx, p.z + p.d * sz),
          p.room,
          `${p.id} crosses a room boundary`,
        );
  for (const p of props.filter(
    (p) =>
      p.room !== 'outside' &&
      ['wardrobe', 'shelf', 'fridge', 'counter', 'tv', 'sink', 'washer', 'bath', 'bed'].includes(
        p.type,
      ),
  )) {
    const gaps = walls
      .filter((w) => w.f === p.f)
      .flatMap((w) => [
        Math.abs(p.x - w.x) < (p.w + w.w) / 2 ? Math.abs(p.z - w.z) - p.d / 2 - w.d / 2 : Infinity,
        Math.abs(p.z - w.z) < (p.d + w.d) / 2 ? Math.abs(p.x - w.x) - p.w / 2 - w.w / 2 : Infinity,
      ])
      .filter((g) => g >= -0.01);
    assert.ok(Math.min(...gaps) < 0.4, `${p.id} ${p.type} is detached from its wall`);
  }
});
test('rematching resets tension, routines, cleaning and concealed bodies', () => {
  const s = solo(),
    p = s.players[0];
  s.tension = 6;
  s.routineIndex = 3;
  p.cleaning = 'old';
  p.cleanProgress = 2;
  s.bodies.push({ id: 'old', hidden: 'hide' });
  s.phase = 'ended';
  s.start(true);
  assert.equal(s.tension, 0);
  assert.equal(s.routineIndex, 0);
  assert.equal(p.cleaning, null);
  assert.equal(p.cleanProgress, 0);
  assert.equal(s.bodies.length, 0);
});
