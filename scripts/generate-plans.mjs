import fs from 'node:fs/promises';
import {
  rooms,
  walls,
  doors,
  props,
  stairs,
  devices,
  roomFloorParts,
  FLOORS,
} from '../shared/map.js';
const esc = (s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;');
const head = (w, h, title) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${title}"><style>text{font-family:Arial,sans-serif;fill:#172d35}.title{font-size:28px;font-weight:bold}.sub{font-size:14px;fill:#52656b}.name{font-size:13px;font-weight:bold;text-anchor:middle}.small{font-size:11px;text-anchor:middle}</style><rect width="100%" height="100%" fill="#f4f1e9"/>`;
let svg = head(1500, 690, 'Plan actuel : sous-sol, rez-de-chaussée et étage');
svg +=
  '<text x="35" y="43" class="title">MAISON ACTUELLE — 3 niveaux, dont un sous-sol</text><text x="35" y="70" class="sub">Plan extrait du jeu : murs, renfoncements, portes, fenêtres, meubles et escaliers réels. Maison : 36 × 24 m.</text>';
for (let f = 0; f < 3; f++) {
  const ox = 250 + f * 490,
    oy = 365,
    k = 11.3,
    X = (x) => ox + x * k,
    Z = (z) => oy + z * k;
  svg += `<text x="${ox}" y="113" class="name" style="font-size:22px">${FLOORS[f]}</text>`;
  if (f === 1)
    svg += `<rect x="${X(-21.5)}" y="${Z(-15.5)}" width="${43 * k}" height="${31 * k}" rx="15" fill="#d9e3cc"/><text x="${ox}" y="${Z(-14)}" class="small">JARDIN ACTUEL · pas de piscine</text>`;
  svg += `<rect x="${X(-18)}" y="${Z(-12)}" width="${36 * k}" height="${24 * k}" fill="#d6cdb8"/>`;
  for (const r of rooms.filter((r) => r.f === f)) {
    for (const p of roomFloorParts(r))
      svg += `<rect x="${X(p.x - p.w / 2)}" y="${Z(p.z - p.d / 2)}" width="${p.w * k}" height="${p.d * k}" fill="${f === 1 && r.name === 'Salon' ? '#ead69f' : '#ece5d6'}"/>`;
    const words = r.name.split(' '),
      txt = r.name.length > 18 ? [words.slice(0, -1).join(' '), words.at(-1)] : [r.name];
    txt.forEach(
      (t, i) =>
        (svg += `<text x="${X(r.x)}" y="${Z(r.z) - 5 + i * 15}" class="name">${esc(t)}</text>`),
    );
    svg += `<text x="${X(r.x)}" y="${Z(r.z) + 27}" class="small">${r.w} × ${r.d} m${r.cutout ? ' · en L' : ''}</text>`;
  }
  for (const p of props.filter((p) => p.f === f && p.solid && p.room !== 'outside'))
    svg += `<rect x="${X(p.x - p.w / 2)}" y="${Z(p.z - p.d / 2)}" width="${p.w * k}" height="${p.d * k}" fill="#8b8170" opacity=".38" rx="2"/>`;
  for (const w of walls.filter((w) => w.f === f))
    svg += `<rect x="${X(w.x - w.w / 2)}" y="${Z(w.z - w.d / 2)}" width="${Math.max(2, w.w * k)}" height="${Math.max(2, w.d * k)}" fill="#233c43"/>`;
  for (const d of doors.filter((d) => d.f === f))
    svg += `<rect x="${X(d.x - d.w / 2)}" y="${Z(d.z - d.d / 2)}" width="${Math.max(4, d.w * k)}" height="${Math.max(4, d.d * k)}" fill="${d.window ? '#2c9bb1' : '#ce8b3d'}"/>`;
  for (const st of stairs.filter((st) => st.f === f && st.to !== null))
    svg += `<text x="${X(st.x)}" y="${Z(0) + 4}" class="name" style="fill:#9a4f28">${st.to > f ? '↑' : '↓'}</text>`;
  svg += `<text x="${ox}" y="${Z(0) + 4}" class="small">COULOIR · 4 m</text>`;
  for (const d of devices.filter((d) => d.f === f && d.type === 'breaker'))
    svg += `<circle cx="${X(d.x)}" cy="${Z(d.z)}" r="5" fill="#bf4741"/>`;
}
svg +=
  '<text x="40" y="630" class="sub">Orange : portes · Bleu : fenêtres · Flèches : escaliers · Rouge : coffret électrique · Gris : meubles</text><text x="40" y="657" class="sub">Les dimensions indiquent l’enveloppe de chaque pièce ; les entrées en L réduisent sa surface. Le futur plan ci-dessous reste à discuter.</text></svg>';
await fs.writeFile('public/plans/actuel.svg', svg);
svg = head(
  1450,
  1000,
  'Proposition : grande maison avec rez-de-chaussée, un étage, terrasse et piscine',
);
svg +=
  '<text x="35" y="43" class="title">PROPOSITION À DISCUTER — RDC + 1 étage, sans sous-sol</text><text x="35" y="70" class="sub">Esquisse de gameplay, pas encore la maison jouable. Volumes plus grands, pièces en L, deux escaliers et circulation en boucle.</text>';
const rect = (x, y, w, h, name, color = '#e8dfca') =>
  `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${color}" stroke="#34474b" stroke-width="3"/><text x="${x + w / 2}" y="${y + h / 2 - 3}" class="name">${name}</text></g>`;
svg +=
  '<text x="355" y="115" class="name" style="font-size:22px">REZ-DE-CHAUSSÉE + JARDIN</text><text x="1100" y="115" class="name" style="font-size:22px">ÉTAGE</text>';
svg += rect(40, 140, 650, 690, '', '#dce6ce');
svg += rect(230, 165, 330, 110, 'PISCINE', '#91cbd4');
svg += rect(110, 295, 520, 100, 'TERRASSE · BAR · INVITÉS', '#d8c49c');

svg += rect(320, 420, 175, 140, 'SALLE À MANGER', '#ead087');
svg += rect(495, 420, 155, 140, 'CUISINE · VERRES');
svg += rect(80, 590, 170, 145, 'BUREAU / BIBLIOTHÈQUE');
svg += rect(250, 590, 235, 145, 'HALL · ESCALIER PRINCIPAL', '#d6cdb8');
svg += rect(485, 590, 165, 85, 'WC / VESTIAIRE');
svg += rect(485, 675, 165, 125, 'GARAGE / BUANDERIE');
svg += rect(250, 735, 235, 65, 'ENTRÉE / PORCHE');
svg +=
  '<path d="M320 560H495V590H485V650H250V590H320Z" fill="#d6cdb8" stroke="#34474b" stroke-width="3"/>';
svg +=
  '<path d="M80 420H320V560H390V635H250V590H80Z" fill="#ead087" stroke="#34474b" stroke-width="3"/><text x="200" y="500" class="name">GRAND SALON EN L · SOIRÉE</text>';
svg +=
  '<path d="M570 560V590M320 500H335M490 500H505M380 610H400M240 650H260M575 665V685M365 725V745M475 630H495M475 760H495" stroke="#ce8b3d" stroke-width="15"/>';
svg += '<path d="M150 420H270M370 420H450M535 420H610" stroke="#2c9bb1" stroke-width="9"/>';
svg += '<path d="M210 415V395M410 415V395" stroke="#ce8b3d" stroke-width="23"/>';
svg +=
  '<text x="575" y="578" class="small">↑ ESC. DE SERVICE</text><circle cx="665" cy="727" r="8" fill="#bf4741"/><text x="365" y="854" class="sub" text-anchor="middle">Façade élargie · ordre de grandeur : 50 × 32 m</text>';
svg += rect(790, 190, 240, 180, 'SUITE PRINCIPALE');
svg += rect(1055, 190, 110, 80, 'S. DE BAINS');
svg += rect(1190, 190, 200, 180, 'CHAMBRE D’AMIS');
svg += rect(790, 410, 200, 165, 'CHAMBRE / BUREAU');
svg += rect(990, 410, 200, 165, 'CHAMBRE');
svg += rect(1190, 410, 200, 100, 'SALLE DE BAINS / WC');
svg += rect(1190, 510, 200, 65, 'LINGERIE');
svg += rect(790, 370, 600, 40, 'PALIER · CIRCULATION EN BOUCLE', '#d6cdb8');
svg +=
  rect(1055, 295, 110, 75, 'VIDE SUR HALL', '#c7d9d9') +
  rect(1030, 270, 160, 25, '', '#d6cdb8') +
  rect(1030, 295, 25, 75, '', '#d6cdb8') +
  rect(1165, 295, 25, 75, '', '#d6cdb8');
svg +=
  '<path d="M885 365V420M1080 405V420M1270 365V420M1110 260V280M1020 335H1040" stroke="#ce8b3d" stroke-width="15"/><text x="870" y="610" class="name">↑↓ Escalier principal</text><text x="1090" y="397" class="name">↑↓</text><text x="1280" y="610" class="name">↑↓ Escalier de service</text><text x="1330" y="397" class="name">↑↓</text>';
svg +=
  '<text x="790" y="680" class="sub">Intentions à choisir ensemble :</text><text x="790" y="712" class="sub">• Soirée répartie entre salon, terrasse et bar.</text><text x="790" y="744" class="sub">• Cuisine et toilettes : sorties occasionnelles, 1 ou 2 invités.</text><text x="790" y="776" class="sub">• Coffret dehors, près du garage : une réparation crée un détour.</text><text x="790" y="808" class="sub">• Deux escaliers : fuite possible sans impasse systématique.</text><text x="790" y="840" class="sub">• Fenêtres utilisables au RDC ; grandes baies vers la terrasse.</text><text x="40" y="920" class="sub">Orange : accès envisagés · Bleu : vitrages · Rouge : coffret. Les ouvertures, dimensions et meubles restent à ajuster.</text><text x="40" y="952" class="sub">Ce dessin sert à dire ce qu’on garde, déplace ou supprime. La piscine et ce nouveau plan ne sont pas encore intégrés au jeu.</text></svg>';
await fs.writeFile('public/plans/proposition.svg', svg);
await fs.writeFile(
  'public/plans.html',
  `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" type="image/svg+xml" href="/favicon.svg"><title>Plans de la maison — RDS</title><style>body{margin:0;background:#f4f1e9;color:#17343c;font:16px Arial;padding:24px}h1{margin:12px 0}nav{display:flex;gap:12px;flex-wrap:wrap;margin:20px 0}button,a{padding:12px;border-radius:8px;border:1px solid #879b99;color:inherit;background:white;cursor:pointer}button[aria-pressed=true]{background:#17343c;color:white}img{width:100%;height:auto;background:white}section[hidden]{display:none}p{max-width:1000px;line-height:1.6}</style><a href="/">← Retour au jeu</a><h1>Discutons du plan de la maison</h1><p>La maison actuelle comprend un <b>sous-sol, un rez-de-chaussée et un étage</b>. La proposition retire le sous-sol et agrandit les espaces, avec une terrasse, une piscine et une soirée entre intérieur et extérieur. Elle reste une esquisse à discuter.</p><nav><button aria-pressed="true" data-id="current">Plan actuel · 3 niveaux</button><button aria-pressed="false" data-id="proposed">Proposition · RDC + 1</button></nav><section id="current"><img src="/plans/actuel.svg" alt="Plan exact des trois niveaux actuels"><p><a href="/plans/actuel.svg" download>Télécharger le plan actuel</a></p></section><section id="proposed" hidden><img src="/plans/proposition.svg" alt="Proposition de grande maison à deux niveaux avec terrasse et piscine"><p><b>Pas encore jouable :</b> indique les pièces à conserver, déplacer ou supprimer, et les accès qui t’intéressent. <a href="/plans/proposition.svg" download>Télécharger la proposition</a></p></section><script>document.querySelectorAll('button').forEach(b=>b.onclick=()=>{document.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b));document.querySelectorAll('section').forEach(s=>s.hidden=s.id!==(b.dataset.id==='current'?'current':'proposed'))})</script></html>`,
);
