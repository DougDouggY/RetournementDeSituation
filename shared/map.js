// The playable villa: ground floor (1), upper floor (2), and a shared garden.
// Floor identifiers stay stable for saved character state; there is no floor 0.
export const FLOOR_IDS = [1, 2];
export const FLOORS = { 1: 'Rez-de-chaussée', 2: 'Étage' };
export const NIGHT = 540;
export const FLOOR_HEIGHT = 3.2;
export const WORLD = { minX: -38, maxX: 38, minZ: -43, maxZ: 28 };
export const HOUSE = { minX: -25, maxX: 25, minZ: -16, maxZ: 16 };
export const POOL = { f: 1, x: 4, z: -33, w: 20, d: 8 };
export const TERRACE = { f: 1, x: -1, z: -22, w: 46, d: 12 };
export const ATRIUM = { f: 2, x: 3, z: -5, w: 8, d: 6 };
export const SPAWN = { f: 1, x: -30, z: -1 };
export const CAPTURE_POINT = { f: 1, x: 22, z: 11 };
export const rooms = [],
  walls = [],
  doors = [],
  props = [],
  hides = [],
  devices = [],
  stairs = [];
const rect = (left, top, right, bottom) => ({
  x: (left + right) / 2,
  z: (top + bottom) / 2,
  w: right - left,
  d: bottom - top,
});
function room(id, name, parts, nav, style) {
  const left = Math.min(...parts.map((p) => p.x - p.w / 2)),
    right = Math.max(...parts.map((p) => p.x + p.w / 2));
  const top = Math.min(...parts.map((p) => p.z - p.d / 2)),
    bottom = Math.max(...parts.map((p) => p.z + p.d / 2));
  rooms.push({
    id,
    f: Number(id[1]),
    name,
    ...rect(left, top, right, bottom),
    parts,
    nav,
    style,
    area: parts.reduce((a, p) => a + p.w * p.d, 0),
  });
}
room(
  'r1-0',
  'Grand salon en L',
  [rect(-25, -16, -4, -2), rect(-10, -2, 3, 4)],
  { x: -12, z: -5 },
  0,
);
room('r1-1', 'Salle à manger', [rect(-4, -16, 11, -4)], { x: 4, z: -6 }, 1);
room('r1-2', 'Cuisine', [rect(11, -16, 25, -4)], { x: 21, z: -6 }, 2);
room('r1-3', 'Bureau / bibliothèque', [rect(-25, 0, -10, 12)], { x: -13, z: 8 }, 1);
room('r1-4', 'WC / vestiaire', [rect(11, 0, 25, 6)], { x: 14, z: 3 }, 3);
room('r1-5', 'Garage / buanderie', [rect(11, 6, 25, 16)], { x: 13, z: 8 }, 2);
room(
  'r2-0',
  'Suite principale',
  [rect(-25, -16, -5, -2), rect(-25, -2, -17, 2)],
  { x: -9, z: -6 },
  4,
);
room('r2-1', 'Salle de bains privée', [rect(-1, -16, 7, -10)], { x: 2, z: -13 }, 3);
room('r2-2', 'Chambre d’amis', [rect(11, -16, 25, -2)], { x: 14, z: -6 }, 5);
room('r2-3', 'Chambre / bureau', [rect(-25, 2, -9, 16)], { x: -12, z: 5 }, 4);
room('r2-4', 'Chambre bleue', [rect(-9, 8, 9, 16), rect(2, 4, 9, 8)], { x: 5, z: 6 }, 2);
room('r2-5', 'Salle de bains / WC', [rect(13, 2, 25, 9)], { x: 16, z: 5 }, 3);
room('r2-6', 'Lingerie', [rect(13, 9, 25, 16)], { x: 16, z: 12 }, 1);
export const PARTY_SPOTS = [
  { f: 1, x: -20, z: -10 },
  { f: 1, x: -17, z: -4 },
  { f: 1, x: -14, z: -13 },
  { f: 1, x: -8, z: -5 },
  { f: 1, x: -10, z: -10 },
  { f: 1, x: -14, z: -22 },
  { f: 1, x: -10, z: -22 },
  { f: 1, x: -6, z: -22 },
];
export const gardenLamps = [
  ...[-35, -31, -27].flatMap((x) => [-3, 1].map((z) => ({ x, z }))),
  ...[-22, -11, 0, 11, 22].flatMap((x) => [-19, 19].map((z) => ({ x, z }))),
  ...[-10, 0, 10].map((z) => ({ x: 28, z })),
  ...[-10, 18].map((x) => ({ x, z: -38 })),
];
function door(id, f, x, z, axis = 'x', width = 2, extra = {}) {
  if (!extra.window && !extra.patio) width = 1;
  doors.push({
    id,
    f,
    x,
    z,
    axis,
    w: axis === 'z' ? 0.24 : width,
    d: axis === 'z' ? width : 0.24,
    ...extra,
  });
}
door('entry-west', 1, -25, -1, 'z', 2, { exterior: true, normal: { x: -1, z: 0 } });
door('entry-main', 1, 0, 16, 'x', 3, { exterior: true, normal: { x: 0, z: 1 } });
door('entry-east', 1, 25, 10, 'z', 2, { exterior: true, normal: { x: 1, z: 0 }, room: 'r1-5' });
door('patio-salon', 1, -17, -16, 'x', 4, {
  exterior: true,
  normal: { x: 0, z: -1 },
  room: 'r1-0',
  patio: true,
});
door('patio-dining', 1, 3, -16, 'x', 4, {
  exterior: true,
  normal: { x: 0, z: -1 },
  room: 'r1-1',
  patio: true,
});
door('entry-kitchen', 1, 25, -11, 'z', 2, { exterior: true, normal: { x: 1, z: 0 }, room: 'r1-2' });
for (const [id, x, z, axis, r] of [
  ['salon', -8, -16, 'x', 'r1-0'],
  ['dining', 8, -16, 'x', 'r1-1'],
  ['kitchen', 25, -7, 'z', 'r1-2'],
  ['office', -25, 6, 'z', 'r1-3'],
  ['bathroom', 25, 3, 'z', 'r1-4'],
  ['garage', 15, 16, 'x', 'r1-5'],
])
  door('window-' + id, 1, x, z, axis, 2, {
    window: true,
    exterior: true,
    room: r,
    normal: axis === 'z' ? { x: Math.sign(x), z: 0 } : { x: 0, z: Math.sign(z) },
  });
for (const [id, x, z, axis, width, r] of [
  ['d1-0', 3, 1, 'z', 2, 'r1-0'],
  ['d1-0-west', -10, -1, 'z', 2, 'r1-0'],
  ['d1-1', 4, -4, 'x', 2, 'r1-1'],
  ['d1-2', 18, -4, 'x', 2, 'r1-2'],
  ['d1-3', -10, 8, 'z', 2, 'r1-3'],
  ['d1-3-west', -18, 0, 'x', 2, 'r1-3'],
  ['d1-4', 11, 3, 'z', 2, 'r1-4'],
  ['d1-5', 11, 10, 'z', 2, 'r1-5'],
  ['salon-dining', -4, -10, 'z', 3, 'r1-0'],
  ['dining-kitchen', 11, -10, 'z', 2, 'r1-1'],
  ['wc-garage', 19, 6, 'x', 2, 'r1-4'],
])
  door(id, 1, x, z, axis, width, { room: r });
for (const [id, x, z, axis, r] of [
  ['d2-0', -5, -7, 'z', 'r2-0'],
  ['suite-connecting', -20, 2, 'x', 'r2-0'],
  ['d2-1', -1, -13, 'z', 'r2-1'],
  ['d2-2', 11, -7, 'z', 'r2-2'],
  ['d2-3', -14, 2, 'x', 'r2-3'],
  ['d2-4', 5, 4, 'x', 'r2-4'],
  ['bedrooms-connecting', -9, 12, 'z', 'r2-4'],
  ['d2-5', 13, 6, 'z', 'r2-5'],
  ['d2-6', 13, 12, 'z', 'r2-6'],
])
  door(id, 2, x, z, axis, 2, { room: r });
stairs.push(
  {
    id: 'main-up',
    f: 1,
    x: -3,
    z: 10,
    to: 2,
    landing: { x: -3, z: 6 },
    name: 'Escalier principal',
    axis: 'z',
  },
  {
    id: 'main-down',
    f: 2,
    x: -3,
    z: 6,
    to: 1,
    landing: { x: -3, z: 10 },
    name: 'Escalier principal',
    axis: 'z',
  },
  {
    id: 'service-up',
    f: 1,
    x: 18,
    z: -2,
    to: 2,
    landing: { x: 18, z: 0 },
    name: 'Escalier de service',
    axis: 'z',
  },
  {
    id: 'service-down',
    f: 2,
    x: 18,
    z: 0,
    to: 1,
    landing: { x: 18, z: -2 },
    name: 'Escalier de service',
    axis: 'z',
  },
);
export const stairVoids = stairs
  .filter((s) => s.to === 2)
  .map((s) => ({
    x: s.x,
    z: (s.z + s.landing.z) / 2,
    w: 2.3,
    d: Math.max(0.8, Math.abs(s.z - s.landing.z) - 1),
  }));
export function houseContains(f, x, z) {
  if (
    !FLOOR_IDS.includes(f) ||
    x < HOUSE.minX ||
    x > HOUSE.maxX ||
    z < HOUSE.minZ ||
    z > HOUSE.maxZ
  )
    return false;
  return f === 2 || !(x < -10 && z > 12);
}
export function houseFloorParts(f) {
  return f === 1
    ? [rect(-25, -16, 25, 12), rect(-10, 12, 25, 16)]
    : [rect(-25, -16, -1, 16), rect(7, -16, 25, 16), rect(-1, -16, 7, -8), rect(-1, -2, 7, 16)];
}
export function roomAt(f, x, z) {
  return rooms.find((r) => r.f === f && r.parts.some((p) => inside(x, z, p)));
}
export function regionAt(f, x, z) {
  if (!FLOOR_IDS.includes(f)) return 'void';
  if (f === 2 && inside(x, z, ATRIUM)) return 'void';
  if (!houseContains(f, x, z)) return f === 1 ? 'outside' : 'void';
  return roomAt(f, x, z)?.id || `hall${f}`;
}
// Boundaries come from the actual room footprints, including their recesses and atrium.
// Unit segments are merged after cutting openings, so collision and cutaway walls agree.
for (const f of FLOOR_IDS) {
  const segments = [];
  for (let x = -25; x <= 25; x += 0.5)
    for (let z = -16; z < 16; z += 0.5) {
      const a = regionAt(f, x - 0.05, z + 0.25),
        b = regionAt(f, x + 0.05, z + 0.25);
      if (a === b || [a, b].every((r) => r === 'outside' || r === 'void')) continue;
      if (
        doors.some(
          (d) => d.f === f && d.axis === 'z' && d.x === x && Math.abs(z + 0.25 - d.z) < d.d / 2,
        )
      )
        continue;
      segments.push({ axis: 'z', constant: x, start: z, a, b });
    }
  for (let z = -16; z <= 16; z += 0.5)
    for (let x = -25; x < 25; x += 0.5) {
      const a = regionAt(f, x + 0.25, z - 0.05),
        b = regionAt(f, x + 0.25, z + 0.05);
      if (a === b || [a, b].every((r) => r === 'outside' || r === 'void')) continue;
      if (
        doors.some(
          (d) => d.f === f && d.axis !== 'z' && d.z === z && Math.abs(x + 0.25 - d.x) < d.w / 2,
        )
      )
        continue;
      segments.push({ axis: 'x', constant: z, start: x, a, b });
    }
  segments.sort(
    (a, b) => a.axis.localeCompare(b.axis) || a.constant - b.constant || a.start - b.start,
  );
  let previous;
  for (const s of segments) {
    if (
      previous &&
      s.axis === previous.axis &&
      s.constant === previous.constant &&
      s.start === previous.end &&
      s.a === previous.a &&
      s.b === previous.b
    ) {
      previous.end += 0.5;
    } else {
      previous = { ...s, end: s.start + 0.5 };
      walls.push(previous);
    }
  }
  for (const w of walls.filter((w) => w.f === undefined))
    Object.assign(w, {
      f,
      x: w.axis === 'x' ? (w.start + w.end) / 2 : w.constant,
      z: w.axis === 'z' ? (w.start + w.end) / 2 : w.constant,
      w: w.axis === 'x' ? w.end - w.start : 0.22,
      d: w.axis === 'z' ? w.end - w.start : 0.22,
    });
}
let id = 0;
function prop(f, room, type, x, z, w, d, extra = {}) {
  const p = { id: `p${id++}`, f, room, type, x, z, w, d, solid: true, ...extra };
  props.push(p);
  if (extra.hide) hides.push({ id: `h${id++}`, f, prop: p.id, kind: type, x, z });
  return p;
}
function device(f, room, type, x, z) {
  devices.push({ id: `v${id++}`, f, room, type, x, z });
}
prop(1, 'r1-0', 'sofa', -17, -6.5, 6, 2, { hide: true, rotation: Math.PI });
prop(1, 'r1-0', 'sofa', -8, -10, 2, 5, { hide: true, rotation: -Math.PI / 2 });
prop(1, 'r1-0', 'table', -17, -10, 3, 1.5, { low: true });
prop(1, 'r1-0', 'tv', -11, -15.35, 4, 0.9);
prop(1, 'r1-0', 'shelf', -7, 3.35, 4, 1, { hide: true, rotation: Math.PI });
prop(1, 'r1-0', 'chair', 0, 1, 1.2, 1.2);
prop(1, 'r1-0', 'rug', -17, -9, 9, 7, { solid: false });
prop(1, 'r1-1', 'table', 3, -11, 7, 3);
for (const x of [0, 6])
  for (const z of [-13.3, -8.7])
    prop(1, 'r1-1', 'chair', x, z, 1, 1, { rotation: z > -11 ? Math.PI : 0 });
prop(1, 'r1-1', 'shelf', 10, -13, 1.5, 4, { hide: true, rotation: -Math.PI / 2 });
prop(1, 'r1-2', 'counter', 18, -15.2, 7, 1.1);
prop(1, 'r1-2', 'fridge', 23.9, -14, 1.7, 2.2, { hide: true, rotation: -Math.PI / 2 });
prop(1, 'r1-2', 'table', 17, -10, 4, 2.4);
prop(1, 'r1-2', 'sink', 24.2, -5.5, 1.1, 2);
prop(1, 'r1-3', 'desk', -17, 5, 5, 2);
prop(1, 'r1-3', 'chair', -17, 7, 1, 1, { rotation: Math.PI });
prop(1, 'r1-3', 'shelf', -24.25, 9.5, 1.2, 4, { hide: true, rotation: Math.PI / 2 });
prop(1, 'r1-3', 'sofa', -14, 11, 5, 1.5, { hide: true, rotation: Math.PI });
prop(1, 'r1-3', 'wardrobe', -11, 2, 1.5, 2, { hide: true, rotation: -Math.PI / 2 });
prop(1, 'r1-3', 'shelf', -13.2, 0.7, 4, 1);
prop(1, 'r1-3', 'rug', -17, 5.5, 7, 6, { solid: false });
prop(1, 'r1-4', 'sink', 17, 0.8, 3, 1.2);
prop(1, 'r1-4', 'toilet', 23.8, 1.3, 1.2, 1.8);
prop(1, 'r1-4', 'wardrobe', 24, 5, 1.5, 1.4, { hide: true, rotation: -Math.PI / 2 });
prop(1, 'r1-5', 'car', 17.5, 10.7, 4, 6);
prop(1, 'r1-5', 'shelf', 12, 13.5, 1.5, 4, { hide: true, rotation: Math.PI / 2 });
prop(1, 'r1-5', 'boxes', 23, 7, 2, 1.5, { hide: true });
prop(1, 'r1-5', 'washer', 22.5, 15, 3, 1.5);
prop(1, 'r1-5', 'chair', CAPTURE_POINT.x, CAPTURE_POINT.z, 0.8, 0.8, { solid: false });
for (const [rid, x, z, wx, wz, dx, dz] of [
  ['r2-0', -16, -13.35, -23.8, -13, -8, -15],
  ['r2-2', 18, -13.35, 23.8, -13, 14, -15],
  ['r2-3', -17, 4.65, -23.8, 12, -13, 15],
  ['r2-4', 0, 10.65, 7.8, 13, -5, 15],
]) {
  prop(2, rid, 'bed', x, z, 4, 5, { hide: true });
  prop(2, rid, 'wardrobe', wx, wz, 1.8, 4, {
    hide: true,
    rotation: wx < 0 ? Math.PI / 2 : -Math.PI / 2,
  });
  prop(2, rid, 'desk', dx, dz, 4, 1.3, { rotation: dz > 0 ? Math.PI : 0 });
  prop(2, rid, 'rug', x, z + 1, 6, 5, { solid: false });
}
prop(2, 'r2-1', 'sink', 3, -15.2, 3, 1.1);
prop(2, 'r2-1', 'bath', 5.7, -11, 2, 1.4);
prop(2, 'r2-1', 'toilet', 0.5, -11.2, 1.2, 1.8, { rotation: Math.PI });
prop(2, 'r2-5', 'sink', 19, 2.8, 3, 1.1);
prop(2, 'r2-5', 'bath', 23.8, 5, 1.8, 3);
prop(2, 'r2-5', 'toilet', 17, 7.5, 1.2, 1.8, { rotation: Math.PI });
prop(2, 'r2-6', 'shelf', 24, 12.5, 1.4, 5, { hide: true, rotation: -Math.PI / 2 });
prop(2, 'r2-6', 'washer', 17, 15, 4, 1.5);
for (const r of rooms) {
  const d = doors.find((d) => d.f === r.f && d.room === r.id && !d.exterior);
  const n = d?.axis === 'z' ? { x: 1, z: 0 } : { x: 0, z: 1 };
  let target = d ? { x: d.x + n.x * 0.85, z: d.z + n.z * 0.85 } : r.nav;
  if (d && roomAt(r.f, target.x, target.z)?.id !== r.id)
    target = { x: d.x - n.x * 0.85, z: d.z - n.z * 0.85 };
  if (d) {
    const offset = (d.axis === 'z' ? d.d : d.w) / 2 + 0.65;
    const options = [-1, 1].map((sign) => ({
      x: target.x + (d.axis === 'x' ? sign * offset : 0),
      z: target.z + (d.axis === 'z' ? sign * offset : 0),
    }));
    target =
      options.find((p) => roomAt(r.f, p.x, p.z)?.id === r.id && !blocked(r.f, p.x, p.z, {}, 0.2)) ||
      target;
  }
  device(r.f, r.id, 'light', target.x, target.z);
}
device(1, 'r1-0', 'tv', -11, -14.3);
device(1, 'r1-2', 'bottles', 20, -14);
device(1, 'r1-1', 'bottles', -2.5, -6);
device(1, 'r1-5', 'bottles', 23, 9);
device(2, 'r2-6', 'bottles', 16, 13);
device(1, 'outside', 'bottles', -18, -23);
device(1, 'outside', 'breaker', 26.3, 12);
prop(1, 'outside', 'pool', POOL.x, POOL.z, POOL.w, POOL.d, { occludes: false });
prop(1, 'outside', 'counter', -18, -24.5, 5, 1.2);
for (const [x, z] of [
  [-12, -33],
  [20, -33],
  [0, -40],
  [10, -40],
])
  prop(1, 'outside', 'lounger', x, z, 2, 4, { occludes: false });
prop(1, 'outside', 'table', 16, -24, 2.5, 2);
prop(1, 'outside', 'sofa', 20, -22, 4, 1.7, { hide: true, rotation: Math.PI });
prop(1, 'outside', 'boxes', 32, 16, 2.5, 2, { hide: true });
// Garden storage shelters: enter with E, hold E inside to watch the terrace.
prop(1, 'outside', 'wardrobe', -25.8, -19.5, 1.8, 2, {
  hide: true,
  outdoor: true,
  rotation: Math.PI / 2,
});
prop(1, 'outside', 'wardrobe', 25.8, -22, 1.8, 2, {
  hide: true,
  outdoor: true,
  rotation: -Math.PI / 2,
});
for (const [x, z] of [
  [-29, -12],
  [-29, 10],
  [29, -18],
  [29, 18],
])
  prop(1, 'outside', 'plant', x, z, 1.2, 1.2);
// A continuous infiltration route, kept away from doors, stairs and the starting path.
export const bushes = [];
for (const [x, z, w, d] of [
  [-32, -8, 3, 5],
  [-32, -16, 3, 5],
  [-29, -22, 3, 4],
  [-26, -27, 4, 3],
  [-21, -28, 4, 2],
  [-16, -28, 3, 2],
  [-9, -28, 3, 1.6],
  [-2, -28, 3, 1.6],
  [6, -28, 3, 1.6],
  [14, -28, 3, 1.6],
  [21, -28, 3, 1.6],
  [-25, -24, 2, 3],
  [24.5, -25.5, 2, 3],
  [27, -25, 3, 4],
  [31, -12, 3, 5],
  [31, 3, 3, 4],
  [-29, 17, 4, 3],
]) {
  bushes.push(prop(1, 'outside', 'bush', x, z, w, d, { solid: false, occludes: false }));
}
export function inBush(p) {
  return p.f === 1 && bushes.some((b) => inside(p.x, p.z, b));
}
export function illuminationAt(p, lights = {}, power = true) {
  if (!power) return 0;
  const region = regionAt(p.f, p.x, p.z);
  if (region !== 'outside') return lights[region] === false ? 0 : 1;
  const sources = [
    ...gardenLamps.map((l) => ({ ...l, r: 3.8 })),
    ...[-21, -9, 9, 21].map((x) => ({ x, z: -19, r: 11 })),
    { x: -5, z: -22, r: 6 },
    { x: 0, z: 17, r: 4 },
  ];
  return Math.max(0, ...sources.map((s) => Math.max(0, 1 - distance(p, s) / s.r)));
}
export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}
export function inside(x, z, b, r = 0) {
  return Math.abs(x - b.x) < b.w / 2 + r && Math.abs(z - b.z) < b.d / 2 + r;
}
// The ajar leaf uses the same hinge and angle as the renderer.
export const AJAR_ANGLE = Math.PI / 5;
export function doorLeafContains(d, x, z, radius = 0) {
  const width = d.axis === 'z' ? d.d : d.w;
  const angle = (d.axis === 'z' ? Math.PI / 2 : 0) + AJAR_ANGLE;
  const dx = x - (d.axis === 'z' ? d.x : d.x - width / 2);
  const dz = z - (d.axis === 'z' ? d.z + width / 2 : d.z);
  const along = dx * Math.cos(angle) - dz * Math.sin(angle);
  const across = dx * Math.sin(angle) + dz * Math.cos(angle);
  return along > -radius && along < width + radius && Math.abs(across) < 0.065 + radius;
}
function ajarBlocksRay(d, a, b) {
  const width = d.axis === 'z' ? d.d : d.w;
  const angle = (d.axis === 'z' ? Math.PI / 2 : 0) + AJAR_ANGLE;
  const local = (p) => {
    const x = p.x - (d.axis === 'z' ? d.x : d.x - width / 2);
    const z = p.z - (d.axis === 'z' ? d.z + width / 2 : d.z);
    return [x * Math.cos(angle) - z * Math.sin(angle), x * Math.sin(angle) + z * Math.cos(angle)];
  };
  const start = local(a),
    end = local(b);
  let near = 0,
    far = 1;
  for (const [axis, min, max] of [
    [0, 0, width],
    [1, -0.065, 0.065],
  ]) {
    const delta = end[axis] - start[axis];
    if (Math.abs(delta) < 1e-9) {
      if (start[axis] < min || start[axis] > max) return false;
    } else {
      const t1 = (min - start[axis]) / delta,
        t2 = (max - start[axis]) / delta;
      near = Math.max(near, Math.min(t1, t2));
      far = Math.min(far, Math.max(t1, t2));
      if (near > far) return false;
    }
  }
  return far > 0 && near < 1;
}
export function blocked(f, x, z, doorStates = {}, radius = 0.32, ignoreDoors = false) {
  if (!FLOOR_IDS.includes(f)) return true;
  if (f === 1) {
    if (
      x < WORLD.minX + radius ||
      x > WORLD.maxX - radius ||
      z < WORLD.minZ + radius ||
      z > WORLD.maxZ - radius
    )
      return true;
  } else if (
    !houseContains(f, x - radius, z - radius) ||
    !houseContains(f, x + radius, z + radius) ||
    inside(x, z, ATRIUM, radius) ||
    stairVoids.some((h) => inside(x, z, h, radius))
  )
    return true;
  return (
    walls.some((w) => w.f === f && inside(x, z, w, radius)) ||
    props.some((p) => p.f === f && p.solid && inside(x, z, p, radius)) ||
    doors.some(
      (d) =>
        d.f === f &&
        (d.window
          ? inside(x, z, d, radius)
          : !ignoreDoors &&
            (doorStates[d.id] === 'ajar'
              ? inside(x, z, d, radius) || doorLeafContains(d, x, z, radius)
              : !doorStates[d.id] && inside(x, z, d, radius))),
    )
  );
}
export function roomFloorParts(r) {
  return r.parts;
}

export function lineClear(f, a, b, doorStates = {}, ignoreFurniture = false, throughGlass = true) {
  if (
    doors.some(
      (d) => d.f === f && !d.window && doorStates[d.id] === 'ajar' && ajarBlocksRay(d, a, b),
    )
  )
    return false;
  const n = Math.ceil(distance(a, b) / 0.18);
  for (let i = 1; i < n; i++) {
    const x = a.x + ((b.x - a.x) * i) / n,
      z = a.z + ((b.z - a.z) * i) / n;
    if (
      walls.some((w) => w.f === f && !w.railing && inside(x, z, w)) ||
      doors.some(
        (d) =>
          d.f === f &&
          (d.window
            ? !throughGlass && inside(x, z, d)
            : doorStates[d.id] === 'ajar'
              ? false // Ajar leaves were intersected analytically above.
              : !doorStates[d.id] && inside(x, z, d)),
      ) ||
      (!ignoreFurniture &&
        props.some(
          (p) =>
            p.f === f && p.solid && p.type !== 'chair' && p.occludes !== false && inside(x, z, p),
        ))
    )
      return false;
  }
  return true;
}
// A* on a half-meter grid. Doors are traversable in planning; actors open them on approach.
const navigationCells = new Map();
function navigationBlocked(f, x, z) {
  const key = `${f}:${x}:${z}`;
  if (!navigationCells.has(key)) navigationCells.set(key, blocked(f, x / 2, z / 2, {}, 0.35, true));
  return navigationCells.get(key);
}
export function pathfind(f, start, end, states = {}, avoid = []) {
  const impassable = (x, z) =>
    navigationBlocked(f, x, z) ||
    avoid.some((id) => {
      const d = doors.find((d) => d.id === id);
      return d?.f === f && inside(x / 2, z / 2, d, 0.35);
    });
  const scale = 2,
    key = (x, z) => `${x},${z}`;
  function nearest(p) {
    const bx = Math.round(p.x * scale),
      bz = Math.round(p.z * scale);
    for (let r = 0; r < 10; r++)
      for (let dx = -r; dx <= r; dx++)
        for (let dz = -r; dz <= r; dz++)
          if (!navigationBlocked(f, bx + dx, bz + dz)) return [bx + dx, bz + dz];
    return [bx, bz];
  }
  const [sx, sz] = nearest(start),
    [ex, ez] = nearest(end),
    target = key(ex, ez);
  const open = [{ x: sx, z: sz, g: 0, h: 0 }],
    seen = new Map([[key(sx, sz), 0]]),
    parent = new Map();
  const score = (node) => node.g + node.h;
  function push(node) {
    let i = open.length;
    open.push(node);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (score(open[parent]) <= score(node)) break;
      open[i] = open[parent];
      i = parent;
    }
    open[i] = node;
  }
  function pop() {
    const first = open[0],
      last = open.pop();
    if (open.length) {
      let i = 0;
      while (i * 2 + 1 < open.length) {
        let child = i * 2 + 1;
        if (child + 1 < open.length && score(open[child + 1]) < score(open[child])) child++;
        if (score(last) <= score(open[child])) break;
        open[i] = open[child];
        i = child;
      }
      open[i] = last;
    }
    return first;
  }
  let found;
  for (let count = 0; open.length && count < 20000; count++) {
    const cur = pop(),
      ck = key(cur.x, cur.z);
    if (cur.g !== seen.get(ck)) continue;
    if (ck === target) {
      found = cur;
      break;
    }
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1],
    ]) {
      const nx = cur.x + dx,
        nz = cur.z + dz,
        nk = key(nx, nz),
        ng = cur.g + Math.hypot(dx, dz);
      if (seen.has(nk) && seen.get(nk) <= ng) continue;
      if (impassable(nx, nz)) continue;
      if (dx && dz && (impassable(cur.x, nz) || impassable(nx, cur.z))) continue;
      seen.set(nk, ng);
      parent.set(nk, ck);
      push({ x: nx, z: nz, g: ng, h: Math.hypot(ex - nx, ez - nz) });
    }
  }
  if (!found) return [];
  const result = [];
  let k = target;
  while (k !== key(sx, sz)) {
    const [x, z] = k.split(',').map(Number);
    result.push({ x: x / scale, z: z / scale });
    k = parent.get(k);
    if (!k) return [];
  }
  return result.reverse();
}

export function peekView(viewer, states = {}) {
  const slit = doors.find((d) => d.id === viewer.doorPeek && d.f === viewer.f);
  if (slit && states[slit.id] === 'ajar' && distance(viewer, slit) <= 1.9) {
    const side = Math.sign(slit.axis === 'z' ? viewer.x - slit.x : viewer.z - slit.z) || 1;
    return {
      ...viewer,
      x: slit.axis === 'x' ? slit.x + slit.w * 0.35 : slit.x + side * 0.35,
      z: slit.axis === 'z' ? slit.z - slit.d * 0.35 : slit.z + side * 0.35,
    };
  }
  if (viewer.hidden && viewer.hidePeek) {
    const hide = hides.find((h) => h.id === viewer.hidden),
      prop = props.find((p) => p.id === hide?.prop);
    const angle = prop?.rotation || 0;
    return {
      ...viewer,
      x:
        viewer.x +
        Math.sin(angle) * ((Math.abs(Math.sin(angle)) > 0.5 ? prop?.w : prop?.d || 1) / 2 + 0.2),
      z:
        viewer.z +
        Math.cos(angle) * ((Math.abs(Math.sin(angle)) > 0.5 ? prop?.w : prop?.d || 1) / 2 + 0.2),
      hidden: null,
    };
  }
  const d = doors.find((d) => d.id === viewer.peeking && d.f === viewer.f);
  if (!d || states[d.id] || distance(viewer, d) > 1.9) return viewer;
  const side = Math.sign(d.axis === 'z' ? viewer.x - d.x : viewer.z - d.z) || 1;
  return {
    ...viewer,
    x: d.x + (d.axis === 'z' ? -side * 0.22 : d.w * 0.35),
    z: d.z + (d.axis === 'x' ? -side * 0.22 : -d.d * 0.35),
  };
}
export function visibleRegions(viewer, states = {}) {
  viewer = peekView(viewer, states);
  const current = regionAt(viewer.f, viewer.x, viewer.z),
    visible = new Set([current]);
  for (const d of doors) {
    if (d.f !== viewer.f) continue;
    if (d.window) {
      if (
        nearWindow(viewer, d, 3) &&
        lineClear(viewer.f, viewer, d, states) &&
        (current === 'outside' || current === d.room)
      ) {
        visible.add('outside');
        visible.add(d.room);
      }
      continue;
    }
    if (!states[d.id] || distance(viewer, d) > 6.5) continue;
    const normal = d.axis === 'z' ? { x: 1, z: 0 } : { x: 0, z: 1 };
    const a = regionAt(d.f, d.x + normal.x * 0.7, d.z + normal.z * 0.7),
      b = regionAt(d.f, d.x - normal.x * 0.7, d.z - normal.z * 0.7);
    const portals = [-0.35, 0, 0.35].map((offset) => ({
      x: d.x + (d.axis === 'x' ? d.w * offset : 0),
      z: d.z + (d.axis === 'z' ? d.d * offset : 0),
    }));
    if (
      (a === current || b === current) &&
      portals.some((p) => lineClear(viewer.f, viewer, p, states))
    ) {
      visible.add(a);
      visible.add(b);
    }
  }
  return visible;
}
export function canObserve(viewer, point, states = {}, regions = visibleRegions(viewer, states)) {
  viewer = peekView(viewer, states);
  return (
    viewer.f === point.f &&
    regions.has(regionAt(point.f, point.x, point.z)) &&
    lineClear(point.f, viewer, point, states, true)
  );
}

export function windowNormal(d) {
  return d.normal || (d.axis === 'z' ? { x: Math.sign(d.x), z: 0 } : { x: 0, z: Math.sign(d.z) });
}
export function nearWindow(p, d, range = 1.85) {
  if (!d.window || p.f !== d.f || distance(p, d) > range) return false;
  const tangent = d.axis === 'z' ? Math.abs(p.z - d.z) : Math.abs(p.x - d.x);
  return tangent < 0.85;
}
export function windowLanding(p, d, states = {}) {
  const normal = windowNormal(d),
    outside = regionAt(p.f, p.x, p.z) === 'outside',
    sign = outside ? -1 : 1;
  for (const depth of [1.05, 1.3, 1.55])
    for (const offset of [0, -0.45, 0.45]) {
      const dest = {
        x: d.x + normal.x * depth * sign + normal.z * offset,
        z: d.z + normal.z * depth * sign + normal.x * offset,
      };
      if (
        !blocked(d.f, dest.x, dest.z, states) &&
        regionAt(d.f, dest.x, dest.z) === (outside ? d.room : 'outside')
      )
        return dest;
    }
  return null;
}

// Access points face usable floor space rather than the wall behind the furniture.
for (const h of hides) {
  const p = props.find((p) => p.id === h.prop);
  const angle = p.rotation || 0,
    depth = Math.abs(Math.sin(angle)) > 0.5 ? p.w : p.d;
  const candidates = [
    ...(h.kind === 'wardrobe'
      ? [
          {
            x: p.x + Math.sin(angle) * (depth / 2 + 0.65),
            z: p.z + Math.cos(angle) * (depth / 2 + 0.65),
          },
        ]
      : []),
    { x: p.x, z: p.z + p.d / 2 + 0.65 },
    { x: p.x, z: p.z - p.d / 2 - 0.65 },
    { x: p.x - p.w / 2 - 0.65, z: p.z },
    { x: p.x + p.w / 2 + 0.65, z: p.z },
  ];
  const valid = candidates.filter(
    (a) => !blocked(h.f, a.x, a.z, {}, 0.35, true) && regionAt(h.f, a.x, a.z) === p.room,
  );
  const access =
    valid.find((a) => !doors.some((d) => d.window && d.f === h.f && distance(a, d) < 2)) ||
    valid[0];
  if (access) Object.assign(h, access);
}

// Both prediction and authority use this conservative collision-aware throw path.
export function bottleTrajectory(p, states = {}, charge = 0) {
  const strength = Math.max(0, Math.min(1, charge)),
    reach = 2.5 + strength * 9.5;
  const dir = { x: Math.sin(p.angle), z: Math.cos(p.angle) };
  let x = p.x,
    z = p.z;
  for (let d = 0; d < reach; d += 0.15) {
    const step = Math.min(0.15, reach - d),
      nx = x + dir.x * step,
      nz = z + dir.z * step;
    if (blocked(p.f, nx, nz, states, 0.05)) break;
    x = nx;
    z = nz;
  }
  const range = Math.hypot(x - p.x, z - p.z);
  return { x, z, range, height: 1 + range * 0.12, duration: 0.35 + range * 0.045 };
}

export function hallFloorParts(f) {
  const parts = [];
  for (let z = HOUSE.minZ; z < HOUSE.maxZ; z++) {
    let start = null;
    for (let x = HOUSE.minX; x <= HOUSE.maxX; x++) {
      const hall = x < HOUSE.maxX && regionAt(f, x + 0.5, z + 0.5) === `hall${f}`;
      if (hall && start === null) start = x;
      if (!hall && start !== null) {
        const w = x - start,
          cx = (start + x) / 2;
        const previous = parts.find((p) => p.x === cx && p.w === w && p.z + p.d / 2 === z);
        if (previous) {
          previous.z += 0.5;
          previous.d++;
        } else parts.push({ x: cx, z: z + 0.5, w, d: 1 });
        start = null;
      }
    }
  }
  return parts;
}
for (const w of walls)
  w.railing =
    w.f === 2 &&
    (w.a === 'void' || w.b === 'void') &&
    w.x > HOUSE.minX + 0.1 &&
    w.x < HOUSE.maxX - 0.1 &&
    w.z > HOUSE.minZ + 0.1 &&
    w.z < HOUSE.maxZ - 0.1;
