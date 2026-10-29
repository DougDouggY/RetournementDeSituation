import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../shared/simulation.js';
import {
  rooms,
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
  assert.ok(s.guards.every((g) => regionAt(g.f, g.x, g.z) === 'r1-0' && g.state === 'party'));
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
    s.guards.forEach((g, i) => Object.assign(g, { x: -5 + i * 1.2, z: 0, f: 1 }));
    s.noise(1, 0, 0, radius, 'Test', 'p');
    assert.equal(s.guards.filter((g) => g.state === 'suspicion').length, expected);
    assert.equal(s.phase, 'infiltration');
    assert.ok(s.guards.every((g) => !g.armed));
    s.time += 8;
    s.noise(1, 0, 0, radius, 'Second incident', 'p');
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
  Object.assign(p, { x: -12, z: 0 });
  Object.assign(victim, { x: -11, z: 0 });
  Object.assign(listener, { x: -3, z: 0, angle: Math.PI / 2 });
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
  Object.assign(p, { x: -12, z: 0 });
  for (const x of [-12, -11.5, -8]) s.addBlood({ f: 1, x, z: 0 });
  s.bodies = [{ id: 'corpse', f: 1, x: -12, z: 0 }];
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
  assert.equal(s.blood[0].x, -8);
  assert.equal(s.bodies.length, 1);
  assert.equal(s.phase, 'infiltration');
  s.setInput(p.id, { x: 1, clean: true });
  advance(s, 0.1);
  assert.equal(p.cleanProgress, 0);
});

test('cleaning cannot reach through closed windows, across floors or while dragging', () => {
  const s = solo(),
    p = s.players[0];
  Object.assign(p, { x: -18.6, z: 7 });
  s.addBlood({ f: 1, x: -17.2, z: 7 });
  s.addBlood({ f: 0, x: p.x, z: p.z });
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
    Object.assign(g, { x: -12, z: 0, angle: Math.PI / 2 });
    Object.assign(p, { x: -9, z: 0 });
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
  Object.assign(g, { x: -12, z: 0, angle: Math.PI / 2 });
  Object.assign(p, { x: -9, z: 0 });
  s.updateGuest(g, 0.05);
  Object.assign(p, { x: -12, z: -5 });
  s.updateGuest(g, 0.05);
  assert.equal(s.phase, 'playing');
});

test('L-shaped rooms exclude their recesses from room visibility and keep floor patches, doors and furniture consistent', () => {
  const irregular = rooms.filter((r) => r.cutout);
  assert.ok(irregular.length >= 6);
  for (const r of irregular) {
    const c = r.cutout;
    assert.equal(regionAt(r.f, c.x, c.z), `hall${r.f}`);
    assert.equal(blocked(r.f, c.x, c.z, {}, 0.3, true), false);
    const parts = roomFloorParts(r);
    assert.equal(
      parts.reduce((sum, p) => sum + p.w * p.d, 0),
      r.w * r.d - c.w * c.d,
    );
    for (const p of props.filter((p) => p.room === r.id && p.solid)) {
      assert.equal(regionAt(p.f, p.x, p.z), r.id, `${p.id} outside L-shaped room`);
    }
  }
  for (const p of props.filter((p) =>
    ['wardrobe', 'shelf', 'fridge', 'counter', 'tv', 'sink', 'washer', 'bath', 'bed'].includes(
      p.type,
    ),
  )) {
    const r = rooms.find((r) => r.id === p.room);
    const gap = Math.min(
      r.w / 2 - Math.abs(p.x - r.x) - p.w / 2,
      r.d / 2 - Math.abs(p.z - r.z) - p.d / 2,
    );
    assert.ok(gap < 0.21, `${p.id} is ${gap}m away from a wall`);
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
