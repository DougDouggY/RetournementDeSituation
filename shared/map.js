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
let id = 0;
function prop(f, room, type, x, z, w, d, options = {}) {
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
  devices.push({ id: `v${id++}`, f, room, type, x, z });
}
function wall(f, x, z, w, d) {
  walls.push({ f, x, z, w, d });
}
for (let f = 0; f < 3; f++) {
  if (f === 1) {
    // Real gaps in the outer shell, closed by authoritative door/window colliders.
    wall(f, -15.5, -12, 5, 0.25);
    wall(f, 3.5, -12, 29, 0.25);
    wall(f, -3.5, 12, 29, 0.25);
    wall(f, 15.5, 12, 5, 0.25);
    for (const x of [-18, 18]) {
      wall(f, x, -6.6, 0.25, 10.8);
      wall(f, x, 6.6, 0.25, 10.8);
    }
    doors.push(
      { id: 'entry-west', f, x: -18, z: 0, w: 0.25, d: 2.4, axis: 'z', exterior: true },
      { id: 'entry-east', f, x: 18, z: 0, w: 0.25, d: 2.4, axis: 'z', exterior: true },
      {
        id: 'window-salon',
        f,
        x: -12,
        z: -12,
        w: 2,
        d: 0.25,
        exterior: true,
        window: true,
        room: 'r1-0',
      },
      {
        id: 'window-garage',
        f,
        x: 12,
        z: 12,
        w: 2,
        d: 0.25,
        exterior: true,
        window: true,
        room: 'r1-5',
      },
    );
  } else {
    wall(f, 0, -12, 36, 0.25);
    wall(f, 0, 12, 36, 0.25);
    wall(f, -18, 0, 0.25, 24);
    wall(f, 18, 0, 0.25, 24);
  }
  for (const x of [-6, 6]) for (const z of [-7, 7]) wall(f, x, z, 0.2, 10);
  for (let row = 0; row < 2; row++)
    for (let col = 0; col < 3; col++) {
      const x = -12 + col * 12,
        z = row ? 7 : -7,
        index = row * 3 + col;
      const r = {
        id: `r${f}-${index}`,
        f,
        x,
        z,
        w: 12,
        d: 10,
        name: layouts[f][index],
        style: (f * 2 + index) % 6,
      };
      rooms.push(r);
      const boundary = row ? 2 : -2;
      wall(f, x - 3.5, boundary, 5, 0.2);
      wall(f, x + 3.5, boundary, 5, 0.2);
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
        prop(f, r.id, 'tv', x, z - 3.5, 3, 0.8);
        prop(f, r.id, 'rug', x, z + 1, 7, 5, { solid: false });
        device(f, r.id, 'tv', x, z - 2.7);
      } else if (r.name === 'Cuisine' || r.name === 'Salle à manger') {
        prop(f, r.id, 'table', x, z, 4, 2.1);
        for (const dx of [-1.3, 1.3])
          for (const dz of [-1.8, 1.8]) prop(f, r.id, 'chair', x + dx, z + dz, 0.8, 0.8);
        prop(f, r.id, 'counter', x, z - 4, 7, 1.1);
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
export function roomAt(f, x, z) {
  return rooms.find((r) => r.f === f && Math.abs(x - r.x) < 6 && Math.abs(z - r.z) < 5);
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
    (!ignoreDoors && doors.some((d) => d.f === f && !doorStates[d.id] && inside(x, z, d, radius)))
  );
}
export function lineClear(f, a, b, doorStates = {}, ignoreFurniture = false) {
  const n = Math.ceil(distance(a, b) / 0.18);
  for (let i = 1; i < n; i++) {
    const x = a.x + ((b.x - a.x) * i) / n,
      z = a.z + ((b.z - a.z) * i) / n;
    if (
      walls.some((w) => w.f === f && inside(x, z, w)) ||
      doors.some((d) => d.f === f && !doorStates[d.id] && inside(x, z, d)) ||
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
    if (d.f !== viewer.f || !states[d.id] || distance(viewer, d) > 6.5) continue;
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
