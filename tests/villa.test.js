import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FLOOR_IDS,
  FLOORS,
  HOUSE,
  POOL,
  ATRIUM,
  SPAWN,
  PARTY_SPOTS,
  rooms,
  walls,
  doors,
  props,
  stairs,
  devices,
  houseContains,
  houseFloorParts,
  hallFloorParts,
  regionAt,
  inside,
  blocked,
  pathfind,
  windowNormal,
  windowLanding,
} from '../shared/map.js';
import { Simulation } from '../shared/simulation.js';

test('the villa has exactly two playable floors, a bigger footprint and no basement geometry or destination', () => {
  assert.deepEqual(FLOOR_IDS, [1, 2]);
  assert.deepEqual(Object.keys(FLOORS), ['1', '2']);
  assert.ok(HOUSE.maxX - HOUSE.minX > 36);
  assert.ok(HOUSE.maxZ - HOUSE.minZ > 24);
  for (const objects of [rooms, walls, doors, props, stairs, devices])
    assert.ok(objects.every((o) => FLOOR_IDS.includes(o.f)));
  assert.ok(stairs.every((s) => FLOOR_IDS.includes(s.to)));
  assert.equal(blocked(0, 0, 0), true);
  assert.equal(regionAt(0, 0, 0), 'void');
});

test('room patches and hall patches cover the exact walkable footprint once, including irregular shapes and the atrium', () => {
  for (const f of FLOOR_IDS) {
    const rp = rooms.filter((r) => r.f === f).flatMap((r) => r.parts),
      hp = hallFloorParts(f),
      base = houseFloorParts(f);
    assert.equal(
      [...rp, ...hp].reduce((a, p) => a + p.w * p.d, 0),
      base.reduce((a, p) => a + p.w * p.d, 0),
    );
    for (let x = HOUSE.minX + 0.5; x < HOUSE.maxX; x++)
      for (let z = HOUSE.minZ + 0.5; z < HOUSE.maxZ; z++) {
        const count = [...rp, ...hp].filter((p) => inside(x, z, p)).length;
        assert.equal(
          count,
          houseContains(f, x, z) && regionAt(f, x, z) !== 'void' ? 1 : 0,
          `${f}:${x},${z}`,
        );
      }
  }
});

test('the pool and upper atrium are real obstacles, with a navigable route around the pool', () => {
  assert.equal(blocked(POOL.f, POOL.x, POOL.z), true);
  assert.equal(blocked(ATRIUM.f, ATRIUM.x, ATRIUM.z), true);
  const path = pathfind(1, { x: -8, z: -33 }, { x: 16, z: -33 });
  assert.ok(path.length > 0);
  for (const p of path) assert.equal(blocked(1, p.x, p.z, {}, 0.3, true), false);
  assert.ok(path.some((p) => Math.abs(p.z - POOL.z) > POOL.d / 2));
});

test('both independent staircases and every room are reachable on their floor and have valid paired landings', () => {
  assert.equal(stairs.length, 4);
  assert.equal(stairs.filter((s) => s.f === 1).length, 2);
  for (const s of stairs) {
    const reverse = stairs.find(
      (other) =>
        other.f === s.to && other.to === s.f && other.x === s.landing.x && other.z === s.landing.z,
    );
    assert.ok(reverse, s.id);
    assert.deepEqual(reverse.landing, { x: s.x, z: s.z });
    assert.equal(blocked(s.f, s.x, s.z, {}, 0.35, true), false);
    assert.equal(blocked(s.to, s.landing.x, s.landing.z, {}, 0.35, true), false);
    for (const r of rooms.filter((r) => r.f === s.f))
      assert.ok(pathfind(r.f, s, r.nav).length, `${s.id} -> ${r.id}`);
  }
});

test('new doors have matching wall openings, and every usable window has clear landings', () => {
  for (const d of doors) {
    if (d.window) {
      const n = windowNormal(d);
      const p = { f: d.f, x: d.x + n.x, z: d.z + n.z };
      assert.ok(windowLanding(p, d));
      continue;
    }
    assert.equal(blocked(d.f, d.x, d.z, { [d.id]: true }, 0.32), false, d.id);
    assert.equal(blocked(d.f, d.x, d.z, {}, 0.32), true, d.id);
  }
  assert.equal(doors.filter((d) => d.patio).length, 2);
});

test('the party starts in three areas, with eight clear positions, refill points and a reachable outside breaker', () => {
  const s = new Simulation();
  s.addPlayer('p');
  s.start(true);
  const counts = Object.groupBy(s.guards, (g) => regionAt(g.f, g.x, g.z));
  assert.equal(counts['r1-0'].length, 3);
  assert.equal(counts['r1-1'].length, 2);
  assert.equal(counts.outside.length, 3);
  for (const p of PARTY_SPOTS) assert.equal(blocked(p.f, p.x, p.z), false);
  assert.equal(regionAt(SPAWN.f, SPAWN.x, SPAWN.z), 'outside');
  const breaker = devices.find((d) => d.type === 'breaker');
  assert.ok(pathfind(1, SPAWN, breaker).length);
  assert.ok(devices.some((d) => d.type === 'bottles' && d.room === 'outside'));
  assert.ok(devices.some((d) => d.type === 'bottles' && d.room === 'r1-2'));
});

test('an autonomous round on the villa reaches a valid ending without entering the pool, atrium or a removed floor', () => {
  const s = new Simulation({ observer: true });
  s.addPlayer('p');
  s.start(true);
  let previous = { ...s.players[0] };
  for (let i = 0; i < 5401 && s.phase !== 'ended'; i++) {
    s.tick(0.1);
    const p = s.players[0];
    assert.ok(FLOOR_IDS.includes(p.f));
    assert.equal(blocked(p.f, p.x, p.z, s.doorStates, 0.3), false);
    if (p.f === previous.f)
      assert.ok(
        Math.hypot(p.x - previous.x, p.z - previous.z) < 0.4,
        'killer must move physically',
      );
    previous = { ...p };
  }
  assert.equal(s.phase, 'ended');
  assert.ok(['elimination', 'solo', 'defeat'].includes(s.result));
});
