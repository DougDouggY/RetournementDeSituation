import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { rooms, walls, doors, props, hides, devices, stairs } from '../shared/map.js';
const palettes = [
  { floor: 0x4c5550, wall: 0x61736b },
  { floor: 0x775744, wall: 0x8d9c8a },
  { floor: 0x53636c, wall: 0x7b9296 },
  { floor: 0x786957, wall: 0x9a8f77 },
  { floor: 0x56655c, wall: 0x75908a },
  { floor: 0x6b5355, wall: 0x968784 },
];
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
    w = p.w,
    d = p.d,
    wood = 0x73543e,
    dark = 0x282f31,
    cream = 0xb6ac91;
  group.position.set(p.x, 0, p.z);
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
    case 'wardrobe':
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
  if (guard) {
    const weapon = new THREE.Group();
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
  for (const part of [...arms, ...legs, head]) batchStatic(part);
  batchStatic(body, new Set([...arms, ...legs, head]));
  return { root, body, head, arms, legs, torch, cone, ring, phase: 0, torso };
}
export class GameScene {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x12272b);
    this.scene.fog = new THREE.FogExp2(0x12272b, 0.012);
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    container.appendChild(this.renderer.domElement);
    this.camera = new THREE.OrthographicCamera(-14, 14, 10, -10, 0.1, 100);
    this.camera.position.set(0, 27, 17);
    this.camera.lookAt(0, 0, 0);
    this.target = new THREE.Vector3(-12, 0, -5);
    this.scene.add(new THREE.HemisphereLight(0xbcd9d2, 0x423b35, 2));
    const moon = new THREE.DirectionalLight(0xc9e6ec, 2.3);
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
    this.floors = [];
    this.doorMeshes = new Map();
    this.lightMeshes = new Map();
    this.wallMeshes = [];
    this.actors = new Map();
    this.effects = [];
    this.projectiles = new Map();
    this.floor = 1;
    this.preview = true;
    this.elapsed = 0;
    this.raycaster = new THREE.Raycaster();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const ground = box(this.scene, 0, -0.45, 0, 95, 0.4, 80, 0x233b39);
    ground.receiveShadow = true;
    for (let f = 0; f < 3; f++) this.buildFloor(f);
    // Outside the cutaway: hedges, paving stones, fence and moonlit pines.
    const exterior = new THREE.Group();
    this.scene.add(exterior);
    for (let i = 0; i < 25; i++) {
      const x = -30 + ((i * 17) % 61),
        z = i % 2 ? 18 : -18;
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
    for (let i = -20; i <= 20; i += 2.5) {
      box(exterior, i, 0.5, 15, 0.12, 1.1, 0.12, 0x52615a);
      box(exterior, i, 0.5, -15, 0.12, 1.1, 0.12, 0x52615a);
    }
    for (const z of [-15, 15])
      for (const y of [0.3, 0.8]) box(exterior, 0, y, z, 42, 0.08, 0.08, 0x687468);
    batchStatic(exterior);
    this.previewActors = [character(0), character(1), character(0, true, 0), character(0, true, 1)];
    this.previewActors.forEach((a, i) => {
      a.root.position.set(-12 + i * 1.7, 0, i < 2 ? -4 : -8);
      a.root.rotation.y = 0.4;
      this.floors[1].add(a.root);
    });
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }
  buildFloor(f) {
    const group = new THREE.Group();
    this.floors.push(group);
    this.scene.add(group);
    group.visible = f === 1;
    box(group, 0, -0.18, 0, 36.5, 0.35, 24.5, 0x36433f);
    box(group, 0, 0.005, 0, 35.7, 0.04, 3.8, 0x85765c);
    for (let i = -17; i < 18; i += 1.5) box(group, i, 0.035, 0, 0.02, 0.005, 3.8, 0x574e40, 0);
    for (const r of rooms.filter((r) => r.f === f)) {
      const palette = palettes[r.style];
      box(group, r.x, -0.015, r.z, 11.8, 0.1, 9.8, palette.floor, 0);
      // Plank seams, tiled bathrooms and a room name integrated into the floor.
      for (let x = r.x - 5.5; x < r.x + 6; x += r.name.includes('bains') ? 1 : 1.2)
        box(group, x, 0.04, r.z, 0.018, 0.008, 9.8, 0x323e38, 0);
      if (r.name.includes('bains'))
        for (let z = r.z - 4.5; z < r.z + 5; z++)
          box(group, r.x, 0.045, z, 11.8, 0.008, 0.018, 0x455952, 0);
      const text = label(r.name.toUpperCase());
      text.position.set(r.x, 0.07, r.z + (r.z < 0 ? 3.5 : -3.5));
      group.add(text);
      // Framed prints hung on the far walls.
      box(group, r.x + 2, 1.5, r.z < 0 ? -11.82 : 11.82, 1.2, 0.85, 0.06, 0x413b30);
      box(group, r.x + 2, 1.5, r.z < 0 ? -11.77 : 11.77, 1.02, 0.65, 0.04, 0x9a8f70);
      const glow = new THREE.PointLight(0xf1be76, 9, 8, 2);
      glow.position.set(r.x + 3, 2.5, r.z);
      group.add(glow);
      this.lightMeshes.set(r.id, glow);
    }
    for (const w of walls.filter((w) => w.f === f)) {
      box(group, w.x, 0.38, w.z, w.w, 0.75, w.d, 0x7d8c7b, 0.02);
      const upper = box(group, w.x, 1.55, w.z, w.w, 1.6, w.d, 0x778c80, 0.02);
      upper.material = upper.material.clone();
      upper.material.transparent = true;
      upper.material.opacity = 0.18;
      upper.castShadow = false;
      upper.material.depthWrite = false;
      this.wallMeshes.push(upper);
      box(group, w.x, 0.79, w.z, w.w + 0.03, 0.09, w.d + 0.03, 0xa7a68c, 0.01);
    }
    for (const d of doors.filter((d) => d.f === f)) {
      const pivot = new THREE.Group();
      pivot.position.set(d.x - 1, 0, d.z);
      group.add(pivot);
      const leaf = box(pivot, 1, 1, 0, 1.94, 2, 0.13, 0x6a5440);
      leaf.material = leaf.material.clone();
      leaf.material.transparent = true;
      leaf.material.opacity = 0.65;
      box(pivot, 1.75, 1, 0.12, 0.12, 0.12, 0.14, 0xc2a166);
      box(group, d.x - 1.05, 1.1, d.z, 0.12, 2.2, 0.25, 0xa59a7e);
      box(group, d.x + 1.05, 1.1, d.z, 0.12, 2.2, 0.25, 0xa59a7e);
      this.doorMeshes.set(d.id, pivot);
    }
    for (const p of props.filter((p) => p.f === f)) group.add(furniture(p));
    for (const s of stairs.filter((s) => s.f === f && s.to !== null)) {
      for (let j = 0; j < 7; j++)
        box(group, s.x - 1 + j * 0.3, 0.07 + j * 0.07, s.z, 0.3, 0.12 + j * 0.14, 2.5, 0x7a8276);
      const t = label(s.to > f ? '↑ ÉTAGE' : '↓ SOUS-SOL', '#d7c093');
      t.position.set(s.x, 0.8, 0);
      group.add(t);
    }
    for (const d of devices.filter((d) => d.f === f)) {
      if (d.type === 'light') {
        box(group, d.x, 0.035, d.z, 0.3, 0.05, 0.3, 0xc8bc86);
        continue;
      }
      if (d.type === 'bottles') {
        for (let j = 0; j < 3; j++) {
          cylinder(group, d.x + (j - 1) * 0.16, 0.28, d.z, 0.045, 0.07, 0.4, 0x6a9769);
          cylinder(group, d.x + (j - 1) * 0.16, 0.52, d.z, 0.026, 0.026, 0.12, 0xa7b290);
        }
      }
      if (d.type === 'alarm') {
        box(group, d.x, 0.2, d.z, 0.5, 0.4, 0.3, 0xae6e56);
        sphere(group, d.x, 0.24, d.z + 0.16, 0.14, 0xe2d2aa, 1, 1, 0.2);
      }
      if (d.type === 'breaker') box(group, d.x, 1, d.z, 0.65, 1.4, 0.25, 0x5c7269);
    }
    // Bound chair in the garage, reachable from the doorway.
    if (f === 1) {
      box(group, 14, 0.5, 9, 0.8, 0.16, 0.8, 0x81654b);
      box(group, 14, 1, 8.7, 0.8, 1, 0.12, 0x81654b);
    }
    batchStatic(group, new Set(this.doorMeshes.values()));
  }
  resize() {
    const w = this.container.clientWidth || innerWidth,
      h = this.container.clientHeight || innerHeight;
    this.renderer.setSize(w, h);
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
    this.renderer.setPixelRatio(low ? 0.8 : Math.min(devicePixelRatio, 1.7));
    this.renderer.shadowMap.enabled = !low;
    this.resize();
  }
  animateActor(a, p, dt, t, guard = false) {
    const target = new THREE.Vector3(p.x, 0, p.z);
    const previous = a.root.position.clone();
    a.root.position.lerp(target, Math.min(1, dt * 16));
    const speed = previous.distanceTo(a.root.position) / Math.max(dt, 0.001);
    const delta = Math.atan2(
      Math.sin(p.angle - a.root.rotation.y),
      Math.cos(p.angle - a.root.rotation.y),
    );
    a.root.rotation.y += delta * Math.min(1, dt * 15);
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
    if (captured) {
      a.arms[0].rotation.x = -1.1;
      a.arms[1].rotation.x = -1.1;
    }
    if (p.interactUntil > (this.lastState?.time || 0)) {
      a.arms[1].rotation.x = -1.2 + Math.sin(t * 15) * 0.2;
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
    a.body.rotation.x = crouch ? 0.32 : captured ? 0.2 : 0;
    a.body.rotation.z = eliminated ? 1.4 : p.invuln > 1.3 ? Math.sin(t * 40) * 0.1 : 0;
    a.hideAmount = THREE.MathUtils.damp(a.hideAmount || 0, p.hidden ? 1 : 0, 13, dt);
    a.root.visible = p.f === this.floor && a.hideAmount < 0.98;
    a.root.scale.setScalar(1 - a.hideAmount * 0.94);
    const beam = (guard || p.torch) && !p.hidden;
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
    const f = me?.f ?? 1;
    if (f !== this.floor) {
      this.floor = f;
      this.container.classList.add('floor-change');
      setTimeout(() => this.container.classList.remove('floor-change'), 220);
    }
    this.floors.forEach((g, i) => (g.visible = i === this.floor));
    if (me) this.target.lerp(new THREE.Vector3(me.x, 0, me.z), 1 - Math.exp(-dt * 5));
    else this.target.set(-9, 0, -5);
    this.camera.position.copy(this.target).add(new THREE.Vector3(0, 27, 17));
    this.camera.lookAt(this.target);
    if (state) {
      this.nearLightIds = new Set(
        state.guards
          .filter((g) => g.f === this.floor)
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
      }
      for (const [id, a] of this.actors)
        if (!state.players.some((p) => p.id === id) && !state.guards.some((g) => g.id === id)) {
          a.root.visible = false;
        }
      for (const [id, pivot] of this.doorMeshes) {
        const angle = state.doors[id] ? Math.PI * 0.48 : 0;
        pivot.rotation.y += (angle - pivot.rotation.y) * Math.min(1, dt * 9);
      }
      for (const [id, light] of this.lightMeshes) light.intensity = state.lights[id] ? 9 : 0.3;
      for (const noise of state.noises.filter((n) => n.f === this.floor)) {
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
          ring.position.set(noise.x, 0.1, noise.z);
          this.scene.add(ring);
          this.effects.push({ id: noise.id, mesh: ring, life: 0, max: noise.radius * 0.5 });
        }
      }
    }
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
        t = Math.min(1, (state.time - b.at) / 0.65);
      mesh.position.set(
        THREE.MathUtils.lerp(b.fromX, b.x, t),
        0.16 + Math.sin(t * Math.PI) * 2,
        THREE.MathUtils.lerp(b.fromZ, b.z, t),
      );
      mesh.rotation.z = t * 8;
      mesh.visible = b.f === this.floor;
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
    const lightSources =
      state && me
        ? [
            ...state.players.filter(
              (p) => p.f === this.floor && p.torch && !p.hidden && p.status === 'free',
            ),
            ...state.guards.filter((g) => this.nearLightIds?.has(g.id)),
          ]
        : [];
    for (let i = 0; i < this.sharedBeams.length; i++) {
      const light = this.sharedBeams[i],
        p = lightSources[i];
      light.intensity = p ? 16 : 0;
      if (p) {
        light.position.set(p.x, 1.35, p.z);
        light.target.position.set(p.x + Math.sin(p.angle) * 8, 0.2, p.z + Math.cos(p.angle) * 8);
      }
    }
    this.renderer.render(this.scene, this.camera);
  }
}
