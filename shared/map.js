// One deterministic collision/interaction map shared by renderer and authority.
export const FLOORS = ['Sous-sol', 'Rez-de-chaussée', 'Étage'];
export const NIGHT = 540;
export const WORLD = { minX: -27, maxX: 27, minZ: -22, maxZ: 22 };
const layouts = [
  ['Cave à vin', 'Local électrique', 'Buanderie', 'Réserve', 'Archives', 'Chambre froide'],
  ['Salon', 'Salle à manger', 'Cuisine', 'Bureau', 'Salle de bains', 'Garage'],
  [
    'Chambre principale',
    'Chambre d’amis',
    'Chambre bleue',
    'Dressing',
    'Salle de bains',
    'Débarras',
  ],
];
export const rooms = [],
  walls = [],
  doors = [],
  props = [],
  hides = [],
  devices = [],
  stairs = [];
// Each floor and each side of the hall has its own partitions.
const partitions = [
  [
    [-18, -6, 2, 18],
    [-18, -10, 6, 18],
  ],
  [
    [-18, -2, 8, 18],
    [-18, -8, 0, 18],
  ],
  [
    [-18, -4, 4, 18],
    [-18, -9, 0, 18],
  ],
];
export const gardenLamps = [
  ...[-25, -22, -19].flatMap((x) => [-1.8, 1.8].map((z) => ({ x, z }))),
  ...[-14, -5, 5, 14].flatMap((x) => [-14, 14].map((z) => ({ x, z }))),
  ...[-7, 0, 7].map((z) => ({ x: 21, z })),
  ...[-8, 8].map((z) => ({ x: -21, z })),
];
const portals = [
  { id: 'entry-west', f: 1, x: -18, z: 0, w: 0.25, d: 2.4, axis: 'z', exterior: true },
  { id: 'entry-east', f: 1, x: 18, z: 0, w: 0.25, d: 2.4, axis: 'z', exterior: true },
  {
    id: 'window-salon',
    f: 1,
    x: -12,
    z: -12,
    w: 2,
    d: 0.25,
    window: true,
    exterior: true,
    room: 'r1-0',
  },
  {
    id: 'window-dining',
    f: 1,
    x: 3,
    z: -12,
    w: 2,
    d: 0.25,
    window: true,
    exterior: true,
    room: 'r1-1',
  },
  {
    id: 'window-kitchen',
    f: 1,
    x: 18,
    z: -7,
    w: 0.25,
    d: 2,
    axis: 'z',
    window: true,
    exterior: true,
    room: 'r1-2',
  },
  {
    id: 'window-office',
    f: 1,
    x: -18,
    z: 7,
    w: 0.25,
    d: 2,
    axis: 'z',
    window: true,
    exterior: true,
    room: 'r1-3',
  },
  {
    id: 'window-bathroom',
    f: 1,
    x: -4,
    z: 12,
    w: 2,
    d: 0.25,
    window: true,
    exterior: true,
    room: 'r1-4',
  },
  {
    id: 'window-garage',
    f: 1,
    x: 12,
    z: 12,
    w: 2,
    d: 0.25,
    window: true,
    exterior: true,
    room: 'r1-5',
  },
];
let id = 0;
function prop(f, room, type, x, z, w, d, options = {}) {
  const r = rooms.find((r) => r.id === room);
  if (r) {
    const sx = r.w / 12,
      sz = r.d / 10;
    x = r.x + (x - r.x) * sx;
    z = r.z + (z - r.z) * sz;
    w *= sx;
    d *= sz;
  }
  // Large furniture rests against a wall, with its access face kept clear.
  if (r && ['wardrobe', 'fridge'].includes(type)) x = r.x + r.w / 2 - w / 2 - 0.14;
  if (r && ['shelf', 'counter', 'tv', 'sink', 'washer', 'bath', 'bed'].includes(type)) {
    if (d > w && type !== 'bed') x = r.x + r.w / 2 - w / 2 - 0.14;
    else z = r.z + (r.z < 0 ? -1 : 1) * (r.d / 2 - d / 2 - 0.14);
  }
  if (r && type === 'plant') {
    x = r.x + r.w / 2 - w / 2 - 0.3;
    z = r.z + (r.z < 0 ? 1 : -1) * (r.d / 2 - d / 2 - 1);
    if (props.some((p) => p.room === room && p.solid && inside(x, z, p, Math.max(w, d) / 2))) {
      x = r.x - r.w / 2 + w / 2 + 0.3;
      z = r.z;
    }
  }
  // Leave a landing beside the glass; shorten long wall units when necessary.
  for (const win of portals.filter((win) => win.room === room)) {
    if (win.axis === 'z' && Math.abs(x - win.x) < w / 2 + 1.6 && Math.abs(z - win.z) < d / 2 + 1) {
      const low = r.z - r.d / 2 + 0.14,
        high = r.z + r.d / 2 - 0.14;
      const side = win.z - low > high - win.z ? -1 : 1;
      d = Math.min(d, (side < 0 ? win.z - low : high - win.z) - 1.2);
      z = win.z + side * (1.2 + d / 2);
    }
    if (win.axis !== 'z' && Math.abs(z - win.z) < d / 2 + 1.6 && Math.abs(x - win.x) < w / 2 + 1) {
      const low = r.x - r.w / 2 + 0.14,
        high = r.x + r.w / 2 - 0.14;
      const side = win.x - low > high - win.x ? -1 : 1;
      w = Math.min(w, (side < 0 ? win.x - low : high - win.x) - 1.2);
      x = win.x + side * (1.2 + w / 2);
    }
  }
  if (r?.cutout && inside(x, z, r.cutout, Math.max(w, d) / 2 + 0.15)) {
    z = r.cutout.z + (r.z < 0 ? -1 : 1) * (r.cutout.d / 2 + d / 2 + 0.15);
  }
  const p = { id: `p${id++}`, f, room, type, x, z, w, d, solid: true, ...options };
  props.push(p);
  if (options.hide)
    hides.push({
      id: `h${id++}`,
      f,
      x: x + (options.accessX || 0),
      z: z + d / 2 + 0.6,
      prop: p.id,
      kind: type,
    });
  return p;
}
function device(f, room, type, x, z) {
  const r = rooms.find((r) => r.id === room);
  if (r) {
    x = r.x + ((x - r.x) * r.w) / 12;
    z = r.z + ((z - r.z) * r.d) / 10;
  }
  devices.push({ id: `v${id++}`, f, room, type, x, z });
}
function wall(f, x, z, w, d) {
  walls.push({ f, x, z, w, d });
}
for (let f = 0; f < 3; f++) {
  for (const [axis, constant] of [
    ['x', -12],
    ['x', 12],
    ['z', -18],
    ['z', 18],
  ]) {
    const horizontal = axis === 'x',
      min = horizontal ? -18 : -12,
      max = horizontal ? 18 : 12;
    const gaps =
      f === 1
        ? portals
            .filter((d) => (horizontal ? d.z === constant : d.x === constant))
            .sort((a, b) => (horizontal ? a.x - b.x : a.z - b.z))
        : [];
    let start = min;
    for (const d of [...gaps, null]) {
      const end = d ? (horizontal ? d.x - d.w / 2 : d.z - d.d / 2) : max;
      if (end > start)
        wall(
          f,
          horizontal ? (start + end) / 2 : constant,
          horizontal ? constant : (start + end) / 2,
          horizontal ? end - start : 0.25,
          horizontal ? 0.25 : end - start,
        );
      if (d) start = horizontal ? d.x + d.w / 2 : d.z + d.d / 2;
    }
  }
  if (f === 1) doors.push(...portals);
  for (let row = 0; row < 2; row++)
    for (let col = 0; col < 3; col++) {
      const edges = partitions[f][row],
        left = edges[col],
        right = edges[col + 1];
      const x = (left + right) / 2,
        z = row ? 7 : -7,
        index = row * 3 + col;
      const r = {
        id: `r${f}-${index}`,
        f,
        x,
        z,
        w: right - left,
        d: 10,
        name: layouts[f][index],
        style: (f * 2 + index) % 6,
      };
      rooms.push(r);
      const boundary = row ? 2 : -2;
      if (col > 0) wall(f, left, z, 0.2, 10);
      // An entrance recess gives selected rooms an L-shaped footprint.
      const notch = index % 2 === 1 ? Math.min(2.4, r.w / 4) : 0;
      if (notch) {
        r.cutout = { x: left + notch / 2, z: boundary + (row ? 1 : -1), w: notch, d: 2 };
        wall(f, left + notch / 2, boundary + (row ? 2 : -2), notch, 0.2);
        wall(f, left + notch, boundary + (row ? 1 : -1), 0.2, 2);
      }
      wall(f, (left + notch + x - 1) / 2, boundary, x - 1 - left - notch, 0.2);
      wall(f, (x + 1 + right) / 2, boundary, right - x - 1, 0.2);
      doors.push({ id: `d${f}-${index}`, f, x, z: boundary, w: 2, d: 0.22, room: r.id });
      device(f, r.id, 'light', x - 2, boundary + (row ? 0.8 : -0.8));
      if (r.name.includes('Chambre') && !r.name.includes('froide')) {
        prop(f, r.id, 'bed', x - 2, z, 3.1, 4, { hide: true });
        prop(f, r.id, 'wardrobe', x + 4, z - 2, 1.5, 2, { hide: true });
        prop(f, r.id, 'desk', x + 3, z + 3, 2.6, 1.1);
        prop(f, r.id, 'nightstand', x + 0.2, z - 1, 1, 1);
        prop(f, r.id, 'rug', x, z + 1, 7, 5, { solid: false });
      } else if (r.name === 'Salon') {
        prop(f, r.id, 'sofa', x - 2, z, 3.8, 1.5, { hide: true });
        prop(f, r.id, 'sofa', x + 3, z + 2, 1.5, 3);
        prop(f, r.id, 'table', x, z + 1.4, 2, 1.3);
        prop(f, r.id, 'tv', x, z - 3, 3, 0.8);
        prop(f, r.id, 'rug', x, z + 1, 7, 5, { solid: false });
        device(f, r.id, 'tv', x, z - 2.7);
      } else if (r.name === 'Cuisine' || r.name === 'Salle à manger') {
        prop(f, r.id, 'table', x, z, 4, 2.1);
        for (const dx of [-1.3, 1.3])
          for (const dz of [-1.8, 1.8]) prop(f, r.id, 'chair', x + dx, z + dz, 0.8, 0.8);
        prop(f, r.id, 'counter', x, z - 3, 7, 1.1);
        prop(f, r.id, 'fridge', x + 4.5, z - 3, 1.5, 1.5, { hide: true });
        device(f, r.id, 'alarm', x - 4, z + 2.8);
      } else if (r.name.includes('bains')) {
        prop(f, r.id, 'bath', x - 2, z - 2, 3.8, 1.8);
        prop(f, r.id, 'sink', x + 3, z - 3, 2, 1.1);
        prop(f, r.id, 'wardrobe', x + 4, z + 1, 1.4, 2, { hide: true });
        prop(f, r.id, 'rug', x, z, 4, 2, { solid: false });
      } else if (r.name === 'Bureau') {
        prop(f, r.id, 'desk', x, z, 3.6, 1.8);
        prop(f, r.id, 'chair', x, z + 1.7, 0.8, 0.8);
        prop(f, r.id, 'shelf', x - 3, z - 4, 4, 1, { hide: true });
        prop(f, r.id, 'sofa', x + 3, z + 1, 1.5, 3, { hide: true });
      } else if (r.name === 'Garage') {
        prop(f, r.id, 'car', x - 1, z, 4, 6);
        prop(f, r.id, 'shelf', x + 4, z - 3, 1.2, 3, { hide: true });
        prop(f, r.id, 'boxes', x + 4, z + 2, 1.5, 1.5, { hide: true });
        device(f, r.id, 'alarm', x - 4, z + 3);
      } else {
        prop(f, r.id, r.name === 'Buanderie' ? 'washer' : 'shelf', x - 3, z - 2, 3.8, 1.2, {
          hide: true,
        });
        prop(f, r.id, 'shelf', x + 3, z - 2, 2.4, 1.2, { hide: true });
        prop(f, r.id, 'boxes', x - 2, z + 2, 1.8, 1.6, { hide: true });
        prop(f, r.id, 'table', x + 3, z + 2, 2, 1.3);
        if (r.name === 'Local électrique') device(f, r.id, 'breaker', x + 4, z - 3);
      }
      prop(f, r.id, 'plant', x - 4.7, z + 3.5, 0.8, 0.8);
      prop(f, r.id, 'lamp', x + 4.8, z + 3.6, 0.5, 0.5, { solid: false });
      device(f, r.id, 'bottles', x - 4.5, z + 2.5);
    }
  stairs.push(
    { id: `s${f}-up`, f, x: 16, z: 0, to: f < 2 ? f + 1 : null },
    { id: `s${f}-down`, f, x: -16, z: 0, to: f > 0 ? f - 1 : null },
  );
}
// Garden furniture also participates in the authoritative collision map.
prop(1, 'outside', 'sofa', -24, -6, 3, 1.2);
prop(1, 'outside', 'table', -24, -9, 2, 1.3);
prop(1, 'outside', 'plant', -20, 5, 1, 1);
prop(1, 'outside', 'plant', -20, -5, 1, 1);
prop(1, 'outside', 'boxes', 23, 8, 2, 1.8, { hide: true });
device(1, 'outside', 'breaker', -18.8, 4);
export function roomAt(f, x, z) {
  return rooms.find(
    (r) =>
      r.f === f &&
      Math.abs(x - r.x) < r.w / 2 &&
      Math.abs(z - r.z) < r.d / 2 &&
      (!r.cutout || !inside(x, z, r.cutout)),
  );
}
export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}
export function inside(x, z, b, r = 0) {
  return Math.abs(x - b.x) < b.w / 2 + r && Math.abs(z - b.z) < b.d / 2 + r;
}
export function blocked(f, x, z, doorStates = {}, radius = 0.32, ignoreDoors = false) {
  if (f === 1) {
    if (
      x < WORLD.minX + radius ||
      x > WORLD.maxX - radius ||
      z < WORLD.minZ + radius ||
      z > WORLD.maxZ - radius
    )
      return true;
  } else if (x < -17.6 || x > 17.6 || z < -11.6 || z > 11.6) return true;
  return (
    walls.some((w) => w.f === f && inside(x, z, w, radius)) ||
    props.some((p) => p.f === f && p.solid && inside(x, z, p, radius)) ||
    doors.some(
      (d) =>
        d.f === f && (d.window || (!ignoreDoors && !doorStates[d.id])) && inside(x, z, d, radius),
    )
  );
}
export function lineClear(f, a, b, doorStates = {}, ignoreFurniture = false, throughGlass = true) {
  const n = Math.ceil(distance(a, b) / 0.18);
  for (let i = 1; i < n; i++) {
    const x = a.x + ((b.x - a.x) * i) / n,
      z = a.z + ((b.z - a.z) * i) / n;
    if (
      walls.some((w) => w.f === f && inside(x, z, w)) ||
      doors.some(
        (d) => d.f === f && (d.window ? !throughGlass : !doorStates[d.id]) && inside(x, z, d),
      ) ||
      (!ignoreFurniture &&
        props.some((p) => p.f === f && p.solid && p.type !== 'chair' && inside(x, z, p)))
    )
      return false;
  }
  return true;
}
// A* on a half-meter grid. Doors are traversable in planning; actors open them on approach.
export function pathfind(f, start, end, states = {}) {
  const scale = 2,
    key = (x, z) => `${x},${z}`;
  function nearest(p) {
    const bx = Math.round(p.x * scale),
      bz = Math.round(p.z * scale);
    for (let r = 0; r < 10; r++)
      for (let dx = -r; dx <= r; dx++)
        for (let dz = -r; dz <= r; dz++)
          if (!blocked(f, (bx + dx) / scale, (bz + dz) / scale, states, 0.35, true))
            return [bx + dx, bz + dz];
    return [bx, bz];
  }
  const [sx, sz] = nearest(start),
    [ex, ez] = nearest(end),
    target = key(ex, ez);
  const open = [{ x: sx, z: sz, g: 0, h: 0 }],
    seen = new Map([[key(sx, sz), 0]]),
    parent = new Map();
  let found;
  for (let count = 0; open.length && count < 5000; count++) {
    let best = 0;
    for (let i = 1; i < open.length; i++)
      if (open[i].g + open[i].h < open[best].g + open[best].h) best = i;
    const cur = open.splice(best, 1)[0],
      ck = key(cur.x, cur.z);
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
      if (blocked(f, nx / scale, nz / scale, states, 0.35, true)) continue;
      if (
        dx &&
        dz &&
        (blocked(f, cur.x / scale, nz / scale, states, 0.35, true) ||
          blocked(f, nx / scale, cur.z / scale, states, 0.35, true))
      )
        continue;
      seen.set(nk, ng);
      parent.set(nk, ck);
      open.push({ x: nx, z: nz, g: ng, h: Math.hypot(ex - nx, ez - nz) });
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

// Visibility is recomputed from the current region, never from explored history.
export function regionAt(f, x, z) {
  if (f === 1 && (Math.abs(x) > 18.02 || Math.abs(z) > 12.02)) return 'outside';
  return roomAt(f, x, z)?.id || `hall${f}`;
}
export function visibleRegions(viewer, states = {}) {
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
    if ((a === current || b === current) && lineClear(viewer.f, viewer, d, states)) {
      visible.add(a);
      visible.add(b);
    }
  }
  return visible;
}
export function canObserve(viewer, point, states = {}, regions = visibleRegions(viewer, states)) {
  return (
    viewer.f === point.f &&
    regions.has(regionAt(point.f, point.x, point.z)) &&
    lineClear(point.f, viewer, point, states)
  );
}

export function windowNormal(d) {
  return d.axis === 'z' ? { x: Math.sign(d.x), z: 0 } : { x: 0, z: Math.sign(d.z) };
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

// Rectangular patches cover the exact L-shaped floor without filling its hallway recess.
export function roomFloorParts(r) {
  if (!r.cutout) return [r];
  const c = r.cutout,
    top = r.z < 0;
  return [
    { x: r.x, z: r.z + (top ? -c.d / 2 : c.d / 2), w: r.w, d: r.d - c.d },
    { x: r.x + c.w / 2, z: c.z, w: r.w - c.w, d: c.d },
  ];
}

// Access points face usable floor space rather than the wall behind the furniture.
for (const h of hides) {
  const p = props.find((p) => p.id === h.prop);
  const candidates = [
    { x: p.x, z: p.z + p.d / 2 + 0.65 },
    { x: p.x, z: p.z - p.d / 2 - 0.65 },
    { x: p.x - p.w / 2 - 0.65, z: p.z },
    { x: p.x + p.w / 2 + 0.65, z: p.z },
  ];
  const access = candidates.find(
    (a) => !blocked(h.f, a.x, a.z, {}, 0.35, true) && regionAt(h.f, a.x, a.z) === p.room,
  );
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
