import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  rooms,
  FLOOR_IDS,
  FLOOR_HEIGHT,
  stairVoids,
  illuminationAt,
  WORLD,
  HOUSE,
  POOL,
  TERRACE,
  ATRIUM,
  SPAWN,
  houseFloorParts,
  hallFloorParts,
  walls,
  doors,
  AJAR_ANGLE,
  peekView,
  lineClear,
  props,
  hides,
  devices,
  stairs,
  regionAt,
  visibleRegions,
  canObserve,
  gardenLamps,
  windowNormal,
  roomFloorParts,
  bottleTrajectory,
} from '../shared/map.js';
const palettes = [
  { floor: 0x4c5550, wall: 0x61736b },
  { floor: 0x775744, wall: 0x8d9c8a },
  { floor: 0x53636c, wall: 0x7b9296 },
  { floor: 0x786957, wall: 0x9a8f77 },
  { floor: 0x56655c, wall: 0x75908a },
  { floor: 0x6b5355, wall: 0x968784 },
];
function visualPose(p) {
  if (p.stair) {
    const s = p.stair,
      t = Math.min(1, s.elapsed / s.duration);
    return new THREE.Vector3(
      s.fromX + (s.x - s.fromX) * t,
      (s.fromF - 1) * FLOOR_HEIGHT + (s.toF - s.fromF) * FLOOR_HEIGHT * t,
      s.fromZ + (s.z - s.fromZ) * t,
    );
  }
  return new THREE.Vector3(p.x, (p.f - 1) * FLOOR_HEIGHT + (p.climbHeight || 0), p.z);
}
function cutRects(parts, holes) {
  for (const hole of holes) {
    const next = [];
    for (const p of parts) {
      const l = p.x - p.w / 2,
        r = p.x + p.w / 2,
        t = p.z - p.d / 2,
        b = p.z + p.d / 2;
      const L = Math.max(l, hole.x - hole.w / 2),
        R = Math.min(r, hole.x + hole.w / 2),
        T = Math.max(t, hole.z - hole.d / 2),
        B = Math.min(b, hole.z + hole.d / 2);
      if (L >= R || T >= B) {
        next.push(p);
        continue;
      }
      for (const [x1, z1, x2, z2] of [
        [l, t, r, T],
        [l, B, r, b],
        [l, T, L, B],
        [R, T, r, B],
      ])
        if (x2 > x1 && z2 > z1)
          next.push({ x: (x1 + x2) / 2, z: (z1 + z2) / 2, w: x2 - x1, d: z2 - z1 });
    }
    parts = next;
  }
  return parts;
}
const stairHoles = stairVoids;
const matCache = new Map(),
  geoCache = new Map();
function material(color, roughness = 0.85) {
  const k = `${color}/${roughness}`;
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshLambertMaterial({ color }));
  return matCache.get(k);
}
function box(parent, x, y, z, w, h, d, color, round = 0.04) {
  const key = [w, h, d, round].join(',');
  if (!geoCache.has(key))
    geoCache.set(
      key,
      round
        ? new RoundedBoxGeometry(w, h, d, 1, Math.min(round, w / 4, h / 4, d / 4))
        : new THREE.BoxGeometry(
            w,
            h,
            d,
            h < 0.12 && w > 3 && d > 3 ? Math.ceil(w) : 1,
            1,
            h < 0.12 && w > 3 && d > 3 ? Math.ceil(d) : 1,
          ),
    );
  const m = new THREE.Mesh(geoCache.get(key), material(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
function sphere(parent, x, y, z, r, color, sx = 1, sy = 1, sz = 1) {
  const key = `s${r}`;
  if (!geoCache.has(key)) geoCache.set(key, new THREE.SphereGeometry(r, 8, 6));
  const m = new THREE.Mesh(geoCache.get(key), material(color));
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.castShadow = true;
  parent.add(m);
  return m;
}
function cylinder(parent, x, y, z, r1, r2, h, color) {
  const key = `c${r1},${r2},${h}`;
  if (!geoCache.has(key)) geoCache.set(key, new THREE.CylinderGeometry(r1, r2, h, 10));
  const m = new THREE.Mesh(geoCache.get(key), material(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
function label(text, color = '#c5cbc1', size = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ctx.font = '500 42px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, 256, 76);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(5.5, 1.4),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.5 }),
  );
  m.rotation.x = -Math.PI / 2;
  return m;
}
let glowTexture;
function lightPool(parent, x, z, w, d, color = 0xf0bd6b) {
  if (!glowTexture) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d'),
      g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,.7)');
    g.addColorStop(0.45, 'rgba(255,255,255,.3)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    glowTexture = new THREE.CanvasTexture(c);
  }
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshBasicMaterial({
      map: glowTexture,
      color,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, 0.07, z);
  parent.add(mesh);
  return mesh;
}
function batchStatic(group, exclude = new Set()) {
  group.updateMatrixWorld(true);
  const byMaterial = new Map();
  group.traverse((m) => {
    if (!m.isMesh || m.material.transparent) return;
    let ancestor = m;
    while (ancestor && ancestor !== group) {
      if (exclude.has(ancestor)) return;
      ancestor = ancestor.parent;
    }
    // Rounded boxes are non-indexed; spheres and cylinders are indexed. Normalize
    // before merging, otherwise an entire material group can disappear.
    const geometry = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    geometry.applyMatrix4(
      new THREE.Matrix4().copy(group.matrixWorld).invert().multiply(m.matrixWorld),
    );
    const batch = byMaterial.get(m.material) || { geometries: [], meshes: [] };
    batch.geometries.push(geometry);
    batch.meshes.push(m);
    byMaterial.set(m.material, batch);
  });
  for (const [mat, batch] of byMaterial) {
    const merged = mergeGeometries(batch.geometries, false);
    if (merged) {
      for (const m of batch.meshes) m.removeFromParent();
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    for (const geometry of batch.geometries) geometry.dispose();
  }
}
function furniture(p) {
  const group = new THREE.Group(),
    w = Math.abs(Math.sin(p.rotation || 0)) > 0.5 ? p.d : p.w,
    d = Math.abs(Math.sin(p.rotation || 0)) > 0.5 ? p.w : p.d,
    wood = 0x73543e,
    dark = 0x282f31,
    cream = 0xb6ac91;
  group.position.set(p.x, 0, p.z);
  group.rotation.y = p.rotation || 0;
  const b = (x, y, z, W, H, D, c, r) => box(group, x, y, z, W, H, D, c, r);
  const leg = (x, z, h = 0.8) => b(x, h / 2, z, 0.12, h, 0.12, 0x332f2a);
  switch (p.type) {
    case 'rug': {
      const rug = b(0, 0.015, 0, w, 0.025, d, p.f === 2 ? 0x7b4546 : 0x535e4a, 0);
      for (const x of [-w / 2 + 0.15, w / 2 - 0.15])
        b(x, 0.035, 0, 0.04, 0.01, d - 0.2, 0xb59c75, 0);
      break;
    }
    case 'sofa':
      b(0, 0.35, 0, w, 0.6, d, 0x344e4c);
      b(0, 0.86, -d / 2 + 0.18, w, 1, 0.35, 0x2c4544);
      b(-w / 2 + 0.18, 0.7, 0, 0.35, 0.75, d, 0x2c4544);
      b(w / 2 - 0.18, 0.7, 0, 0.35, 0.75, d, 0x2c4544);
      for (let i = 0; i < 3; i++)
        b(-w / 3 + (i * w) / 3, 0.7, 0.05, w / 3 - 0.1, 0.2, d * 0.65, 0x54706a);
      b(w * 0.2, 0.95, -d * 0.1, 0.6, 0.55, 0.15, 0xb39362);
      break;
    case 'bed':
      b(0, 0.28, 0, w, 0.45, d, wood);
      b(0, 0.61, 0, w - 0.12, 0.35, d - 0.12, cream);
      b(0, 0.84, 0.6, w - 0.15, 0.2, d * 0.61, p.f === 2 ? 0x687a8d : 0x6a7b69);
      b(0, 0.83, -d / 2 + 0.65, w * 0.65, 0.2, 0.8, 0xd7d1b7);
      b(0, 0.7, -d / 2, w, 1.3, 0.16, wood);
      break;
    case 'wardrobe': {
      b(0, 1.25, -d / 2 + 0.06, w, 2.5, 0.12, wood);
      for (const x of [-w / 2 + 0.06, w / 2 - 0.06]) b(x, 1.25, 0, 0.12, 2.5, d, wood);
      for (const y of [0.08, 2.5]) b(0, y, 0, w, 0.12, d, wood);
      const leaves = [];
      for (const side of [-1, 1]) {
        const hinge = new THREE.Group();
        hinge.position.set((side * w) / 2, 0, d / 2);
        group.add(hinge);
        box(hinge, (-side * w) / 4, 1.25, 0, w / 2 - 0.02, 2.45, 0.09, wood);
        box(hinge, -side * (w / 2 - 0.1), 1.2, 0.07, 0.05, 0.25, 0.06, 0xc2a166);
        leaves.push(hinge);
      }
      group.userData.cabinetLeaves = leaves;
      break;
    }
    case 'fridge':
      b(0, 1.25, 0, w, 2.5, d, p.type === 'fridge' ? 0xb6c6be : wood);
      b(0, 1.3, d / 2 + 0.025, 0.035, 2.3, 0.04, 0x292d2b);
      for (const x of [-0.17, 0.17]) b(x, 1.15, d / 2 + 0.05, 0.06, 0.35, 0.08, 0xc2b08b);
      b(0, 2.57, 0, w + 0.12, 0.14, d + 0.1, wood);
      break;
    case 'table':
    case 'desk':
    case 'nightstand': {
      const h = p.type === 'nightstand' ? 0.65 : 1;
      b(0, h, 0, w, 0.16, d, wood);
      for (const x of [-w / 2 + 0.15, w / 2 - 0.15])
        for (const z of [-d / 2 + 0.15, d / 2 - 0.15]) leg(x, z, h);
      if (p.type === 'desk') {
        b(-0.6, 1.12, 0, 0.6, 0.05, 0.45, 0xd1c8aa);
        b(0.5, 1.35, -0.2, 0.9, 0.6, 0.12, 0x252e32);
        b(0.5, 1.36, -0.12, 0.73, 0.43, 0.02, 0x648385);
      } else {
        cylinder(group, 0.25, h + 0.12, 0, 0.22, 0.19, 0.08, 0xcec2a0);
        cylinder(group, -0.4, h + 0.22, 0.12, 0.07, 0.09, 0.35, 0x425c47);
      }
      break;
    }
    case 'chair':
      b(0, 0.52, 0, w, 0.16, d, wood);
      b(0, 0.95, -d / 2 + 0.08, w, 0.8, 0.13, wood);
      for (const x of [-0.3, 0.3]) for (const z of [-0.3, 0.3]) leg(x, z, 0.5);
      break;
    case 'shelf':
      b(0, 1.2, -d / 2 + 0.08, w, 2.4, 0.15, wood);
      for (const x of [-w / 2 + 0.08, w / 2 - 0.08]) b(x, 1.2, 0, 0.15, 2.4, d, wood);
      for (const y of [0.15, 0.9, 1.65, 2.4]) {
        b(0, y, 0, w, 0.12, d, wood);
        for (let i = 0; i < Math.floor(w / 0.32); i++)
          b(
            -w / 2 + 0.23 + i * 0.32,
            y + 0.28,
            0,
            0.22,
            0.44,
            0.38,
            [0x956a53, 0x737f68, 0xb39e73, 0x465a63][i % 4],
          );
      }
      break;
    case 'boxes':
      for (let i = 0; i < 3; i++) {
        const m = b(
          ((i % 2) - 0.5) * w * 0.45,
          0.38 + (i === 2 ? 0.72 : 0),
          i === 2 ? 0 : 0.1,
          w * 0.65,
          0.73,
          d * 0.75,
          0x9c8055,
        );
        m.rotation.y = i * 0.17;
        b(
          ((i % 2) - 0.5) * w * 0.45,
          0.75 + (i === 2 ? 0.72 : 0),
          0.1,
          0.14,
          0.012,
          d * 0.7,
          0xc4af7c,
        );
      }
      break;
    case 'counter':
      b(0, 0.6, 0, w, 1.2, d, 0x82918a);
      b(0, 1.24, 0, w + 0.1, 0.12, d + 0.1, 0xc0b9a3);
      for (let x = -w / 2 + 0.6; x < w / 2; x += 1.2)
        b(x, 0.7, d / 2 + 0.03, 0.35, 0.05, 0.05, 0x3e4d4c);
      cylinder(group, 1, 1.37, 0, 0.3, 0.25, 0.2, 0x31383b);
      break;
    case 'tv':
      b(0, 0.35, 0, w, 0.6, d, wood);
      b(0, 1.25, 0, w * 0.8, 1.3, 0.16, 0x1f292c);
      const screen = b(0, 1.27, 0.09, w * 0.72, 1.12, 0.02, 0x8ea7a0);
      screen.material = new THREE.MeshStandardMaterial({
        color: 0x8ea7a0,
        emissive: 0x8ea7a0,
        emissiveIntensity: 0.2,
      });
      break;
    case 'bush':
      for (let i = 0; i < 8; i++)
        sphere(
          group,
          (((i % 4) - 1.5) * w) / 6,
          0.65 + (i % 2) * 0.15,
          ((Math.floor(i / 4) - 0.5) * d) / 2,
          0.6,
          0x294a32,
          w / 3,
          1,
          d / 3,
        );
      break;
    case 'plant':
      cylinder(group, 0, 0.24, 0, 0.26, 0.19, 0.46, 0x86634e);
      for (let i = 0; i < 5; i++) {
        const a = i * 2.4;
        sphere(
          group,
          Math.sin(a) * 0.18,
          0.7 + i * 0.1,
          Math.cos(a) * 0.18,
          0.3,
          0x506b51,
          0.6,
          1.4,
          0.7,
        );
      }
      break;
    case 'lamp':
      cylinder(group, 0, 0.7, 0, 0.04, 0.05, 1.4, 0x493e31);
      cylinder(group, 0, 1.4, 0, 0.26, 0.45, 0.45, 0xccad73);
      cylinder(group, 0, 0.05, 0, 0.25, 0.25, 0.1, 0x493e31);
      break;
    case 'lounger':
      b(0, 0.35, 0, w, 0.2, d, 0xb2a181);
      b(0, 0.55, 0, w - 0.2, 0.18, d - 0.2, 0xe0d5b7);
      b(0, 0.9, -d * 0.32, w - 0.2, 0.7, 0.3, 0xe0d5b7);
      break;
    case 'toilet':
      b(0, 0.3, 0.15, w * 0.65, 0.6, d * 0.6, 0xd9ded1);
      cylinder(group, 0, 0.65, 0.15, w * 0.42, w * 0.4, 0.15, 0xd9ded1);
      b(0, 0.85, -d * 0.3, w, 1.1, d * 0.25, 0xd9ded1);
      break;
    case 'bath':
      b(0, 0.4, 0, w, 0.8, d, 0xb7c7bd);
      b(0, 0.82, 0, w - 0.25, 0.06, d - 0.25, 0x647f7a);
      b(0, 0.85, 0, w - 0.6, 0.04, d - 0.5, 0x88a6a0);
      break;
    case 'sink':
      b(0, 0.5, 0, w, 1, d, 0x7b8c83);
      b(0, 1.04, 0, w + 0.1, 0.1, d, 0xccc5ad);
      cylinder(group, 0, 1.09, 0, 0.32, 0.25, 0.04, 0x596b67);
      break;
    case 'washer':
      b(0, 0.65, 0, w, 1.3, d, 0xb8c0b3);
      for (let x = -w / 2 + 0.7; x < w / 2; x += 1.25) {
        const c = cylinder(group, x, 0.65, d / 2 + 0.03, 0.43, 0.43, 0.1, 0x334e52);
        c.rotation.x = Math.PI / 2;
      }
      break;
    case 'car':
      b(0, 0.6, 0, w, 0.9, d, 0x566b68, 0.18);
      b(0, 1.3, -0.2, w * 0.85, 0.8, d * 0.5, 0x344d52, 0.15);
      b(0, 1.75, -0.2, w * 0.8, 0.12, d * 0.45, 0x687d74);
      for (const x of [-w / 2, w / 2])
        for (const z of [-d * 0.3, d * 0.3]) {
          const c = cylinder(group, x, 0.4, z, 0.48, 0.48, 0.25, 0x20292a);
          c.rotation.z = Math.PI / 2;
        }
      for (const x of [-1.2, 1.2]) b(x, 0.7, d / 2, 0.6, 0.3, 0.1, 0xc4b786);
      break;
    case 'body': {
      const m = b(0, 0.18, 0, 0.65, 0.3, 1.4, 0x7f6a6b);
      m.rotation.y = 0.6;
      sphere(group, 0.3, 0.2, -0.7, 0.25, 0xb38b6b);
      break;
    }
  }
  return group;
}
export function character(character = 0, guard = false, index = 0) {
  const root = new THREE.Group(),
    body = new THREE.Group();
  root.add(body);
  const dark = character === 0 ? 0x202a2e : 0x323944,
    color = guard
      ? [0x95714d, 0x67847c, 0x945959, 0x69788a, 0x9b9761, 0x94748a, 0x6c8964, 0x9a785c][index % 8]
      : dark;
  const hips = new THREE.Group();
  hips.position.y = 0.78;
  body.add(hips);
  const torso = box(body, 0, 1.2, 0, 0.65, 0.8, 0.4, color, 0.12);
  if (!guard) {
    const coat = cylinder(body, 0, 0.85, 0, 0.32, character === 0 ? 0.48 : 0.38, 0.8, dark);
    coat.scale.z = 0.7;
    box(body, 0, 1.22, 0.23, 0.03, 0.7, 0.025, 0x67726d);
    box(body, 0, 1.4, 0.25, 0.22, 0.12, 0.05, character === 0 ? 0xa38654 : 0x8c6269);
  }
  const head = new THREE.Group();
  head.position.y = 1.88;
  body.add(head);
  sphere(head, 0, 0, 0, 0.32, guard ? 0x9d795b : dark, 1, 1.17, 1);
  if (guard) {
    sphere(head, 0, 0.16, -0.03, 0.31, index % 2 ? 0x453d36 : 0x292d2d, 1, 0.7, 1);
    box(head, 0, -0.02, 0.275, 0.42, 0.27, 0.08, 0xc5a17e);
  } else {
    const mask = sphere(
      head,
      0,
      -0.01,
      0.24,
      0.24,
      character === 0 ? 0xddd9bf : 0xc7c6bd,
      0.85,
      character === 0 ? 1.3 : 1.05,
      0.4,
    );
    for (const x of [-0.09, 0.09]) {
      const eye = box(head, x, 0.035, 0.337, 0.1, 0.055, 0.03, 0x192529);
      eye.rotation.z = x > 0 ? -0.2 : 0.2;
    }
    box(head, 0, -0.15, 0.34, character === 0 ? 0.065 : 0.14, 0.09, 0.025, 0x273331);
  }
  const arms = [],
    legs = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.42, 1.5, 0);
    body.add(arm);
    box(arm, 0, -0.24, 0, 0.22, 0.52, 0.24, color, 0.08);
    box(arm, 0, -0.54, 0.04, 0.19, 0.2, 0.21, guard ? 0xb18b6d : 0x1c2527, 0.06);
    arms.push(arm);
    const leg = new THREE.Group();
    leg.position.set(side * 0.19, 0.84, 0);
    body.add(leg);
    box(leg, 0, -0.3, 0, 0.25, 0.65, 0.27, guard ? 0x374245 : 0x1d272b, 0.07);
    box(leg, 0, -0.64, 0.08, 0.27, 0.17, 0.4, 0x182326);
    legs.push(leg);
  }
  let weapon = null;
  if (guard) {
    weapon = new THREE.Group();
    arms[1].add(weapon);
    if (index % 3 === 0) {
      const pan = cylinder(weapon, 0, -0.85, 0.1, 0.26, 0.26, 0.08, 0x596663);
      pan.rotation.x = Math.PI / 2;
      box(weapon, 0, -0.59, 0.1, 0.065, 0.4, 0.07, 0x786747);
    } else {
      const bat = cylinder(weapon, 0, -0.75, 0.1, 0.07, 0.13, 0.8, 0x9a8057);
      bat.rotation.x = -0.3;
    }
  }
  const torch = new THREE.SpotLight(
    guard ? 0xf7e2a2 : 0xe3f5e1,
    guard ? 14 : 24,
    12,
    0.43,
    0.7,
    1.5,
  );
  torch.position.set(0.3, 1.35, 0.25);
  torch.target.position.set(0.3, 0.3, 8);
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(2, 8, 24, 1, true),
    new THREE.MeshBasicMaterial({
      color: guard ? 0xe6cb80 : 0x94d6bd,
      transparent: true,
      opacity: 0.035,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  cone.rotation.x = -Math.PI / 2;
  cone.position.set(0.3, 0.28, 4.1);
  root.add(cone);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.48, 0.55, 32),
    new THREE.MeshBasicMaterial({
      color: guard ? 0xd6a564 : character === 0 ? 0xd2ad6c : 0x87c5bc,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.045;
  root.add(ring);
  let drink = null;
  if (guard) {
    drink = new THREE.Group();
    cylinder(drink, 0, -0.64, 0.08, 0.085, 0.07, 0.2, 0xe7d5ad);
    cylinder(drink, 0, -0.53, 0.08, 0.065, 0.065, 0.015, 0xb57138);
    arms[1].add(drink);
    batchStatic(drink);
    drink.visible = false;
  }
  if (weapon) batchStatic(weapon);
  for (const part of [...arms, ...legs, head])
    batchStatic(part, new Set([weapon, drink].filter(Boolean)));
  batchStatic(body, new Set([...arms, ...legs, head]));
  return { root, body, head, arms, legs, torch, cone, ring, phase: 0, torso, weapon, drink };
}
export class GameScene {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x010205);
    this.scene.fog = new THREE.FogExp2(0x010205, 0.012);
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    container.appendChild(this.renderer.domElement);
    this.firstPerson = false;
    this.lookYaw = 0;
    this.lookPitch = 0;
    this.fpsCamera = new THREE.PerspectiveCamera(75, 1, 0.06, 95);
    this.fixtureMeshes = [];
    this.floorLabels = [];
    this.ceilings = [];
    this.camera = new THREE.OrthographicCamera(-14, 14, 10, -10, 0.1, 100);
    this.camera.position.set(0, 27, 17);
    this.camera.lookAt(0, 0, 0);
    this.observerFloor = 1;
    this.observerLight = new THREE.HemisphereLight(0xe1eeed, 0x899d9b, 0);
    this.scene.add(this.observerLight);
    this.throwAim = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        color: 0xffdf84,
        depthTest: false,
        transparent: true,
        opacity: 0.95,
      }),
    );
    this.throwAim.renderOrder = 20;
    this.throwAim.visible = false;
    this.scene.add(this.throwAim);
    this.throwLanding = new THREE.Mesh(
      new THREE.RingGeometry(0.22, 0.32, 24),
      new THREE.MeshBasicMaterial({ color: 0xffdf84, depthTest: false, side: THREE.DoubleSide }),
    );
    this.throwLanding.rotation.x = -Math.PI / 2;
    this.throwLanding.visible = false;
    this.throwLanding.renderOrder = 20;
    this.scene.add(this.throwLanding);
    this.target = new THREE.Vector3(-12, 0, -5);
    this.ambientLight = new THREE.HemisphereLight(0x748fa1, 0x080b10, 0.16);
    this.scene.add(this.ambientLight);
    const moon = new THREE.DirectionalLight(0x7596ac, 0.2);
    moon.position.set(-12, 28, -12);
    moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024);
    Object.assign(moon.shadow.camera, {
      left: -30,
      right: 30,
      top: 30,
      bottom: -30,
      near: 1,
      far: 70,
    });
    moon.shadow.bias = -0.001;
    moon.shadow.normalBias = 0.03;
    this.scene.add(moon);
    this.moon = moon;
    this.sharedBeams = Array.from({ length: 4 }, () => {
      const light = new THREE.SpotLight(0xe7e3ba, 0, 12, 0.43, 0.7, 1.5);
      this.scene.add(light, light.target);
      return light;
    });
    this.roomMeshes = new Map();
    this.wallGroups = [];
    this.bodyMeshes = new Map();
    this.exterior = new THREE.Group();
    this.scene.add(this.exterior);
    this.roomMeshes.set('outside', this.exterior);
    this.floors = [];
    this.doorMeshes = new Map();
    this.cabinetMeshes = new Map();
    this.fpsWallFaces = [];
    this.doorGroups = new Map();
    this.lightMeshes = new Map();
    this.windowGlass = new Map();
    this.windowPools = new Map();
    this.gardenFixtures = [];
    this.gardenLights = [];
    this.wallMeshes = [];
    this.actors = new Map();
    this.effects = [];
    this.projectiles = new Map();
    this.floor = 1;
    this.preview = true;
    this.elapsed = 0;
    this.raycaster = new THREE.Raycaster();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const ground = box(this.scene, 0, -0.45, 0, 110, 0.4, 110, 0x233b39);
    ground.receiveShadow = true;
    this.ground = ground;
    for (const f of FLOOR_IDS) this.buildFloor(f);
    // Outside the cutaway: hedges, paving stones, fence and moonlit pines.
    const exterior = this.exterior;
    for (let x = -37; x < -25; x += 1.2) box(exterior, x, 0.02, -1, 1, 0.08, 2.4, 0x555d5c);
    box(exterior, 0, 0.08, 18, 8, 0.16, 4, 0x5c6060);
    box(exterior, TERRACE.x, 0.02, TERRACE.z, TERRACE.w, 0.14, TERRACE.d, 0x9d8f74);
    for (let x = -23; x < 22; x += 1.2) box(exterior, x, 0.1, -22, 0.025, 0.01, 11.8, 0x756b59, 0);
    box(exterior, POOL.x, -0.12, POOL.z, POOL.w + 1.2, 0.25, POOL.d + 1.2, 0xb6c1b0);
    const water = box(exterior, POOL.x, 0.025, POOL.z, POOL.w, 0.035, POOL.d, 0x32869b, 0);
    water.material = new THREE.MeshStandardMaterial({
      color: 0x3c9fb4,
      roughness: 0.22,
      metalness: 0.18,
      emissive: 0x0d3040,
      emissiveIntensity: 0.15,
    });
    for (let x = POOL.x - POOL.w / 2 + 1; x < POOL.x + POOL.w / 2; x += 2)
      box(exterior, x, 0.05, POOL.z, 0.025, 0.01, POOL.d - 0.4, 0x77b9bd, 0);
    const poolName = label('PISCINE');
    poolName.position.set(POOL.x, 0.08, POOL.z);
    exterior.add(poolName);
    const terraceName = label('TERRASSE · SOIRÉE');
    terraceName.position.set(-3, 0.14, -25.5);
    exterior.add(terraceName);
    for (let i = 0; i < 25; i++) {
      const x = -36 + ((i * 17) % 73),
        z = i % 2 ? 26 : -42;
      const tree = new THREE.Group();
      tree.position.set(x, 0, z);
      cylinder(tree, 0, 1.3, 0, 0.15, 0.22, 2.6, 0x4c4b3c);
      for (let j = 0; j < 3; j++) {
        const c = new THREE.Mesh(new THREE.ConeGeometry(1.8 - j * 0.35, 3, 7), material(0x2c4d47));
        c.position.y = 2.6 + j;
        tree.add(c);
      }
      exterior.add(tree);
    }
    for (let i = -37; i <= 37; i += 2.5) {
      box(exterior, i, 0.5, 27.8, 0.12, 1.1, 0.12, 0x52615a);
      box(exterior, i, 0.5, -42.8, 0.12, 1.1, 0.12, 0x52615a);
    }
    for (const z of [-42.8, 27.8])
      for (const y of [0.3, 0.8]) box(exterior, 0, y, z, 75, 0.08, 0.08, 0x687468);
    for (const p of gardenLamps) {
      cylinder(exterior, p.x, 0.32, p.z, 0.055, 0.075, 0.64, 0x34413f);
      const glass = cylinder(exterior, p.x, 0.68, p.z, 0.12, 0.12, 0.2, 0xf9e0a8);
      glass.material = new THREE.MeshStandardMaterial({
        color: 0xf6dda8,
        emissive: 0xffcb70,
        emissiveIntensity: 1,
      });
      cylinder(exterior, p.x, 0.82, p.z, 0.17, 0.15, 0.06, 0x34413f);
      const pool = lightPool(exterior, p.x, p.z, 7, 7);
      this.gardenFixtures.push({ glass, pool });
    }
    for (const [x, z] of [
      [-34, -1],
      [-28, -1],
      [-29, 10],
      [0, -22],
      [21, -22],
      [29, 9],
      [5, -39],
    ]) {
      const light = new THREE.PointLight(0xffd095, 18, 16, 2);
      light.userData.poweredIntensity = z < -16 ? 85 : 38;
      light.position.set(x, 2.5, z);
      exterior.add(light);
      this.gardenLights.push(light);
    }
    for (const x of [-21, -9, 9, 21]) {
      box(exterior, x, 2.7, -16.3, 0.8, 0.35, 0.5, 0x29312e);
      const lens = box(exterior, x, 2.65, -16.58, 0.65, 0.2, 0.08, 0xffddaa);
      lens.material = new THREE.MeshStandardMaterial({ color: 0xffddaa, emissive: 0xffc477 });
      this.fixtureMeshes.push({ mesh: lens, room: 'outside' });
      const flood = new THREE.PointLight(0xffd6a2, 65, 13, 2);
      flood.position.set(x, 2.5, -17);
      flood.userData.poweredIntensity = 65;
      exterior.add(flood);
      this.gardenLights.push(flood);
    }
    box(exterior, -12, 0.6, -22, 0.9, 1.2, 0.6, 0x202924);
    for (const y of [0.35, 0.85]) sphere(exterior, -12, y, -21.68, 0.2, 0x101714, 1, 1, 0.15);
    for (const z of [-20, -26]) {
      const points = [];
      for (let i = 0; i <= 24; i++) {
        const x = -23 + (i * 46) / 24,
          y = 3.8 - 0.6 * Math.sin((Math.PI * i) / 24);
        points.push(new THREE.Vector3(x, y, z));
        const bulb = sphere(exterior, x, y - 0.12, z, 0.09, 0xffd99a);
        bulb.material = new THREE.MeshStandardMaterial({
          color: 0xffd99a,
          emissive: 0xffbc60,
          emissiveIntensity: 1,
        });
        this.fixtureMeshes.push({ mesh: bulb, room: 'outside' });
      }
      exterior.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(points),
          new THREE.LineBasicMaterial({ color: 0x34342b }),
        ),
      );
      for (const x of [-23, 23]) cylinder(exterior, x, 1.9, z, 0.06, 0.06, 3.8, 0x34342b);
    }
    const porchLight = new THREE.PointLight(0xefbe7c, 14, 10, 2);
    porchLight.userData.poweredIntensity = 14;
    porchLight.position.set(0, 2.2, 17);
    exterior.add(porchLight);
    this.gardenLights.push(porchLight);
    box(exterior, -25.25, 2, -0.1, 0.22, 0.3, 0.25, 0xc4aa6b);
    const poolLight = new THREE.PointLight(0x69d4e8, 24, 16, 2);
    poolLight.userData.poweredIntensity = 24;
    poolLight.position.set(POOL.x, 1.5, POOL.z);
    exterior.add(poolLight);
    this.gardenLights.push(poolLight);
    for (const d of doors.filter((d) => d.window)) {
      const n = windowNormal(d),
        pool = lightPool(
          exterior,
          d.x + n.x * 1.8,
          d.z + n.z * 1.8,
          d.axis === 'z' ? 4 : 3.2,
          d.axis === 'z' ? 3.2 : 4,
        );
      this.windowPools.set(d.id, { mesh: pool, room: d.room });
    }
    this.windowLights = Array.from({ length: 2 }, () => {
      const light = new THREE.PointLight(0xffce88, 0, 5, 2);
      this.scene.add(light);
      return light;
    });
    batchStatic(exterior, new Set(this.gardenFixtures.map((f) => f.glass)));
    this.bloodMesh = new THREE.InstancedMesh(
      new THREE.CircleGeometry(1, 10),
      new THREE.MeshBasicMaterial({
        color: 0x8f171e,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
      5000,
    );
    this.bloodMesh.count = 0;
    this.scene.add(this.bloodMesh);
    this.previewActors = [character(0), character(1), character(0, true, 0), character(0, true, 1)];
    this.previewActors.forEach((a, i) => {
      a.root.position.set(-12 + i * 1.7, 0, i < 2 ? -4 : -8);
      a.root.rotation.y = 0.4;
      this.floors[1].add(a.root);
    });
    // Keep a fixed light budget: revealing rooms must never change shader light counts.
    this.roomAmbientMaterials = new Map();
    for (const [id, group] of this.roomMeshes) {
      if (id === 'outside') continue;
      // Stable interior bounce light on the room-facing side of each opaque wall.
      // Exterior faces stay dark; no point light needs to turn on at a window.
      const faces = new THREE.Group();
      group.add(faces);
      this.fpsWallFaces.push(faces);
      for (const w of walls.filter((w) => !w.railing && (w.a === id || w.b === id))) {
        const dx = w.axis === 'z' ? 0.13 : 0,
          dz = w.axis === 'x' ? 0.13 : 0;
        const sign = regionAt(w.f, w.x + dx, w.z + dz) === id ? 1 : -1;
        const face = box(
          faces,
          w.x + dx * sign,
          1.56,
          w.z + dz * sign,
          w.axis === 'z' ? 0.012 : w.w,
          3.12,
          w.axis === 'x' ? 0.012 : w.d,
          palettes[w.f % palettes.length].wall,
          0,
        );
        face.castShadow = false;
      }
      batchStatic(faces);
      const copies = new Map();
      group.traverse((mesh) => {
        if (!mesh.isMesh || this.fixtureMeshes.some((f) => f.mesh === mesh)) return;
        const clone = (original) => {
          if (!original.emissive || !original.color) return original;
          if (!copies.has(original)) {
            const copy = original.clone();
            copy.emissive.copy(copy.color);
            copy.emissiveIntensity = 0.45;
            copies.set(original, copy);
          }
          return copies.get(original);
        };
        mesh.material = Array.isArray(mesh.material)
          ? mesh.material.map(clone)
          : clone(mesh.material);
      });
      this.roomAmbientMaterials.set(id, [...copies.values()]);
    }
    this.localLightSources = [...this.lightMeshes.values(), ...this.gardenLights];
    for (const light of this.localLightSources) {
      light.userData.region =
        [...this.lightMeshes].find(([, l]) => l === light)?.[0].split(':')[0] || 'outside';
      light.userData.floor =
        light.parent === this.exterior
          ? 1
          : FLOOR_IDS.find((f) => {
              let parent = light.parent;
              while (parent) {
                if (parent === this.floors[f]) return true;
                parent = parent.parent;
              }
              return false;
            });
      this.scene.updateMatrixWorld(true);
      const position = light.getWorldPosition(new THREE.Vector3());
      light.removeFromParent();
      light.position.copy(position);
    }
    this.localLights = Array.from({ length: 8 }, () => {
      const light = new THREE.PointLight(0xffffff, 0);
      this.scene.add(light);
      return light;
    });
    this.observerZoomFactor = 1;
    this.container.addEventListener(
      'wheel',
      (e) => {
        if (!this.lastState?.observer) return;
        e.preventDefault();
        this.observerZoomFactor = THREE.MathUtils.clamp(
          this.observerZoomFactor * Math.exp(-e.deltaY * 0.0015),
          0.7,
          3,
        );
      },
      { passive: false },
    );
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }
  buildFloor(f) {
    const group = new THREE.Group();
    this.floors[f] = group;
    group.position.y = (f - 1) * FLOOR_HEIGHT;
    this.scene.add(group);
    group.visible = f === 1;
    for (const part of cutRects(houseFloorParts(f), f === 2 ? stairHoles : [])) {
      const base = box(group, part.x, -0.18, part.z, part.w, 0.35, part.d, 0x010205);
      base.material = new THREE.MeshBasicMaterial({ color: 0x010205 });
    }
    const hall = new THREE.Group();
    group.add(hall);
    this.roomMeshes.set(`hall${f}`, hall);
    for (const part of cutRects(hallFloorParts(f), f === 2 ? stairHoles : [])) {
      box(hall, part.x, 0.005, part.z, part.w, 0.04, part.d, 0x85765c);
      for (let x = part.x - part.w / 2 + 0.5; x < part.x + part.w / 2; x += 1.5)
        box(hall, x, 0.035, part.z, 0.02, 0.005, part.d, 0x574e40, 0);
    }
    for (const [index, x, z] of f === 1
      ? [
          [0, 3, 8],
          [1, 14, -2],
        ]
      : [
          [0, 2, 0],
          [1, 3, -10],
        ]) {
      const lamp = new THREE.PointLight(0xffdab2, 38, 30, 2);
      lamp.position.set(x, 3, z);
      hall.add(lamp);
      this.lightMeshes.set(`hall${f}-${index}`, lamp);
      cylinder(hall, x, 2.8, z, 0.35, 0.45, 0.12, 0xeadab7);
    }
    if (f === 2) {
      const text = label('VIDE SUR LE HALL');
      text.position.set(ATRIUM.x, -0.12, ATRIUM.z);
      hall.add(text);
      this.floorLabels.push(text);
    }
    for (const r of rooms.filter((r) => r.f === f)) {
      const roomGroup = new THREE.Group();
      group.add(roomGroup);
      this.roomMeshes.set(r.id, roomGroup);
      const palette = palettes[r.style];
      for (const part of cutRects(roomFloorParts(r), f === 2 ? stairHoles : [])) {
        box(roomGroup, part.x, -0.015, part.z, part.w - 0.1, 0.1, part.d - 0.1, palette.floor, 0);
        for (
          let x = part.x - part.w / 2 + 0.5;
          x < part.x + part.w / 2;
          x += r.name.includes('bains') ? 1 : 1.2
        )
          box(roomGroup, x, 0.04, part.z, 0.018, 0.008, part.d - 0.1, 0x323e38, 0);
        if (r.name.includes('bains'))
          for (let z = part.z - part.d / 2 + 0.5; z < part.z + part.d / 2; z++)
            box(roomGroup, part.x, 0.045, z, part.w - 0.1, 0.008, 0.018, 0x455952, 0);
      }
      const text = label(r.name.toUpperCase());
      this.floorLabels.push(text);
      text.position.set(r.nav.x, 0.07, r.nav.z);
      roomGroup.add(text);
      let index = 0;
      const candidates = walls
        .filter((w) => w.f === f && (w.a === r.id || w.b === r.id) && Math.max(w.w, w.d) > 2.5)
        .sort((a, b) => Math.max(b.w, b.d) - Math.max(a.w, a.d));
      const selected = [];
      for (const w of candidates) {
        if (selected.some((o) => Math.hypot(w.x - o.x, w.z - o.z) < 4)) continue;
        selected.push(w);
        if (selected.length >= (r.area > 250 ? 4 : 2)) break;
      }
      for (const w of selected) {
        const dx = w.axis === 'z' ? 0.4 : 0,
          dz = w.axis === 'x' ? 0.4 : 0;
        const sign = regionAt(f, w.x + dx, w.z + dz) === r.id ? 1 : -1;
        const x = w.x + dx * sign,
          z = w.z + dz * sign;
        const glow = new THREE.PointLight(0xffdab2, 65, Math.max(r.w, r.d) + 8, 2);
        glow.userData.roomId = r.id;
        glow.position.set(x, 2.05, z);
        const plate = box(
          roomGroup,
          x,
          2.05,
          z,
          w.axis === 'z' ? 0.12 : 0.5,
          0.62,
          w.axis === 'z' ? 0.5 : 0.12,
          0x343c35,
        );
        const shade = box(
          roomGroup,
          x + dx * sign * 0.3,
          2.05,
          z + dz * sign * 0.3,
          0.34,
          0.42,
          0.34,
          0xffe3b0,
        );
        shade.material = new THREE.MeshStandardMaterial({
          color: 0xffe3b0,
          emissive: 0xffb65b,
          emissiveIntensity: 1,
        });
        this.fixtureMeshes.push({ mesh: shade, room: r.id });
        roomGroup.add(glow);
        this.lightMeshes.set(index++ ? `${r.id}:${index}` : r.id, glow);
      }
      for (const part of cutRects(r.parts, f === 1 ? [ATRIUM, ...stairHoles] : [])) {
        const ceiling = box(roomGroup, part.x, 3.16, part.z, part.w, 0.12, part.d, 0x26302b);
        ceiling.visible = false;
        this.ceilings.push(ceiling);
      }
    }
    for (const w of walls.filter((w) => w.f === f)) {
      const wallGroup = new THREE.Group();
      group.add(wallGroup);
      this.wallGroups.push({ ...w, group: wallGroup });
      if (w.railing) {
        box(wallGroup, w.x, 0.85, w.z, w.w, 0.08, w.d, 0x9eaa9e, 0.01);
        const n = Math.ceil(Math.max(w.w, w.d));
        for (let i = 0; i <= n; i++)
          box(
            wallGroup,
            w.x + (w.w > w.d ? (i / n - 0.5) * w.w : 0),
            0.42,
            w.z + (w.d > w.w ? (i / n - 0.5) * w.d : 0),
            0.06,
            0.8,
            0.06,
            0x647c79,
            0,
          );
        continue;
      }
      box(wallGroup, w.x, 0.38, w.z, w.w, 0.75, w.d, 0x7d8c7b, 0.02);
      const upper = box(wallGroup, w.x, 1.55, w.z, w.w, 1.6, w.d, 0x778c80, 0.02);
      upper.material = upper.material.clone();
      upper.material.transparent = true;
      upper.material.opacity = 0.18;
      wallGroup.userData.upper = upper;
      upper.castShadow = false;
      upper.material.depthWrite = false;
      this.wallMeshes.push(upper);
      box(wallGroup, w.x, 0.79, w.z, w.w + 0.03, 0.09, w.d + 0.03, 0xa7a68c, 0.01);
    }
    for (const d of doors.filter((d) => d.f === f)) {
      const doorGroup = new THREE.Group();
      group.add(doorGroup);
      this.doorGroups.set(d.id, doorGroup);
      const lintel = box(
        doorGroup,
        d.x,
        d.patio ? 2.825 : 2.925,
        d.z,
        d.axis === 'x' ? d.w : 0.24,
        d.patio ? 0.65 : 0.45,
        d.axis === 'z' ? d.d : 0.24,
        0x778c80,
        0,
      );
      lintel.visible = !d.window;
      const pivot = new THREE.Group();
      const width = d.axis === 'z' ? d.d : d.w;
      pivot.position.set(
        d.axis === 'z' ? d.x : d.x - width / 2,
        0,
        d.axis === 'z' ? d.z + width / 2 : d.z,
      );
      if (!d.patio) pivot.scale.x = width / 2;
      pivot.rotation.y = d.axis === 'z' ? Math.PI / 2 : 0;
      pivot.userData.baseAngle = pivot.rotation.y;
      doorGroup.add(pivot);
      if (d.patio) {
        const other = new THREE.Group();
        other.position.set(d.x + width / 2, 0, d.z);
        other.rotation.y = Math.PI;
        doorGroup.add(other);
        pivot.userData.doublePivot = other;
        for (const leaf of [pivot, other]) {
          const glass = box(leaf, 1, 1.25, 0, 1.9, 2.4, 0.06, 0x8ba9aa);
          glass.material = new THREE.MeshStandardMaterial({
            color: 0x749b9b,
            roughness: 0.2,
            transparent: true,
            opacity: 0.45,
            depthWrite: false,
          });
          for (const x of [0.03, 1.97]) box(leaf, x, 1.25, 0.02, 0.08, 2.5, 0.12, 0xc4bba0);
          for (const y of [0.05, 1.25, 2.5]) box(leaf, 1, y, 0.02, 2, 0.08, 0.12, 0xc4bba0);
        }
      } else if (d.window) {
        pivot.userData.sliding = true;
        const frame = new THREE.Group();
        frame.position.copy(pivot.position);
        frame.rotation.copy(pivot.rotation);
        doorGroup.add(frame);
        const pane = box(pivot, 1, 1.5, 0, 1.92, 1.3, 0.045, 0x9cbbb8);
        pane.material = new THREE.MeshStandardMaterial({
          color: 0xb6d5ce,
          emissive: 0xffd195,
          emissiveIntensity: 0.65,
          roughness: 0.18,
          transparent: true,
          opacity: 0.42,
          depthWrite: false,
        });
        this.windowGlass.set(d.id, { mesh: pane, room: d.room });
        const upperPane = box(frame, 1, 2.85, -0.06, 1.92, 1.3, 0.045, 0x9cbbb8);
        upperPane.material = pane.material;
        for (const x of [0, 2]) box(frame, x, 2.15, 0, 0.1, 2.82, 0.16, 0xb8af96);
        for (const y of [0.8, 2.2, 3.5]) box(frame, 1, y, -0.03, 2.08, 0.08, 0.16, 0xb8af96);
        for (const x of [0.06, 1.94]) box(pivot, x, 1.5, 0.05, 0.065, 1.3, 0.08, 0xb8af96);
        for (const y of [0.85, 2.15]) box(pivot, 1, y, 0.05, 1.94, 0.065, 0.08, 0xb8af96);
        box(pivot, 1, 0.95, 0.12, 0.3, 0.06, 0.08, 0xc2a166);
        const base = box(
          doorGroup,
          d.x,
          0.35,
          d.z,
          d.axis === 'z' ? 0.24 : 2.08,
          0.7,
          d.axis === 'z' ? 2.08 : 0.24,
          0x7d8c7b,
        );
        box(frame, 1, 0.74, 0.1, 2.16, 0.12, 0.32, 0xc0b69a);
      } else {
        const leaf = box(pivot, 1, 1.35, 0, 1.94, 2.7, 0.13, 0x6a5440);
        leaf.material = leaf.material.clone();
        leaf.material.transparent = false;
        leaf.material.opacity = 1;
        box(pivot, 1.75, 1.1, 0.12, 0.12, 0.12, 0.14, 0xc2a166);
        for (const side of [-1, 1]) {
          box(pivot, 1.7, 1.02, side * 0.085, 0.18, 0.28, 0.025, 0xc2a166);
          const hole = box(pivot, 1.7, 1.02, side * 0.102, 0.045, 0.09, 0.005, 0x010101, 0);
          hole.material = new THREE.MeshBasicMaterial({ color: 0x010101 });
        }
        for (const side of [-1, 1])
          box(
            doorGroup,
            d.x + (d.axis === 'z' ? 0 : side * (width / 2 + 0.05)),
            1.4,
            d.z + (d.axis === 'z' ? side * (width / 2 + 0.05) : 0),
            0.12,
            2.8,
            0.25,
            0xa59a7e,
          );
      }
      this.doorMeshes.set(d.id, pivot);
    }
    for (const p of props.filter((p) => p.f === f && p.type !== 'pool')) {
      const mesh = furniture(p);
      (this.roomMeshes.get(p.room) || group).add(mesh);
      if (mesh.userData.cabinetLeaves) this.cabinetMeshes.set(p.id, mesh);
    }
    for (const s of stairs.filter((s) => s.f === f && s.to === 2)) {
      const length = Math.abs(s.landing.z - s.z),
        dir = Math.sign(s.landing.z - s.z);
      for (let j = 0; j < 16; j++)
        box(
          hall,
          s.x,
          ((j + 0.5) * FLOOR_HEIGHT) / 16,
          s.z + (dir * (j + 0.5) * length) / 16,
          2.15,
          FLOOR_HEIGHT / 16,
          length / 16,
          0x7a8276,
          0,
        );
      for (const side of [-1, 1]) {
        for (let j = 0; j <= 16; j++)
          cylinder(
            hall,
            s.x + side * 1.08,
            (j * FLOOR_HEIGHT) / 16 + 0.48,
            s.z + (dir * j * length) / 16,
            0.035,
            0.035,
            0.96,
            0x52645d,
          );
        const rail = new THREE.Mesh(
          new THREE.CylinderGeometry(0.045, 0.045, Math.hypot(length, FLOOR_HEIGHT), 8),
          material(0x718376),
        );
        rail.position.set(s.x + side * 1.08, FLOOR_HEIGHT / 2 + 0.96, (s.z + s.landing.z) / 2);
        rail.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          new THREE.Vector3(0, FLOOR_HEIGHT, dir * length).normalize(),
        );
        hall.add(rail);
      }
    }
    for (const d of devices.filter((d) => d.f === f)) {
      const deviceGroup = this.roomMeshes.get(d.room) || group;
      if (d.type === 'light') {
        const wall = walls
          .filter((w) => w.f === f && (w.a === d.room || w.b === d.room))
          .map((w) => ({
            w,
            x: Math.max(w.x - w.w / 2, Math.min(w.x + w.w / 2, d.x)),
            z: Math.max(w.z - w.d / 2, Math.min(w.z + w.d / 2, d.z)),
          }))
          .sort((a, b) => Math.hypot(a.x - d.x, a.z - d.z) - Math.hypot(b.x - d.x, b.z - d.z))[0];
        if (wall) {
          const dx = Math.sign(d.x - wall.x) * 0.14,
            dz = Math.sign(d.z - wall.z) * 0.14;
          box(
            deviceGroup,
            wall.x + dx,
            1.2,
            wall.z + dz,
            wall.w.axis === 'z' ? 0.1 : 0.22,
            0.3,
            wall.w.axis === 'z' ? 0.22 : 0.1,
            0xe8dec0,
          );
        }
        continue;
      }
      if (d.type === 'bottles') {
        for (let j = 0; j < 3; j++) {
          cylinder(deviceGroup, d.x + (j - 1) * 0.16, 0.28, d.z, 0.045, 0.07, 0.4, 0x6a9769);
          cylinder(deviceGroup, d.x + (j - 1) * 0.16, 0.52, d.z, 0.026, 0.026, 0.12, 0xa7b290);
        }
      }
      if (d.type === 'alarm') {
        box(deviceGroup, d.x, 0.2, d.z, 0.5, 0.4, 0.3, 0xae6e56);
        sphere(deviceGroup, d.x, 0.24, d.z + 0.16, 0.14, 0xe2d2aa, 1, 1, 0.2);
      }
      if (d.type === 'breaker') box(deviceGroup, d.x, 1, d.z, 0.65, 1.4, 0.25, 0x5c7269);
    }
    for (const r of rooms.filter((r) => r.f === f))
      batchStatic(
        this.roomMeshes.get(r.id),
        new Set([
          ...this.ceilings,
          ...this.cabinetMeshes.values(),
          ...this.fixtureMeshes.map((f) => f.mesh),
        ]),
      );
    batchStatic(hall);
    for (const w of this.wallGroups.filter((w) => w.f === f)) batchStatic(w.group);
    batchStatic(
      group,
      new Set([
        ...this.doorGroups.values(),
        ...this.roomMeshes.values(),
        ...this.wallGroups.map((w) => w.group),
      ]),
    );
  }
  resize() {
    const w = this.container.clientWidth || innerWidth,
      h = this.container.clientHeight || innerHeight;
    this.renderer.setSize(w, h);
    this.fpsCamera.aspect = w / h;
    this.fpsCamera.updateProjectionMatrix();
    const aspect = w / h,
      half = 10;
    this.camera.left = -half * aspect;
    this.camera.right = half * aspect;
    this.camera.top = half;
    this.camera.bottom = -half;
    this.camera.updateProjectionMatrix();
  }
  aim(clientX, clientY, player) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.raycaster.setFromCamera(
      new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        (-(clientY - rect.top) / rect.height) * 2 + 1,
      ),
      this.camera,
    );
    const point = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(this.groundPlane, point);
    return Math.atan2(point.x - player.x, point.z - player.z);
  }
  setQuality(low) {
    this.lowQuality = low;
    this.adapted = false;
    this.slowSeconds = 0;
    this.renderer.setPixelRatio(low ? 0.8 : Math.min(devicePixelRatio, 1.25));
    this.renderer.shadowMap.enabled = !low;
    this.resize();
  }
  adaptQuality(fps) {
    if (this.lowQuality || this.adapted) return;
    this.slowSeconds = fps < 32 ? (this.slowSeconds || 0) + 1 : 0;
    if (this.slowSeconds >= 3) {
      this.adapted = true;
      this.renderer.setPixelRatio(Math.min(devicePixelRatio, 0.9));
      this.renderer.shadowMap.enabled = false;
      this.resize();
    }
  }
  animateActor(a, p, dt, t, guard = false) {
    if (!a.ambientMaterials) {
      const copies = new Map();
      a.root.traverse((m) => {
        if (!m.isMesh || !m.material.emissive) return;
        const original = m.material;
        if (!copies.has(original)) {
          const copy = original.clone();
          copy.emissive.copy(copy.color);
          copies.set(original, copy);
        }
        m.material = copies.get(original);
      });
      a.ambientMaterials = [...copies.values()];
    }
    const lit = illuminationAt(p, this.lastState?.lights, this.lastState?.power) !== 0;
    for (const material of a.ambientMaterials) material.emissiveIntensity = lit ? 0.2 : 0;
    const target = visualPose(p);
    const previous = a.root.position.clone();
    a.root.position.lerp(target, Math.min(1, dt * 16));
    const speed = previous.distanceTo(a.root.position) / Math.max(dt, 0.001);
    const delta = Math.atan2(
      Math.sin(p.angle - a.root.rotation.y),
      Math.cos(p.angle - a.root.rotation.y),
    );
    if (guard) a.root.rotation.y = p.angle;
    else a.root.rotation.y += delta * Math.min(1, dt * 15);
    a.phase += dt * (speed > 3 ? 13 : 8);
    const captured = p.status === 'captured',
      eliminated = p.status === 'eliminated',
      crouch = p.crouching;
    const gait =
      speed > 0.1 ? Math.sin(a.phase) * Math.min(0.65, speed * 0.2) : Math.sin(t * 2) * 0.015;
    a.legs[0].rotation.x = gait;
    a.legs[1].rotation.x = -gait;
    a.arms[0].rotation.x = -gait * 0.8;
    a.arms[1].rotation.x = gait * 0.8;
    a.head.rotation.x = 0;
    if (a.drink) a.drink.visible = p.state === 'party' && p.socialStyle === 'drink' && speed < 0.25;
    if (guard && p.state === 'party' && speed < 0.25) {
      const beat = t * 1.8 + Number(p.id.slice(1)) * 1.7;
      a.arms[0].rotation.x = -0.4 + Math.sin(beat) * 0.25;
      a.arms[1].rotation.x = -0.7 + Math.sin(beat * 0.7) * 0.3;
      a.head.rotation.y = Math.sin(beat * 0.35) * 0.14;
      a.body.rotation.y = Math.sin(beat * 0.5) * 0.04;
      if (p.socialStyle === 'listen') {
        a.arms[0].rotation.x = -0.12;
        a.arms[1].rotation.x = -0.15;
        a.head.rotation.x = Math.sin(beat * 0.65) * 0.09;
      } else if (p.socialStyle === 'drink') {
        a.arms[1].rotation.x = -1.6 + Math.sin(beat * 0.5) * 0.15;
        a.head.rotation.x = -0.08;
      } else if (p.socialStyle === 'dance') {
        a.body.rotation.z = Math.sin(beat) * 0.055;
        a.arms[0].rotation.x = -0.8 + Math.sin(beat) * 0.3;
        a.arms[1].rotation.x = -0.8 - Math.sin(beat) * 0.3;
      }
    } else {
      a.head.rotation.y = 0;
      a.body.rotation.y = 0;
    }
    if (captured) {
      a.arms[0].rotation.x = -1.1;
      a.arms[1].rotation.x = -1.1;
    }
    if (p.interactUntil > (this.lastState?.time || 0)) {
      a.arms[1].rotation.x = -1.2 + Math.sin(t * 15) * 0.2;
    }
    if (p.attackUntil > (this.lastState?.time || 0))
      a.arms[1].rotation.x = -1.8 + Math.sin(t * 30) * 0.4;
    if (p.dragging) {
      a.arms[0].rotation.x = -1.2;
      a.arms[1].rotation.x = -1.2;
    }
    if (p.climb) {
      a.body.position.y = 0;
      a.arms[0].rotation.x = -1.7;
      a.arms[1].rotation.x = -1.7;
    }
    const end = this.lastState?.phase === 'ended';
    if (end && this.lastState.result !== 'defeat' && !guard) {
      a.arms[0].rotation.z = -2.4;
      a.arms[1].rotation.z = 2.4;
    } else {
      a.arms[0].rotation.z = 0;
      a.arms[1].rotation.z = 0;
    }
    a.body.position.y = crouch
      ? -0.45
      : captured
        ? -0.35
        : speed > 0.2
          ? Math.abs(Math.sin(a.phase)) * 0.06
          : Math.sin(t * 2) * 0.02;
    if (p.cleaning) {
      a.body.position.y = -0.5;
      a.arms[1].rotation.x = -0.5 + Math.sin(t * 16) * 0.45;
    }
    if (p.climb) a.body.position.y = 0;
    a.body.rotation.x = p.climb ? 0.5 : p.cleaning ? 0.85 : crouch ? 0.32 : captured ? 0.2 : 0;
    a.body.rotation.z = eliminated
      ? 1.4
      : p.invuln > 1.3
        ? Math.sin(t * 40) * 0.1
        : guard && p.state === 'party' && p.socialStyle === 'dance'
          ? Math.sin(t * 1.8 + Number(p.id.slice(1)) * 1.7) * 0.055
          : 0;
    a.hideAmount = THREE.MathUtils.damp(a.hideAmount || 0, p.hidden ? 1 : 0, 13, dt);
    a.root.visible =
      (this.firstPerson ||
        p.f === this.floor ||
        (this.floor === 2 &&
          p.f === 1 &&
          [ATRIUM, ...stairHoles].some(
            (h) => Math.abs(p.x - h.x) < h.w / 2 && Math.abs(p.z - h.z) < h.d / 2,
          ))) &&
      (!p.hidden || this.lastState.time - (p.hideAt || 0) < 0.55) &&
      p.alive !== false;
    const me = this.viewer;
    if (me && p.id !== me.id && !this.firstPerson && p.f === me.f)
      a.root.visible = a.root.visible && canObserve(me, p, this.lastState.doors, this.visibleRooms);
    a.root.scale.setScalar(1);
    if (a.weapon) a.weapon.visible = p.armed !== false;
    const beam = (guard ? p.armed !== false : p.torch) && !p.hidden;
    a.torch.visible = beam && (!guard || this.nearLightIds?.has(p.id));
    a.cone.visible = beam;
    a.ring.visible = !guard || p.state === 'chase';
    a.ring.material.opacity = captured ? 0.8 : 0.45;
  }
  update(state, myId, dt) {
    this.elapsed += dt;
    this.lastState = state;
    this.preview = !state || state.phase === 'lobby';
    for (let i = 0; i < this.previewActors.length; i++)
      this.previewActors[i].root.visible = !state && i !== 1;
    const me = state?.players.find((p) => p.id === myId);
    const observer = !!state?.observer;
    this.observerLight.intensity = observer ? 1.8 : 0;
    this.scene.fog.density = observer ? 0 : 0.012;
    this.viewer = observer ? null : me;
    if (observer && this.observerView === 'follow') this.observerFloor = me.f;
    const fps = !!me && (this.firstPerson || !!me.hidden || !!me.peeking) && !observer;
    this.effectiveFirstPerson = fps;
    const f = observer ? this.observerFloor : (me?.f ?? 1);
    const viewingPosition = me ? peekView(me, state.doors) : null;
    const indoors = fps && regionAt(f, viewingPosition.x, viewingPosition.z) !== 'outside';
    this.ambientLight.intensity = indoors ? 0.015 : 0.16;
    this.moon.intensity = indoors ? 0 : 0.2;
    this.visibleRooms = observer
      ? new Set([
          ...rooms.filter((r) => r.f === f).map((r) => r.id),
          `hall${f}`,
          ...(f === 1 ? ['outside'] : []),
        ])
      : me
        ? visibleRegions(me, state.doors)
        : null;
    if (f !== this.floor) {
      this.floor = f;
      this.container.classList.add('floor-change');
      setTimeout(() => this.container.classList.remove('floor-change'), 220);
    }
    this.floors.forEach((g, i) => (g.visible = fps || this.floor === 2 || i === this.floor));
    this.groundPlane.constant = -(f - 1) * FLOOR_HEIGHT;
    for (const [id, group] of this.roomMeshes)
      group.visible =
        fps ||
        (f === 2 && (id.startsWith('r1-') || id === 'hall1')) ||
        !me ||
        this.visibleRooms.has(id);
    this.ground.visible = fps || !me || this.visibleRooms.has('outside');
    if (observer) this.exterior.visible = f === 1;
    for (const w of this.wallGroups) {
      const regions = [w.a, w.b];
      if (w.group.userData.upper)
        w.group.userData.upper.material.opacity =
          me &&
          this.visibleRooms.has('outside') &&
          !regions.some((r) => r !== 'outside' && this.visibleRooms.has(r)) &&
          regions.includes('outside')
            ? 1
            : fps
              ? 1
              : 0.18;
      if (w.group.userData.upper) {
        const upper = w.group.userData.upper;
        upper.material.depthWrite = fps;
        upper.scale.y = fps ? 1.5 : 1;
        upper.position.y = fps ? 1.95 : 1.55;
      }
      w.group.visible =
        fps || (f === 2 && w.f === 1) || !me || regions.some((r) => this.visibleRooms.has(r));
    }
    if (me)
      for (const d of doors) {
        const normal = d.axis === 'z' ? { x: 0.7, z: 0 } : { x: 0, z: 0.7 };
        const visible = [
          regionAt(d.f, d.x + normal.x, d.z + normal.z),
          regionAt(d.f, d.x - normal.x, d.z - normal.z),
        ].some((r) => this.visibleRooms.has(r));
        this.doorGroups.get(d.id).visible =
          (fps || f === 2 || d.f === this.floor) && (fps || (f === 2 && d.f === 1) || visible);
      }
    if (observer)
      this.target.set(
        this.observerView === 'follow' ? me.x : 0,
        0,
        this.observerView === 'follow' ? me.z : f === 1 && this.observerView !== 'house' ? -7.5 : 0,
      );
    else if (me) this.target.lerp(new THREE.Vector3(me.x, 0, me.z), 1 - Math.exp(-dt * 5));
    else this.target.set(-9, 0, -5);
    this.target.y = (f - 1) * FLOOR_HEIGHT;
    this.camera.position
      .copy(this.target)
      .add(observer ? new THREE.Vector3(0, 45, 0.01) : new THREE.Vector3(0, 27, 17));
    const baseZoom = observer
      ? this.observerView === 'follow'
        ? 0.8
        : f === 2
          ? 0.48
          : this.observerView === 'house'
            ? 0.42
            : 0.27
      : 1;
    const zoom = baseZoom * (observer ? this.observerZoomFactor : 1);
    if (this.camera.zoom !== zoom) {
      this.camera.zoom = zoom;
      this.camera.updateProjectionMatrix();
    }
    this.camera.lookAt(this.target);
    if (state) {
      this.nearLightIds = new Set(
        state.guards
          .filter(
            (g) =>
              g.alive !== false &&
              g.armed !== false &&
              g.f === this.floor &&
              (!me || this.firstPerson || canObserve(me, g, state.doors, this.visibleRooms)),
          )
          .sort(
            (a, b) =>
              Math.hypot(a.x - (me?.x || 0), a.z - (me?.z || 0)) -
              Math.hypot(b.x - (me?.x || 0), b.z - (me?.z || 0)),
          )
          .slice(0, 2)
          .map((g) => g.id),
      );
      for (const p of [...state.players, ...state.guards]) {
        const guard = p.id.startsWith('g');
        if (!this.actors.has(p.id) || (!guard && this.actors.get(p.id).character !== p.character)) {
          this.actors.get(p.id)?.root.removeFromParent();
          const a = character(p.character, guard, Number(p.id.slice(1)));
          a.character = p.character;
          a.root.position.set(p.x, 0, p.z);
          this.scene.add(a.root);
          this.actors.set(p.id, a);
        }
        this.animateActor(this.actors.get(p.id), p, dt, this.elapsed, guard);
        if (fps && p.id === myId) this.actors.get(p.id).root.visible = false;
      }
      for (const [id, a] of this.actors)
        if (!state.players.some((p) => p.id === id) && !state.guards.some((g) => g.id === id)) {
          a.root.visible = false;
        }
      for (const [id, pivot] of this.doorMeshes) {
        pivot.visible = !state.brokenDoors?.[id];
        if (pivot.userData.doublePivot) pivot.userData.doublePivot.visible = pivot.visible;
        if (pivot.userData.sliding) {
          const height = state.doors[id] ? 1.3 : 0;
          pivot.position.y += (height - pivot.position.y) * Math.min(1, dt * 7);
        } else {
          const angle =
            (pivot.userData.baseAngle || 0) +
            (state.doors[id] === 'ajar' ? AJAR_ANGLE : state.doors[id] ? Math.PI * 0.48 : 0);
          pivot.rotation.y += (angle - pivot.rotation.y) * Math.min(1, dt * 9);
          if (pivot.userData.doublePivot) {
            const other = pivot.userData.doublePivot;
            const target = Math.PI - (state.doors[id] ? Math.PI * 0.48 : 0);
            other.rotation.y += (target - other.rotation.y) * Math.min(1, dt * 9);
          }
        }
      }
      for (const [id, light] of this.lightMeshes)
        light.intensity =
          state.power !== false && state.lights[light.userData.roomId || id] !== false
            ? light.userData.roomId === 'r1-0'
              ? 110
              : 65
            : 0;
      for (const noise of state.noises.filter(
        (n) => n.f === this.floor && (!me || canObserve(me, n, state.doors, this.visibleRooms)),
      )) {
        if (!this.effects.some((e) => e.id === noise.id)) {
          const ring = new THREE.Mesh(
            new THREE.RingGeometry(0.97, 1, 40),
            new THREE.MeshBasicMaterial({
              color: 0xdba771,
              transparent: true,
              opacity: 0.5,
              depthWrite: false,
            }),
          );
          ring.rotation.x = -Math.PI / 2;
          ring.position.set(noise.x, (noise.f - 1) * FLOOR_HEIGHT + 0.1, noise.z);
          this.scene.add(ring);
          this.effects.push({ id: noise.id, mesh: ring, life: 0, max: noise.radius * 0.5 });
        }
      }
    }
    for (const b of state?.bodies || []) {
      if (!this.bodyMeshes.has(b.id)) {
        const actor = character(0, true, b.index);
        if (actor.weapon) actor.weapon.visible = false;
        actor.torch.visible = false;
        actor.cone.visible = false;
        actor.ring.visible = false;
        actor.body.rotation.z = Math.PI / 2;
        actor.root.position.y = 0.25;
        this.scene.add(actor.root);
        this.bodyMeshes.set(b.id, actor);
      }
      const actor = this.bodyMeshes.get(b.id);
      actor.root.position.set(b.x, (b.f - 1) * FLOOR_HEIGHT + 0.28, b.z);
      actor.root.rotation.y = b.angle;
      actor.root.visible =
        (!b.hidden || observer) &&
        !!me &&
        (observer ? b.f === f : canObserve(me, b, state.doors, this.visibleRooms));
    }
    for (const [id, actor] of this.bodyMeshes)
      if (!state?.bodies?.some((b) => b.id === id)) actor.root.visible = false;
    let bloodCount = 0;
    const stamp = new THREE.Object3D();
    for (const mark of state?.blood || []) {
      if (
        bloodCount >= 5000 ||
        !me ||
        (observer ? mark.f !== f : !canObserve(me, mark, state.doors, this.visibleRooms))
      )
        continue;
      stamp.position.set(mark.x, (mark.f - 1) * FLOOR_HEIGHT + 0.085, mark.z);
      stamp.rotation.set(-Math.PI / 2, 0, 0);
      stamp.scale.set(mark.size, mark.size * 0.7, 1);
      stamp.updateMatrix();
      this.bloodMesh.setMatrixAt(bloodCount++, stamp.matrix);
    }
    this.bloodMesh.count = bloodCount;
    this.bloodMesh.instanceMatrix.needsUpdate = true;
    this.bloodMesh.frustumCulled = false;
    const flyingIds = new Set();
    for (const b of state?.thrown || []) {
      flyingIds.add(b.id);
      if (!this.projectiles.has(b.id)) {
        const mesh = new THREE.Group();
        cylinder(mesh, 0, 0, 0, 0.05, 0.07, 0.3, 0x7da37c);
        cylinder(mesh, 0, 0.2, 0, 0.03, 0.03, 0.15, 0xb6c8a0);
        this.scene.add(mesh);
        this.projectiles.set(b.id, mesh);
      }
      const mesh = this.projectiles.get(b.id),
        t = Math.min(1, (state.time - b.at) / (b.duration || 0.65));
      mesh.position.set(
        THREE.MathUtils.lerp(b.fromX, b.x, t),
        (b.f - 1) * FLOOR_HEIGHT + 0.16 + (1 - t) * 0.9 + Math.sin(t * Math.PI) * (b.height || 2),
        THREE.MathUtils.lerp(b.fromZ, b.z, t),
      );
      mesh.rotation.z = t * 8;
      mesh.visible =
        !b.impacted &&
        b.f === this.floor &&
        (observer || !me || canObserve(me, b, state.doors, this.visibleRooms));
    }
    for (const [id, mesh] of this.projectiles)
      if (!flyingIds.has(id)) {
        this.scene.remove(mesh);
        this.projectiles.delete(id);
      }
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.life += dt;
      const scale = 1 + e.life * e.max;
      e.mesh.scale.setScalar(scale);
      e.mesh.material.opacity = Math.max(0, 0.45 - e.life * 0.3);
      if (e.life > 1.5) {
        this.scene.remove(e.mesh);
        e.mesh.geometry.dispose();
        e.mesh.material.dispose();
        this.effects.splice(i, 1);
      }
    }
    const power = state?.power !== false;
    for (const light of this.gardenLights)
      light.intensity = power ? light.userData.poweredIntensity : 0;
    for (const fixture of this.gardenFixtures) {
      fixture.glass.material.emissiveIntensity = power ? 1 : 0;
      fixture.pool.visible = power;
    }
    for (const [id, glass] of this.windowGlass) {
      const on = power && (!state || state.lights[glass.room]);
      glass.mesh.material.emissiveIntensity = on ? 0.65 : 0;
      glass.mesh.material.color.setHex(on ? 0xb6d5ce : 0x344b51);
      this.windowPools.get(id).mesh.visible = !!on;
    }
    const glowingWindows = doors
      .filter(
        (d) =>
          d.window &&
          power &&
          (!state || state.lights[d.room]) &&
          (!me || this.visibleRooms.has('outside')),
      )
      .sort(
        (a, b) =>
          Math.hypot(a.x - (me?.x || -22), a.z - (me?.z || 0)) -
          Math.hypot(b.x - (me?.x || -22), b.z - (me?.z || 0)),
      );
    for (let i = 0; i < this.windowLights.length; i++) {
      const light = this.windowLights[i],
        d = glowingWindows[i];
      light.intensity = d && (!fps || !indoors) ? 4 : 0;
      if (d) {
        const n = windowNormal(d);
        light.position.set(d.x + n.x * 0.7, 1.1, d.z + n.z * 0.7);
      }
    }
    const lightSources =
      state && me
        ? [
            ...state.players.filter(
              (p) =>
                p.f === this.floor && p.torch && !p.hidden && !p.peeking && p.status === 'free',
            ),
            ...state.guards.filter((g) => this.nearLightIds?.has(g.id)),
          ]
        : [];
    for (let i = 0; i < this.sharedBeams.length; i++) {
      const light = this.sharedBeams[i],
        p = lightSources[i];
      light.intensity =
        p && (!fps || p.id === myId || lineClear(f, me, p, state.doors, true))
          ? p.id.startsWith('g')
            ? 24
            : 85
          : 0;
      light.distance = 18;
      light.angle = 0.58;
      if (p) {
        light.position.set(p.x, (p.f - 1) * FLOOR_HEIGHT + 1.35, p.z);
        const pitch = fps && p.id === myId ? this.lookPitch : -0.14;
        light.target.position.set(
          p.x + Math.sin(p.angle) * Math.cos(pitch) * 8,
          (p.f - 1) * FLOOR_HEIGHT + 1.35 + Math.sin(pitch) * 8,
          p.z + Math.cos(p.angle) * Math.cos(pitch) * 8,
        );
      }
    }
    this.throwAim.visible = this.throwLanding.visible = !!me?.charging && !observer;
    if (this.throwAim.visible) {
      const trajectory = bottleTrajectory(me, state.doors, me.throwCharge);
      const points = Array.from({ length: 33 }, (_, i) => {
        const t = i / 32;
        return new THREE.Vector3(
          me.x + (trajectory.x - me.x) * t,
          (me.f - 1) * FLOOR_HEIGHT +
            0.16 +
            (1 - t) * 0.9 +
            Math.sin(t * Math.PI) * trajectory.height,
          me.z + (trajectory.z - me.z) * t,
        );
      });
      this.throwAim.geometry.setFromPoints(points);
      this.throwLanding.position.set(trajectory.x, (me.f - 1) * FLOOR_HEIGHT + 0.12, trajectory.z);
    }
    const candidates = this.localLightSources
      .filter((light) => {
        const region = light.userData.region;
        return (
          light.userData.floor === this.floor &&
          (fps
            ? (region.startsWith('hall') ? `hall${f}` : region) ===
              regionAt(f, viewingPosition.x, viewingPosition.z)
            : !me ||
              !region ||
              this.visibleRooms.has(region.startsWith('hall') ? `hall${this.floor}` : region))
        );
      })
      .sort(
        (a, b) =>
          a.position.distanceToSquared(this.target) - b.position.distanceToSquared(this.target),
      );
    for (let i = 0; i < this.localLights.length; i++) {
      const light = this.localLights[i],
        source = candidates[i];
      light.intensity = source ? source.intensity : 0;
      if (source) {
        light.position.copy(source.position);
        light.color.copy(source.color);
        light.distance = source.distance;
        light.decay = source.decay;
      }
    }
    for (const [id, materials] of this.roomAmbientMaterials) {
      const on = power && (!state || state.lights[id] !== false);
      for (const material of materials) material.emissiveIntensity = on ? 0.45 : 0;
    }
    for (const fixture of this.fixtureMeshes)
      fixture.mesh.material.emissiveIntensity =
        power && (!state || state.lights[fixture.room] !== false) ? 1 : 0;
    for (const label of this.floorLabels) label.visible = !fps;
    for (const ceiling of this.ceilings) ceiling.visible = fps;
    for (const faces of this.fpsWallFaces) faces.visible = fps;
    for (const [id, cabinet] of this.cabinetMeshes) {
      const h = hides.find((h) => h.prop === id),
        occupant = state?.players.find((p) => p.hidden === h?.id);
      const opening = occupant
        ? occupant.hidePeek
          ? 0.19
          : this.elapsed - (this.cabinetSeen?.get(id) ?? this.elapsed) < 0.6
            ? 1.1
            : 0
        : 0;
      this.cabinetSeen ||= new Map();
      if (occupant && !this.cabinetSeen.has(id)) this.cabinetSeen.set(id, this.elapsed);
      if (!occupant) this.cabinetSeen.delete(id);
      cabinet.userData.cabinetLeaves.forEach(
        (leaf, i) =>
          (leaf.rotation.y = THREE.MathUtils.damp(leaf.rotation.y, (i ? 1 : -1) * opening, 12, dt)),
      );
    }
    if (fps) {
      const height = me.peeking ? 1.02 : me.crouching || me.hidden ? 0.95 : 1.65;
      const eye = peekView(me, state.doors);
      const pose = visualPose(me),
        desired = new THREE.Vector3(eye.x, height + pose.y, eye.z);
      if (me.stair) {
        desired.x = pose.x;
        desired.z = pose.z;
      }
      if (!this.eyePosition || this.eyePosition.distanceTo(desired) > 4 || me.peeking)
        this.eyePosition = desired;
      else this.eyePosition.lerp(desired, 1 - Math.exp(-dt * 24));
      this.fpsCamera.position.copy(this.eyePosition);
      const hide = hides.find((h) => h.id === me.hidden),
        cabinet = props.find((p) => p.id === hide?.prop);
      const door = doors.find((d) => d.id === me.peeking);
      const keyholeYaw = door
        ? door.axis === 'z'
          ? me.x < door.x
            ? Math.PI / 2
            : -Math.PI / 2
          : me.z < door.z
            ? 0
            : Math.PI
        : this.lookYaw;
      const yaw = me.hidden ? cabinet?.rotation || 0 : me.peeking ? keyholeYaw : this.lookYaw;
      const direction = new THREE.Vector3(
        Math.sin(yaw) * Math.cos(this.lookPitch),
        Math.sin(this.lookPitch),
        Math.cos(yaw) * Math.cos(this.lookPitch),
      );
      this.fpsCamera.lookAt(this.fpsCamera.position.clone().add(direction));
      // The held torch follows the eye, including vertical aim.
      const beam = this.sharedBeams[0];
      if (me.torch && !me.peeking) {
        beam.position.copy(this.fpsCamera.position);
        beam.target.position.copy(this.fpsCamera.position).addScaledVector(direction, 10);
      }
    }
    this.renderer.render(this.scene, fps ? this.fpsCamera : this.camera);
  }
}
