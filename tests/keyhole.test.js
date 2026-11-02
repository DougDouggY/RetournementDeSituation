import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../shared/simulation.js';
import {
  doors,
  peekView,
  regionAt,
  illuminationAt,
  canObserve,
  terraceHedge,
  inBush,
  blocked,
  hides,
  props,
} from '../shared/map.js';

function game() {
  const s = new Simulation();
  s.addPlayer('p');
  s.start(true);
  s.guards = [];
  return s;
}

test('each closed solid door places the keyhole on its real handle side, in both directions', () => {
  for (const d of doors.filter((d) => !d.window && !d.patio))
    for (const side of [-1, 1]) {
      const p = {
        f: d.f,
        x: d.x + (d.axis === 'z' ? side * 0.9 : 0),
        z: d.z + (d.axis === 'x' ? side * 0.9 : 0),
        peeking: d.id,
      };
      const eye = peekView(p, { [d.id]: false });
      if (d.axis === 'z') {
        assert.equal(eye.z, d.z - d.d * 0.35);
        assert.equal(Math.sign(eye.x - d.x), -side);
      } else {
        assert.equal(eye.x, d.x + d.w * 0.35);
        assert.equal(Math.sign(eye.z - d.z), -side);
      }
    }
});

test('keyhole observes the actual office and its light state, without moving the body or opening the door', () => {
  const s = game(),
    p = s.players[0];
  Object.assign(p, { f: 1, x: -8.9, z: 8 });
  s.setInput('p', { use: true, crouch: true });
  s.action('p', 'beginUse');
  s.time += 0.5;
  s.updatePeek(p, false);
  assert.equal(p.peeking, 'd1-3');
  assert.equal(s.doorStates['d1-3'], false);
  const eye = peekView(p, s.doorStates);
  assert.equal(regionAt(1, eye.x, eye.z), 'r1-3');
  for (const point of [
    { f: 1, x: -13.5, z: 7.3 },
    { f: 1, x: -14, z: 8 },
  ])
    assert.equal(canObserve(p, point, s.doorStates), true);
  assert.equal(illuminationAt(eye, s.lightStates, s.power), 1);
  s.lightStates['r1-3'] = false;
  assert.equal(illuminationAt(eye, s.lightStates, s.power), 0);
  assert.deepEqual({ x: p.x, z: p.z }, { x: -8.9, z: 8 });
  s.setInput('p', { use: true, crouch: false });
  s.updatePeek(p, false);
  assert.equal(p.peeking, null);
  assert.equal(s.doorStates['d1-3'], false);
});

test('wardrobe entry and exit publish reversible timed movement for the camera and cabinet leaves', () => {
  const s = game(),
    p = s.players[0],
    h = hides.find((h) => h.kind === 'wardrobe' && h.f === 1),
    cabinet = props.find((p) => p.id === h.prop);
  Object.assign(p, { f: 1, x: h.x, z: h.z });
  s.interact('p');
  assert.deepEqual({ x: p.hideMotion.fromX, z: p.hideMotion.fromZ }, { x: h.x, z: h.z });
  assert.deepEqual({ x: p.hideMotion.x, z: p.hideMotion.z }, { x: cabinet.x, z: cabinet.z });
  assert.equal(p.hideMotion.entering, true);
  assert.ok(p.hideMotion.duration >= 1);
  s.time += 1.2;
  s.interact('p');
  assert.equal(p.hideMotion.entering, false);
  assert.equal(p.hideMotion.hide, h.id);
  assert.deepEqual(
    { x: p.hideMotion.fromX, z: p.hideMotion.fromZ },
    { x: cabinet.x, z: cabinet.z },
  );
  assert.deepEqual({ x: p.hideMotion.x, z: p.hideMotion.z }, { x: h.x, z: h.z });
  s.setInput('p', { x: -1, z: 0 });
  s.tick(0.2);
  assert.equal(p.x, h.x, 'movement must not interrupt the exit animation');
  s.time += 1.2;
  s.tick(0.05);
  assert.ok(p.x < h.x, 'movement resumes when the transition finishes');
  s.phase = 'ended';
  s.start(true);
  assert.equal(p.hideMotion, null);
});

test('the low terrace hedge has continuous sides and four genuine entrances', () => {
  const covered = (x, z) =>
    terraceHedge.some((b) => Math.abs(x - b.x) <= b.w / 2 && Math.abs(z - b.z) <= b.d / 2);
  for (const [a, b] of [
    [-24, -7],
    [-4.5, 0.5],
    [3, 22],
  ])
    for (let x = a + 0.1; x < b; x += 0.4) assert.equal(covered(x, -28), true);
  for (const p of [
    { x: -5.75, z: -28 },
    { x: 1.75, z: -28 },
    { x: -24, z: -20 },
    { x: 22, z: -19.5 },
  ]) {
    assert.equal(covered(p.x, p.z), false);
    assert.equal(inBush({ f: 1, ...p }), false);
    assert.equal(blocked(1, p.x, p.z), false);
  }
  for (const b of terraceHedge) {
    assert.equal(b.solid, false);
    assert.equal(inBush({ f: 1, x: b.x, z: b.z }), true);
  }
});
