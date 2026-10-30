import fs from 'node:fs/promises';
import {
  FLOOR_IDS,
  FLOORS,
  WORLD,
  HOUSE,
  POOL,
  TERRACE,
  ATRIUM,
  rooms,
  walls,
  doors,
  props,
  stairs,
  devices,
  PARTY_SPOTS,
  gardenLamps,
  roomFloorParts,
  hallFloorParts,
} from '../shared/map.js';
const esc = (s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;');
function plan(f, ox, oy, k) {
  const X = (x) => ox + x * k,
    Z = (z) => oy + z * k;
  let svg = '';
  const rect = (p, fill, stroke = 'none') =>
    `<rect x="${X(p.x - p.w / 2)}" y="${Z(p.z - p.d / 2)}" width="${p.w * k}" height="${p.d * k}" fill="${fill}" stroke="${stroke}"/>`;
  if (f === 1) {
    svg += rect(
      {
        x: 0,
        z: (WORLD.minZ + WORLD.maxZ) / 2,
        w: WORLD.maxX - WORLD.minX,
        d: WORLD.maxZ - WORLD.minZ,
      },
      '#dce5d0',
      '#8caa8f',
    );
    svg += rect(TERRACE, '#d1bb90');
    svg += rect(POOL, '#8cc6d2', '#508c9f');
    svg += `<text x="${X(POOL.x)}" y="${Z(POOL.z)}" class="name">PISCINE · BASSIN INFRANCHISSABLE</text><text x="${X(-1)}" y="${Z(-26)}" class="name">TERRASSE · BAR · SOIRÉE</text>`;
    for (const p of gardenLamps)
      svg += `<circle cx="${X(p.x)}" cy="${Z(p.z)}" r="3.5" fill="#c99b31"/>`;
  }
  for (const p of hallFloorParts(f)) svg += rect(p, '#d7cbb1');
  if (f === 2) svg += rect(ATRIUM, '#b3ced0', '#77999f');
  for (const r of rooms.filter((r) => r.f === f))
    for (const p of roomFloorParts(r))
      svg += rect(p, r.id === 'r1-0' || r.id === 'r1-1' ? '#ebd593' : '#eee5d3');
  for (const p of props.filter((p) => p.f === f && p.solid && p.type !== 'pool'))
    svg += rect(p, '#948b78');
  for (const w of walls.filter((w) => w.f === f))
    svg += `<rect x="${X(w.x - w.w / 2)}" y="${Z(w.z - w.d / 2)}" width="${Math.max(2, w.w * k)}" height="${Math.max(2, w.d * k)}" fill="${w.railing ? '#92a5a4' : '#2e4850'}"/>`;
  for (const d of doors.filter((d) => d.f === f))
    svg += `<rect x="${X(d.x - d.w / 2)}" y="${Z(d.z - d.d / 2)}" width="${Math.max(4, d.w * k)}" height="${Math.max(4, d.d * k)}" fill="${d.window ? '#2692ac' : '#cd8439'}"/>`;
  for (const r of rooms.filter((r) => r.f === f)) {
    const p = r.parts[0],
      max = Math.max(13, Math.floor((p.w * k) / 7));
    const lines = [];
    let line = '';
    for (const word of r.name.split(' ')) {
      if (line.length + word.length > max) {
        lines.push(line);
        line = word;
      } else line += (line ? ' ' : '') + word;
    }
    if (line) lines.push(line);
    lines.forEach(
      (line, i) =>
        (svg += `<text x="${X(p.x)}" y="${Z(p.z) - 12 + i * 15}" class="name outline">${esc(line)}</text>`),
    );
    svg += `<text x="${X(p.x)}" y="${Z(p.z) + lines.length * 15 + 3}" class="small outline">${Math.round(r.area)} m²</text>`;
  }
  for (const s of stairs.filter((s) => s.f === f))
    svg += `<circle cx="${X(s.x)}" cy="${Z(s.z)}" r="12" fill="#8c668c"/><text x="${X(s.x)}" y="${Z(s.z) + 4}" class="name" style="fill:white">${s.id.startsWith('main') ? 'A' : 'B'}${s.to > s.f ? '↑' : '↓'}</text>`;
  if (f === 1) {
    for (const p of PARTY_SPOTS)
      svg += `<circle cx="${X(p.x)}" cy="${Z(p.z)}" r="4.5" fill="#b44f42" stroke="white"/>`;
    for (const d of devices.filter((d) => d.type === 'breaker'))
      svg += `<circle cx="${X(d.x)}" cy="${Z(d.z)}" r="6" fill="#b83838"/><text x="${X(d.x) + 12}" y="${Z(d.z) + 4}" class="small" style="text-anchor:start">Coffret</text>`;
    svg += `<text x="${X(0)}" y="${Z(19.8)}" class="small">ENTRÉE PRINCIPALE</text><text x="${X(-31)}" y="${Z(-5)}" class="small">DÉPART</text>`;
  } else svg += `<text x="${X(ATRIUM.x)}" y="${Z(ATRIUM.z)}" class="small">VIDE SUR LE HALL</text>`;
  return svg;
}
function svg(body, w, h, title) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${title}"><style>text{font-family:Arial,sans-serif;fill:#1d3a43}.title{font-size:28px;font-weight:bold}.sub{font-size:15px;fill:#536a70}.name{font-size:12px;font-weight:bold;text-anchor:middle}.small{font-size:11px;text-anchor:middle}.outline{paint-order:stroke;stroke:#eee5d3;stroke-width:3;stroke-linejoin:round}</style><rect width="100%" height="100%" fill="#f5f1e7"/>${body}</svg>`;
}
let body =
  '<text x="40" y="45" class="title">LA VILLA — NOUVELLE CARTE JOUABLE · RDC + UN ÉTAGE</text><text x="40" y="76" class="sub">Sans sous-sol · maison élargie à 50 × 32 m · plan extrait des collisions et des pièces réellement intégrées au jeu.</text>';
body +=
  '<text x="500" y="130" class="name" style="font-size:22px">REZ-DE-CHAUSSÉE + JARDIN</text><text x="1310" y="180" class="name" style="font-size:22px">ÉTAGE</text>';
body += plan(1, 500, 550, 9) + plan(2, 1310, 420, 12);
body +=
  '<text x="980" y="700" class="sub">A : escalier principal · B : escalier de service</text><text x="980" y="733" class="sub">Les deux escaliers relient leurs propres paliers.</text><text x="980" y="778" class="sub">Points rouges : invités au départ (3 + 2 + 3).</text><text x="980" y="811" class="sub">Soirée : salon, salle à manger et terrasse.</text><text x="40" y="884" class="sub">Orange : portes et accès · Bleu : fenêtres escaladables au RDC · Gris : meubles · Jaune : lampes extérieures</text><text x="40" y="918" class="sub">Le bassin et le vide sur le hall bloquent les déplacements. Le jardin reste accessible autour de la maison.</text><text x="40" y="952" class="sub">Ce plan correspond à la version 0.6 du jeu. Les surfaces et les meubles ne sont plus ceux de l’ancienne maison à trois niveaux.</text>';
await fs.mkdir('public/plans', { recursive: true });
const complete = svg(
  body,
  1800,
  980,
  'La villa : RDC avec piscine, terrasse et jardin ; un étage, sans sous-sol',
);
await fs.writeFile('public/plans/actuel.svg', complete);
await fs.writeFile('public/plans/proposition.svg', complete); // Keep the earlier shared URL useful.
for (const f of FLOOR_IDS) {
  const title = FLOORS[f];
  await fs.writeFile(
    `public/plans/niveau-${f}.svg`,
    svg(
      `<text x="30" y="42" class="title">${title.toUpperCase()} — LA VILLA</text>${plan(f, 500, 550, 11)}`,
      1000,
      950,
      title,
    ),
  );
}
await fs.writeFile(
  'public/plans.html',
  `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" type="image/svg+xml" href="/favicon.svg"><title>La villa — plan jouable</title><style>body{margin:0;padding:24px;background:#f5f1e7;color:#17343c;font:16px Arial}p{max-width:1100px;line-height:1.6}nav{display:flex;gap:10px;flex-wrap:wrap;margin:20px 0}button,a{padding:11px;border:1px solid #81948c;border-radius:7px;color:inherit;background:white;cursor:pointer}button[aria-pressed=true]{background:#17343c;color:white}img{width:100%;height:auto}a{display:inline-block}</style><a href="/">← Retour au jeu</a><h1>La villa : le plan maintenant jouable</h1><p><b>Rez-de-chaussée + un étage, sans sous-sol.</b> Le grand salon, la salle à manger et la terrasse accueillent la soirée. Deux escaliers, des portes-fenêtres et le jardin offrent plusieurs itinéraires. La piscine et le vide sur le hall sont des obstacles réels.</p><nav><button data-map="actuel" aria-pressed="true">Vue d’ensemble</button><button data-map="niveau-1" aria-pressed="false">RDC + jardin</button><button data-map="niveau-2" aria-pressed="false">Étage</button></nav><a id="full" href="/plans/actuel.svg" target="_blank"><img id="plan" src="/plans/actuel.svg" alt="Plan exact de la nouvelle villa à deux niveaux"></a><p>Clique sur le dessin pour l’ouvrir en grand. <a href="/plans/actuel.png" download>Télécharger l’image</a></p><script>document.querySelectorAll('[data-map]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-map]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));const src='/plans/'+b.dataset.map+'.svg';document.querySelector('#plan').src=src;document.querySelector('#full').href=src;})</script></html>`,
);
