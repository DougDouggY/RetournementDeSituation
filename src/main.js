import '@fontsource/barlow-condensed/latin-800.css';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-600.css';
import './style.css';
import { GameScene } from './scene.js';
import { Sound, proximityGain } from './audio.js';
import {
  FLOORS,
  regionAt,
  doors,
  hides,
  devices,
  stairs,
  distance,
  roomAt,
  lineClear,
} from '../shared/map.js';
const SOLO_ONLY = import.meta.env.VITE_SOLO_ONLY === '1';
const $ = (s) => document.querySelector(s);
$('#app').innerHTML = `
<div id="world" aria-label="Scène de jeu en trois dimensions"></div><div class="grain"></div><div class="vignette"></div>
<header id="masthead"><a class="brand" href="/" aria-label="Accueil"><span class="brand-symbol">↶</span><span>RDS<span class="brand-sub">UN TRÈS MAUVAIS PLAN</span></span></a><div class="edition"><span class="status-dot"></span> SOLO · HORREUR · MAUVAISES DÉCISIONS <span class="version">V0.8.2 / AMBIANCE NOCTURNE</span></div></header>
<main id="menu"><div class="eyebrow"><span></span> LES CHASSEURS ONT UN PROBLÈME.</div><h1>RETOURNEMENT<br>DE <em>SITUATION</em><span class="title-dot">.</span></h1><p class="tagline">Cette fois, ce sont eux qui vous cherchent.</p><p class="pitch">Entrez sans bruit. Isolez vos cibles.<br>Un corps découvert, et les rôles s’inversent.</p><div class="solo-selection" role="group" aria-label="Personnage solo"><span>VOTRE MASQUE</span><button data-solo-character="0" class="selected" aria-pressed="true">DIAG</button><button data-solo-character="1" aria-pressed="false">Swonni</button></div><button id="solo" class="primary">Solo · vue du dessus <span>↗</span></button><button id="solo-fps" class="primary">Solo · première personne <span>↗</span></button><button id="observe" class="secondary">Observer une partie · tueur IA ↗</button><a class="text-button" href="/plans.html" target="_blank">Voir les plans de la maison ↗</a><details class="coop-options"><summary>Coopération à deux · pour plus tard</summary><div class="menu-actions"><button id="create" class="primary"><span>Créer une partie</span><span>↗</span></button><button id="join-open" class="secondary">Rejoindre une partie <span>+</span></button></div></details><div class="menu-bottom"><button id="settings-open" class="text-button">⚙ &nbsp;Paramètres</button><span>1 JOUEUR <i>·</i> AUCUN CODE REQUIS</span></div><div class="join-panel hidden" id="join-panel"><label for="join-code">CODE D’INVITATION</label><div><input id="join-code" maxlength="6" placeholder="ABC123" autocomplete="off" spellcheck="false"><button id="join" class="primary">Entrer ↗</button></div></div></main>
<div id="scene-caption"><span class="tiny">01 / RÉSIDENCE DES ÉRABLES</span><strong>La soirée vient<br>de mal tourner.</strong><p>Ils étaient venus pour faire peur.<br>Ils vont apprendre à se cacher.</p><div class="caption-line"></div><span class="tiny">QUELQUE PART, BEAUCOUP TROP LOIN DES SECOURS.</span></div>
<footer id="footer"><span>UNE NUIT. UN MASQUE. ZÉRO PLAN B.</span><span>CASQUE CONSEILLÉ <span class="headphone">♬</span></span></footer>
<section id="lobby" class="panel hidden"><div class="eyebrow">LA PORTE EST ENCORE OUVERTE.</div><h2>Bienvenue dans<br>les ennuis.</h2><p>Partagez ce code avec votre partenaire.</p><button id="copy-code" title="Copier le code"><strong id="room-code"></strong><span>Copier ↗</span></button><div class="roles"><button data-character="0"><span class="mask-icon diag">◈</span><strong>DIAG</strong><small>LE MAUVAIS PRESSENTIMENT</small><span class="role-status"></span></button><button data-character="1"><span class="mask-icon swonni">◈</span><strong>Swonni</strong><small>LA PIRE DES BONNES IDÉES</small><span class="role-status"></span></button></div><p id="lobby-status"></p><button id="start" class="primary" disabled>Commencer la nuit <span>↗</span></button><button id="practice" class="text-button">Jouer seul avec ce personnage</button><button id="leave" class="text-button">← Quitter le salon</button><p class="lobby-help">ZQSD / WASD · Marcher &nbsp; E · Interagir<br>Maj · Courir &nbsp; Ctrl / C · S’accroupir &nbsp; F · Lampe</p></section>
<div id="hud" class="hidden"><div class="hud-top"><div class="night"><span class="tiny">TENIR JUSQU’À L’AUBE</span><strong id="timer">09:00</strong><span id="objective"></span><span id="floor-name"></span></div><div class="room-tag"><span id="mode-label">SALON</span> <b id="hud-code"></b><button id="hud-settings" aria-label="Paramètres">☷</button></div></div><div id="observer-controls" class="hidden"><span>VUE GLOBALE · MOLETTE : ZOOM</span><button data-floor="1" aria-pressed="true">RDC</button><button data-floor="2">Étage</button><label>Vue <select id="observe-view"><option value="full">Jardin + maison</option><option value="house">Maison</option><option value="follow">Suivre IA</option></select></label><label>Vitesse <select id="observe-speed"><option value="1">×1</option><option value="2">×2</option><option value="4">×4</option></select></label></div><button id="change-view" class="view-toggle">Changer de vue · F2</button><div id="fps-reticle" class="hidden">+</div><button id="fps-look" class="hidden">Cliquer pour regarder avec la souris</button><div id="team"></div><div id="toast" role="status"></div><div id="dialogue"></div><div id="intro" class="hidden"><div class="eyebrow">ÇA NE SE PASSE PAS COMME PRÉVU.</div><h2>LES PROIES ONT<br>CHANGÉ DE CAMP.</h2><p>Cachez-vous. Ils arrivent dans <b id="intro-count">10</b> secondes.</p></div><div class="hud-bottom"><div class="stealth"><span id="stealth-label">DISCRET</span><div class="meter"><i id="stamina"></i></div><span id="inventory">G · BOUTEILLES × 3</span></div><div id="interaction"></div><div class="control-help"><kbd>E</kbd> interagir <kbd>B</kbd> entrouvrir <kbd>L</kbd> verrouiller <kbd>F</kbd> lampe <kbd>V</kbd> escalader <kbd>Espace</kbd> éliminer <kbd>R</kbd> corps <kbd>X</kbd> nettoyer <kbd>Tab</kbd> équipe</div></div><div id="rescue-bar" class="hidden"><span>DÉTACHER LE PARTENAIRE</span><div class="meter"><i></i></div></div><div id="connection" class="hidden"></div><div id="scoreboard" class="panel hidden"><div class="eyebrow">ON FAIT LE POINT.</div><h2>État de la nuit</h2><div id="scoreboard-content"></div><p id="rules">Survivez 9 minutes. E : portes, cachettes, escaliers et objets.<br>G : lancer une bouteille vers la souris.<br>Capturé ? Votre partenaire dispose de 75 secondes pour vous libérer.<br>Maintenir E à proximité pendant 2,5 secondes.<br>Les paramètres ne mettent pas la partie en pause.</p></div></div>
<section id="end" class="panel hidden"><div class="eyebrow" id="end-eyebrow"></div><h2 id="end-title"></h2><p id="end-text"></p><button id="restart" class="primary">Encore une mauvaise idée ↗</button><button id="end-leave" class="text-button">Retour à l’accueil</button></section>
<dialog id="settings"><button class="close" id="settings-close" aria-label="Fermer">×</button><div class="eyebrow">UN PEU DE CONTRÔLE.</div><h2>Paramètres</h2><label>Ambiance / musique<input id="music" type="range" min="0" max="100" value="22"></label><label>Effets sonores<input id="effects" type="range" min="0" max="100" value="55"></label><label>Voix des invités<input id="voices" type="range" min="0" max="100" value="55"></label><label class="check"><input id="quality" type="checkbox"> Mode performances (sans ombres)</label><p>Deux vues : F2 · première personne : clic pour capturer la souris<br>Déplacement : ZQSD ou WASD / flèches<br>Courir : Maj · S’accroupir : Ctrl ou C<br>V : escalader une fenêtre ouverte<br>E : interagir / maintenir pour sauver · F : lampe<br>X maintenu : nettoyer le sang (3 s)<br>R : corps · E près d’une cachette avec un corps : dissimuler<br>G : lancer · Tab : équipe · Échap : paramètres<br><br>En multijoueur, la nuit continue dans les paramètres.<br>Voix françaises : synthèse vocale du navigateur, si disponible.</p></dialog><div id="error" role="alert" class="hidden"></div>`;
if (SOLO_ONLY) {
  $('.coop-options').classList.add('hidden');
}
let scene;
try {
  scene = new GameScene($('#world'));
} catch (err) {
  $('#error').textContent =
    'WebGL indisponible. Activez l’accélération graphique du navigateur puis rechargez la page.';
  $('#error').classList.remove('hidden');
  throw err;
}
const sound = new Sound();
let ws = null,
  state = null,
  myId = null,
  code = null,
  token = null,
  connected = false,
  joining = false,
  retry = 0,
  retryTimer = null,
  lastStateAt = 0,
  lastEvent = 0,
  lastToastAt = 0,
  angle = 0,
  aimed = false,
  keys = new Set(),
  lastInput = 0,
  lastFrame = performance.now(),
  frames = 0,
  measureAt = performance.now(),
  fps = 0,
  manualLeave = false;
let soloWorker = null,
  soloCharacter = 0;
let settings = null;
try {
  settings = JSON.parse(localStorage.getItem('rds-settings') || 'null');
} catch {
  localStorage.removeItem('rds-settings');
}
if (settings) {
  for (const name of ['music', 'effects', 'voices']) {
    sound.volumes[name] = settings[name] ?? sound.volumes[name];
    $(`#${name}`).value = sound.volumes[name] * 100;
  }
  $('#quality').checked = !!settings.low;
  scene.setQuality(!!settings.low);
}
function showError(message) {
  $('#error').textContent = message;
  $('#error').classList.remove('hidden');
  setTimeout(() => $('#error').classList.add('hidden'), 6500);
}
function send(data) {
  if (soloWorker) {
    soloWorker.postMessage(data);
    return;
  }
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
}
function showSettings() {
  if (document.pointerLockElement) document.exitPointerLock();
  send({ type: 'action', action: 'cancelThrow' });
  keys.clear();
  send({ type: 'input', x: 0, z: 0 });
  $('#settings').showModal();
  if (soloWorker) send({ type: 'pause', paused: true });
}
$('#settings-open').onclick = showSettings;
$('#hud-settings').onclick = showSettings;
$('#settings-close').onclick = () => $('#settings').close();
$('#settings').addEventListener('close', () => {
  if (soloWorker) send({ type: 'pause', paused: document.hidden });
});
for (const name of ['music', 'effects', 'voices'])
  $(`#${name}`).oninput = (e) => {
    sound.volumes[name] = Number(e.target.value) / 100;
    sound.apply();
    saveSettings();
  };
function saveSettings() {
  localStorage.setItem(
    'rds-settings',
    JSON.stringify({ ...sound.volumes, low: $('#quality').checked }),
  );
}
$('#quality').onchange = () => {
  scene.setQuality($('#quality').checked);
  saveSettings();
};
$('#join-open').onclick = () => {
  $('#join-panel').classList.toggle('hidden');
  $('#join-code').focus();
};
$('#join-code').oninput = (e) =>
  (e.target.value = e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ''));
$('#join-code').onkeydown = (e) => {
  if (e.key === 'Enter') $('#join').click();
};
$('#join').onclick = () => {
  const value = $('#join-code').value.trim().toUpperCase();
  if (!/^[A-HJ-NP-Z2-9]{6}$/.test(value)) {
    showError('Entrez le code à 6 caractères de votre partenaire.');
    return;
  }
  connect(value);
};
for (const button of document.querySelectorAll('[data-solo-character]'))
  button.onclick = () => {
    soloCharacter = Number(button.dataset.soloCharacter);
    for (const other of document.querySelectorAll('[data-solo-character]')) {
      const selected = other === button;
      other.classList.toggle('selected', selected);
      other.setAttribute('aria-pressed', String(selected));
    }
  };
function startSolo(observer = false) {
  leave();
  sound.start();
  keys.clear();
  myId = 'solo-player';
  code = 'SOLO';
  connected = true;
  soloWorker = new Worker(new URL('./solo-worker.js', import.meta.url), { type: 'module' });
  soloWorker.onmessage = ({ data }) => {
    state = data;
    lastStateAt = performance.now();
    updateUI();
  };
  soloWorker.onerror = () => {
    leave();
    showError('Le mode solo n’a pas pu démarrer. Rechargez la page et réessayez.');
  };
  scene.observerFloor = 1;
  scene.observerView = 'full';
  $('#observe-view').value = 'full';
  $('#observe-speed').value = '1';
  soloWorker.postMessage({ type: 'init', character: soloCharacter, observer });
}
function setView(fps) {
  scene.firstPerson = fps;
  if (fps && !state) angle = Math.PI / 2;
  scene.lookYaw = angle;
  scene.lookPitch = 0;
  if (!fps && document.pointerLockElement) document.exitPointerLock();
}
$('#solo').onclick = () => {
  setView(false);
  startSolo(false);
};
$('#solo-fps').onclick = () => {
  setView(true);
  startSolo(false);
};
$('#change-view').onclick = () => setView(!scene.firstPerson);
function captureMouse() {
  if (!scene.firstPerson || state?.observer || $('#settings').open) return;
  $('#world')
    .requestPointerLock?.()
    ?.catch(() => {});
}
$('#fps-look').onclick = captureMouse;
$('#world').addEventListener('click', captureMouse);

$('#observe').onclick = () => startSolo(true);
for (const button of document.querySelectorAll('[data-floor]'))
  button.onclick = () => {
    scene.observerFloor = Number(button.dataset.floor);
    if (scene.observerView === 'follow') {
      scene.observerView = 'house';
      $('#observe-view').value = 'house';
    }
    for (const b of document.querySelectorAll('[data-floor]'))
      b.setAttribute('aria-pressed', String(b === button));
  };
$('#observe-view').onchange = (e) => {
  scene.observerView = e.target.value;
};
$('#observe-speed').onchange = (e) => send({ type: 'speed', speed: Number(e.target.value) });
$('#create').onclick = async () => {
  if (joining) return;
  joining = true;
  $('#create').disabled = true;
  sound.start();
  try {
    const res = await fetch('/api/rooms', { method: 'POST' });
    if (!res.ok) throw new Error('Le serveur ne peut pas créer de salon pour le moment.');
    const data = await res.json();
    joining = false;
    connect(data.code);
  } catch (e) {
    joining = false;
    showError(e.message);
  } finally {
    $('#create').disabled = false;
  }
};
function connect(newCode, reconnect = false) {
  if (joining) return;
  joining = true;
  manualLeave = false;
  sound.start();
  code = newCode;
  token = sessionStorage.getItem(`rds-${code}`) || crypto.randomUUID();
  sessionStorage.setItem(`rds-${code}`, token);
  const socket = new WebSocket(
    `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/rooms/${code}/ws?token=${encodeURIComponent(token)}`,
  );
  ws = socket;
  socket.onopen = () => {
    joining = false;
    connected = true;
    retry = 0;
    $('#connection').classList.add('hidden');
  };
  socket.onmessage = (e) => {
    let msg;
    try {
      msg = JSON.parse(e.data);
    } catch {
      return;
    }
    if (msg.type === 'error') {
      manualLeave = true;
      showError(msg.message);
      return;
    }
    if (msg.type === 'welcome') {
      myId = msg.id;
      $('#room-code').textContent = code;
      $('#hud-code').textContent = code;
      history.replaceState(null, '', `?room=${code}`);
    }
    if (msg.type === 'state') {
      state = msg;
      lastStateAt = performance.now();
      updateUI();
    }
  };
  socket.onerror = () => {};
  socket.onclose = (e) => {
    if (socket !== ws) return;
    connected = false;
    joining = false;
    keys.clear();
    if (manualLeave) return;
    if (e.code === 4000 || e.code === 4001) {
      if (!state) leave();
      return;
    }
    if (!state) {
      showError('Salon introuvable ou expiré. Vérifiez le code ou créez une nouvelle partie.');
      return;
    }
    $('#connection').textContent = 'Connexion perdue · reconnexion en cours… (45 s de grâce)';
    $('#connection').classList.remove('hidden');
    if (++retry <= 10)
      retryTimer = setTimeout(() => connect(code, true), Math.min(5000, retry * 800));
    else showError('Reconnexion impossible. Revenez à l’accueil et créez un nouveau salon.');
  };
}
function leave() {
  soloWorker?.terminate();
  soloWorker = null;

  manualLeave = true;
  clearTimeout(retryTimer);
  ws?.close();
  ws = null;
  state = null;
  myId = null;
  code = null;
  joining = false;
  connected = false;
  lastEvent = 0;
  sound.lastEvent = 0;
  sound.spoken.clear();
  if (document.pointerLockElement) document.exitPointerLock();
  history.replaceState(null, '', location.pathname);
  for (const s of ['#lobby', '#hud', '#end']) $(s).classList.add('hidden');
  for (const s of ['#menu', '#scene-caption', '#masthead', '#footer'])
    $(s).classList.remove('hidden');
}
$('#leave').onclick = leave;
$('#end-leave').onclick = leave;
$('#copy-code').onclick = async () => {
  try {
    await navigator.clipboard.writeText(code);
    $('#copy-code span').textContent = 'Copié ✓';
    setTimeout(() => ($('#copy-code span').textContent = 'Copier ↗'), 1500);
  } catch {
    showError(`Code du salon : ${code}`);
  }
};
for (const b of document.querySelectorAll('[data-character]'))
  b.onclick = () => send({ type: 'character', character: Number(b.dataset.character) });
$('#start').onclick = () => {
  sound.start();
  send({ type: 'start' });
};
$('#practice').onclick = () => {
  sound.start();
  send({ type: 'start', practice: true });
};
$('#restart').onclick = () => send({ type: 'start', practice: state.practice });
function setText(selector, text) {
  const el = $(selector);
  if (el.textContent !== text) el.textContent = text;
}
function updateUI() {
  if (!state || !myId) return;
  const me = state.players.find((p) => p.id === myId);
  if (!me) return;
  const lobby = state.phase === 'lobby',
    ended = state.phase === 'ended';
  for (const s of ['#menu', '#scene-caption', '#masthead', '#footer']) $(s).classList.add('hidden');
  $('#lobby').classList.toggle('hidden', !lobby);
  $('#hud').classList.toggle('hidden', lobby);
  $('#observer-controls').classList.toggle('hidden', !state.observer);
  if (state.observer)
    for (const b of document.querySelectorAll('[data-floor]'))
      b.setAttribute('aria-pressed', String(Number(b.dataset.floor) === scene.observerFloor));
  $('.hud-bottom').classList.toggle('hidden', !!state.observer);
  if (state.observer) {
    $('#rescue-bar').classList.add('hidden');
  }
  $('#end').classList.toggle('hidden', !ended);
  if (lobby) {
    for (const b of document.querySelectorAll('[data-character]')) {
      const p = state.players.find((p) => p.character === Number(b.dataset.character));
      b.classList.toggle('selected', p?.id === myId);
      b.querySelector('.role-status').textContent = p
        ? p.id === myId
          ? 'VOUS · PRÊT'
          : 'PARTENAIRE · PRÊT'
        : 'EN ATTENTE';
    }
    const host = state.host === myId;
    $('#start').disabled = !host || state.players.length < 2;
    $('#start').classList.toggle('hidden', !host);
    $('#practice').classList.toggle('hidden', !host || state.players.length !== 1);
    setText(
      '#lobby-status',
      state.players.length < 2
        ? 'Votre partenaire n’est pas encore là.'
        : host
          ? 'Vous êtes deux. C’est déjà trop tard.'
          : 'Le créateur peut lancer la nuit.',
    );
    return;
  }
  setText(
    '#mode-label',
    state.observer ? 'OBSERVATEUR' : state.mode === 'solo' ? 'MODE SOLO' : 'SALON',
  );
  setText('#hud-code', state.observer ? 'TUEUR IA' : state.mode === 'solo' ? '1 JOUEUR' : code);
  setText(
    '#rules',
    state.observer
      ? 'Observation : le tueur est contrôlé par une IA. Les boutons affichent chaque niveau sans masquage des pièces. La lumière d’observation ne modifie pas les lumières ni la détection du jeu. Vitesse ×1, ×2 ou ×4 ; Échap pour suspendre la simulation. Le plan exact des deux niveaux se trouve dans les plans de la maison.'
      : state.mode === 'solo'
        ? 'Entrez depuis le jardin. Éliminez tous les invités ou survivez jusqu’à l’aube. E : portes et cachettes. Maintenir E 2 s : déverrouiller une fenêtre ; V : escalader. Approchez une vitre pour regarder. Coffret électrique dehors : E pour couper le courant. Espace : éliminer un invité isolé à portée. R : traîner / déposer un corps ; E près d’une cachette : dissimuler le corps ; maintenir X 3 s : nettoyer le sang. Maintenir G : viser et charger ; relâcher : lancer. Une attaque fait du bruit. Les invités enquêtent progressivement ; du sang, un corps ou un intrus masqué identifié déclenche la chasse. Échap : pause.'
        : 'Entrez ensemble depuis le jardin. Éliminez les invités ou survivez jusqu’à l’aube. Espace : éliminer une cible isolée ; R : traîner un corps ; E : porte, cachette, escalier ; maintenir E : fenêtre ou sauvetage. Maintenir X 3 s : nettoyer le sang ; E avec un corps près d’une cachette : le dissimuler. Le bruit attire des curieux ; les preuves et le masque déclenchent la chasse.',
  );
  const secs = Math.ceil(state.remaining);
  setText(
    '#timer',
    `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`,
  );
  setText(
    '#objective',
    `${state.phase === 'infiltration' ? (state.tension >= 2 ? 'INVITÉS MÉFIANTS' : state.tension ? 'UN BRUIT SUSPECT' : 'SOIRÉE CALME') : 'CHASSE'} · ${state.living ?? state.guards.length} INVITÉS${state.power === false ? ' · COURANT COUPÉ' : ''}`,
  );
  setText(
    '#floor-name',
    state.observer
      ? `${FLOORS[scene.observerFloor ?? 1]} · Toute la carte visible`
      : `${FLOORS[me.f]} · ${roomAt(me.f, me.x, me.z)?.name || (regionAt(me.f, me.x, me.z) === 'outside' ? 'Jardin / terrasse' : 'Hall')}`,
  );
  $('#intro').classList.toggle('hidden', state.phase !== 'intro');
  setText('#intro-count', String(Math.max(0, Math.ceil(10 - state.time))));
  const team = $('#team');
  if (team.children.length !== state.players.length) {
    team.replaceChildren(
      ...state.players.map((p) => {
        const el = document.createElement('div');
        el.className = 'teammate';
        el.innerHTML =
          '<span class="team-marker"></span><div><strong></strong><span></span><div class="health"></div></div>';
        el.dataset.id = p.id;
        return el;
      }),
    );
  }
  for (const p of state.players) {
    const el = [...team.children].find((e) => e.dataset.id === p.id);
    el.classList.toggle('danger', p.status !== 'free');
    el.querySelector('strong').textContent =
      (p.character === 0 ? 'DIAG' : 'Swonni') +
      (p.id === myId ? (state.observer ? ' · IA' : ' · VOUS') : '');
    el.querySelector('span:not(.team-marker)').textContent = !p.connected
      ? 'DÉCONNECTÉ'
      : p.status === 'captured'
        ? `CAPTURÉ · ${Math.ceil(p.bleed)} s`
        : p.status === 'eliminated'
          ? 'ÉLIMINÉ'
          : p.hidden
            ? 'À COUVERT'
            : p.running
              ? 'EN FUITE'
              : 'EN VIE';
    el.querySelector('.health').textContent = '━ '.repeat(Math.max(0, p.hp));
    el.querySelector('.team-marker').style.background = p.character === 0 ? '#d2ad6c' : '#87c5bc';
  }
  const chasing = state.guards.some((g) => g.state === 'chase' && g.target === myId);
  setText(
    '#stealth-label',
    me.status === 'captured'
      ? 'CAPTURÉ · ATTENDEZ VOTRE PARTENAIRE'
      : me.status === 'eliminated'
        ? 'ÉLIMINÉ · VOUS OBSERVEZ LA PIÈCE'
        : me.hidden
          ? 'À COUVERT · PAS INVISIBLE'
          : chasing
            ? 'REPÉRÉ · COUREZ !'
            : me.torch
              ? 'LAMPE ALLUMÉE · VISIBLE'
              : me.running
                ? 'BRUYANT'
                : me.crouching
                  ? 'PAS FEUTRÉS'
                  : 'DISCRET',
  );
  $('#stealth-label').classList.toggle('alert', chasing || me.status === 'captured');
  $('#stamina').style.width = `${me.stamina}%`;
  setText(
    '#inventory',
    `G · BOUTEILLES × ${me.bottles}   /   F · LAMPE ${me.torch ? 'ON' : 'OFF'}`,
  );
  setText('#interaction', interaction(me));
  $('#rescue-bar').classList.toggle('hidden', !me.rescue && !me.openProgress && !me.cleanProgress);
  $('#rescue-bar span').textContent = me.cleanProgress
    ? 'NETTOYER LE SANG'
    : me.openProgress
      ? 'DÉVERROUILLER LA FENÊTRE'
      : 'DÉTACHER LE PARTENAIRE';
  $('#rescue-bar i').style.width =
    `${(me.cleanProgress ? me.cleanProgress / 3 : me.openProgress ? me.openProgress / 2 : me.rescue / 2.5) * 100}%`;
  const sb = $('#scoreboard-content');
  sb.replaceChildren(
    ...state.players.map((p) => {
      const el = document.createElement('p');
      el.textContent = `${p.character === 0 ? 'DIAG' : 'Swonni'} — ${FLOORS[p.f]} · ${p.status === 'free' ? 'Libre' : p.status === 'captured' ? 'Capturé' : 'Éliminé'}`;
      return el;
    }),
  );
  if (state.paused) {
    $('#connection').textContent =
      state.mode === 'solo'
        ? 'Solo en pause · reprenez la partie en fermant les paramètres.'
        : 'Partenaire déconnecté · nuit suspendue pendant la reconnexion (45 s maximum).';
    $('#connection').classList.remove('hidden');
  } else if (connected) $('#connection').classList.add('hidden');
  for (const e of state.events) {
    if (e.id <= lastEvent) continue;
    lastEvent = e.id;
    if (e.type === 'hurt' && e.player === myId) {
      $('#hud').classList.add('hurt');
      setTimeout(() => $('#hud').classList.remove('hurt'), 350);
    }
    if (
      [
        'hunt',
        'infiltration',
        'kill',
        'clean',
        'stash',
        'suspicion',
        'warning',
        'drag',
        'drop',
        'capture',
        'rescue',
        'eliminate',
        'pickup',
        'stairs',
      ].includes(e.type) &&
      (!e.player || e.player === myId || e.type === 'capture' || e.type === 'rescue')
    ) {
      setText('#toast', e.text);
      lastToastAt = performance.now();
      $('#toast').classList.add('show');
    }
    if (e.type === 'voice' && proximityGain(e, me, state.doors) >= 0.025) {
      setText('#dialogue', e.text);
      $('#dialogue').classList.add('show');
      setTimeout(() => $('#dialogue').classList.remove('show'), 3200);
    }
  }
  if (ended) {
    const win = state.result !== 'defeat';
    setText('#end-eyebrow', win ? '05:47 / LE JOUR SE LÈVE.' : 'LA SOIRÉE EST TERMINÉE.');
    setText(
      '#end-title',
      state.result === 'elimination'
        ? 'Plus un bruit.'
        : state.result === 'solo'
          ? 'Vous avez tenu.'
          : state.result === 'perfect'
            ? 'Vivants. Tous les deux.'
            : win
              ? 'L’un de vous a tenu.'
              : 'Mauvais quartier.',
    );
    setText(
      '#end-text',
      state.result === 'elimination'
        ? 'Tous les invités sont éliminés. Vous avez repris la maison.'
        : state.result === 'solo'
          ? 'Victoire solo. Un masque, huit poursuivants, et vous avez vu l’aube.'
          : state.result === 'perfect'
            ? 'Victoire coopérative parfaite. Ils ne vous inviteront plus jamais.'
            : win
              ? 'Victoire individuelle imparfaite. Il manque quelqu’un sur la photo.'
              : 'Les invités ont repris la maison. Les tueurs ont perdu la face.',
    );
    if (state.observer) {
      setText(
        '#end-title',
        state.result === 'defeat'
          ? 'Le tueur IA a été capturé.'
          : state.result === 'elimination'
            ? 'Le tueur IA a éliminé les invités.'
            : 'Le tueur IA a tenu jusqu’à l’aube.',
      );
      setText(
        '#end-text',
        'Fin de la simulation. Relancez une observation pour voir une nouvelle partie.',
      );
    }
    $('#restart').disabled = state.host !== myId;
  }
  sound.update(state, me);
}
function interaction(p) {
  if (p.status !== 'free') return '';
  if (p.charging)
    return `Relâcher G · Lancer la bouteille · puissance ${Math.round(p.throwCharge * 100)} % (maximum 12 m)`;
  if (p.hidden) return 'E · Sortir de la cachette';
  if (p.climb) return 'Escalade en cours…';
  if (p.cleaning) return 'Maintenir X · Nettoyer le sang (3 s)';
  if (p.dragging) {
    const hide = hides.find(
      (h) => h.f === p.f && distance(p, h) < 1.55 && lineClear(p.f, p, h, state.doors, true, false),
    );
    return hide
      ? 'E · Dissimuler le corps dans la cachette · R : déposer'
      : 'R · Déposer le corps · E pour les portes';
  }
  const blood = state.blood?.find(
    (b) => b.f === p.f && distance(p, b) < 1.7 && lineClear(p.f, p, b, state.doors, false, false),
  );
  if (blood) return 'Maintenir X · Nettoyer le sang (3 s) · R : corps à proximité';
  const target = state.guards.find(
    (g) =>
      g.alive !== false &&
      g.f === p.f &&
      distance(p, g) < 1.6 &&
      lineClear(p.f, p, g, state.doors, false, false),
  );
  if (target) {
    const watched = state.guards.some(
      (g) =>
        g !== target &&
        g.alive !== false &&
        g.f === target.f &&
        distance(g, target) < 6 &&
        lineClear(g.f, g, target, state.doors),
    );
    return watched
      ? 'Cible surveillée · attendez qu’elle soit isolée'
      : 'Espace · Éliminer la cible isolée';
  }
  if (
    state.bodies?.some(
      (b) =>
        !b.draggedBy &&
        b.f === p.f &&
        distance(p, b) < 1.9 &&
        lineClear(p.f, p, b, state.doors, false, false),
    )
  )
    return 'R · Traîner le corps · X maintenu : nettoyer le sang';
  const mate = state.players.find(
    (o) => o.id !== p.id && o.f === p.f && o.status === 'captured' && distance(p, o) < 1.7,
  );
  if (mate) return 'Maintenir E · Détacher votre partenaire';
  const near = [];
  for (const [kind, list, range] of [
    ['door', doors, 1.9],
    ['hide', hides, 1.55],
    ['stairs', stairs, 1.8],
    ['device', devices, 1.45],
  ])
    for (const obj of list)
      if (
        obj.f === p.f &&
        distance(p, obj) < range &&
        (kind !== 'stairs' || obj.to !== null) &&
        lineClear(
          p.f,
          p,
          obj,
          kind === 'door' ? { ...state.doors, [obj.id]: true } : state.doors,
          true,
          !!obj.window,
        )
      )
        near.push({ obj, kind, dist: distance(p, obj) });
  const n = near.sort((a, b) => a.dist - b.dist)[0];
  if (!n) return '';
  const { obj, kind } = n;
  return kind === 'door'
    ? obj.window
      ? state.doors[obj.id]
        ? 'V · Escalader la fenêtre · E : refermer'
        : 'Maintenir E · Déverrouiller (2 s), puis V : escalader'
      : `${state.doorLocks?.[obj.id] ? 'VERROUILLÉE · L : déverrouiller de l’intérieur' : 'L : verrouiller de l’intérieur'} · E · ${state.doors[obj.id] === 'ajar' ? 'Ouvrir complètement' : state.doors[obj.id] ? 'Fermer' : 'Ouvrir'} la porte${!obj.patio ? ' · B : entrouvrir / refermer' : ''}`
    : kind === 'hide'
      ? 'E · Se cacher'
      : kind === 'stairs'
        ? `E · ${obj.to > p.f ? 'Monter' : 'Descendre'}`
        : {
            light: 'E · Interrupteur',
            tv: 'E · Allumer la télévision',
            alarm: 'E · Déclencher le réveil',
            breaker: 'E · Disjoncteur',
            bottles: 'E · Reprendre des bouteilles',
          }[obj.type];
}
window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return;
  if (
    state &&
    ['intro', 'playing', 'infiltration'].includes(state.phase) &&
    [
      'Tab',
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'ControlLeft',
      'ControlRight',
      'Space',
    ].includes(e.code)
  )
    e.preventDefault();
  if (e.code === 'Escape') {
    if (!$('#settings').open) {
      e.preventDefault();
      showSettings();
    }
    return;
  }
  if ($('#settings').open) return;
  if (e.code === 'F2' && state && !state.observer) {
    e.preventDefault();
    setView(!scene.firstPerson);
    return;
  }
  if (state?.observer && e.code !== 'Tab') return;
  if (e.code === 'Tab') {
    $('#scoreboard').classList.remove('hidden');
    return;
  }
  keys.add(e.code);
  transmitInput();
  if (e.repeat) return;
  if (e.code === 'KeyE') send({ type: 'action', action: 'interact' });
  if (e.code === 'KeyF') send({ type: 'action', action: 'torch' });
  if (e.code === 'Space') send({ type: 'action', action: 'attack' });
  if (e.code === 'KeyB') send({ type: 'action', action: 'ajar' });
  if (e.code === 'KeyL') send({ type: 'action', action: 'lock' });
  if (e.code === 'KeyV') send({ type: 'action', action: 'climb' });
  if (e.code === 'KeyR') send({ type: 'action', action: 'drag' });
  if (e.code === 'KeyG') send({ type: 'action', action: 'charge' });
});
window.addEventListener('keyup', (e) => {
  const wasHeld = keys.has(e.code);
  keys.delete(e.code);
  if (wasHeld && e.code === 'KeyG' && !state?.observer && !$('#settings').open)
    send({ type: 'action', action: 'throw' });
  transmitInput();
  if (e.code === 'Tab') {
    $('#scoreboard').classList.add('hidden');
    e.preventDefault();
  }
});
window.addEventListener('blur', () => {
  send({ type: 'action', action: 'cancelThrow' });
  keys.clear();
  send({ type: 'input', x: 0, z: 0 });
});
document.addEventListener('visibilitychange', () => {
  if (soloWorker) {
    send({ type: 'pause', paused: document.hidden || $('#settings').open });
  }
  if (document.hidden) {
    keys.clear();
    send({ type: 'input', x: 0, z: 0 });
  }
});
window.addEventListener('mousemove', (e) => {
  const me = state?.players.find((p) => p.id === myId);
  if (me) {
    if (scene.firstPerson && !state.observer) {
      if ($('#settings').open || (!document.pointerLockElement && e.buttons !== 1)) return;
      scene.lookYaw -= e.movementX * 0.0025;
      scene.lookPitch = Math.max(-1.2, Math.min(1.2, scene.lookPitch - e.movementY * 0.0025));
      angle = scene.lookYaw;
    } else angle = scene.aim(e.clientX, e.clientY, me);
    aimed = true;
  }
});
const held = (...codes) => codes.some((c) => keys.has(c));
function transmitInput() {
  if (
    !state ||
    state.observer ||
    !['intro', 'playing', 'infiltration'].includes(state.phase) ||
    !connected
  )
    return;
  lastInput = performance.now();
  const blocked = $('#settings').open;
  let x = blocked
      ? 0
      : Number(held('KeyD', 'ArrowRight')) - Number(held('KeyA', 'KeyQ', 'ArrowLeft')),
    z = blocked ? 0 : Number(held('KeyS', 'ArrowDown')) - Number(held('KeyW', 'KeyZ', 'ArrowUp'));
  if (scene.firstPerson) {
    const sideways = x,
      forward = -z;
    x = Math.sin(angle) * forward - Math.cos(angle) * sideways;
    z = Math.cos(angle) * forward + Math.sin(angle) * sideways;
  } else if (!aimed && (x || z)) angle = Math.atan2(x, z);
  send({
    type: 'input',
    x,
    z,
    angle,
    run: !blocked && held('ShiftLeft', 'ShiftRight'),
    crouch: !blocked && held('ControlLeft', 'ControlRight', 'KeyC'),
    use: !blocked && held('KeyE'),
    clean: !blocked && held('KeyX'),
  });
}
function frame(now) {
  const dt = Math.min(0.08, (now - lastFrame) / 1000);
  lastFrame = now;
  frames++;
  if (now - measureAt > 1000) {
    fps = Math.round((frames * 1000) / (now - measureAt));
    frames = 0;
    measureAt = now;
  }
  if (now - lastInput > 50) transmitInput();
  if (now - lastToastAt > 4500) $('#toast').classList.remove('show');
  const fpsView = !!state && scene.firstPerson && !state.observer;
  $('#fps-reticle').classList.toggle('hidden', !fpsView);
  $('#fps-look').classList.toggle(
    'hidden',
    !fpsView || !!document.pointerLockElement || $('#settings').open || state.phase === 'ended',
  );
  $('#change-view').classList.toggle('hidden', !state || !!state.observer);
  scene.update(state, myId, dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
// Read-only diagnostics for tests and performance inspection; no simulation controls exposed.
Object.defineProperty(window, '__RDS', {
  get: () => ({
    state,
    myId,
    connected,
    fps,
    roomLights: Object.fromEntries([...scene.lightMeshes].map(([id, l]) => [id, l.intensity])),
    gardenLights: scene.gardenLights.map((l) => l.intensity),
    windowLights: [...scene.windowGlass].map(([id, g]) => ({
      id,
      emission: g.mesh.material.emissiveIntensity,
    })),
    observerFloor: scene.observerFloor ?? 1,
    viewMode: scene.firstPerson && !state?.observer ? 'first-person' : 'top',
    eye: {
      x: scene.fpsCamera.position.x,
      y: scene.fpsCamera.position.y,
      z: scene.fpsCamera.position.z,
      yaw: scene.lookYaw,
      pitch: scene.lookPitch,
    },
    fixtures: scene.fixtureMeshes.map((f) => ({
      room: f.room,
      intensity: f.mesh.material.emissiveIntensity,
    })),
    observerZoom: scene.camera.zoom,
    observerLight: scene.observerLight.intensity,
    ambientLight: scene.ambientLight.intensity,
    moonLight: scene.moon.intensity,
    renderedLights: scene.localLights.map((l) => l.intensity),
    doorLeaves: Object.fromEntries(
      [...scene.doorMeshes]
        .filter(([, p]) => !p.userData.sliding)
        .map(([id, p]) => [
          id,
          {
            angle: p.rotation.y - p.userData.baseAngle,
            opaque: p.children.filter((m) => m.isMesh).every((m) => !m.material.transparent),
          },
        ]),
    ),
    aimVisible: !!scene.throwAim?.visible,
    windowSlides: Object.fromEntries(
      [...scene.doorMeshes]
        .filter(([, p]) => p.userData.sliding)
        .map(([id, p]) => [
          id,
          { height: p.position.y, angle: p.rotation.y, baseAngle: p.userData.baseAngle },
        ]),
    ),
    visibleRooms: scene.visibleRooms ? [...scene.visibleRooms] : [],
    visibleGuards: [...scene.actors]
      .filter(([id, a]) => id.startsWith('g') && a.root.visible)
      .map(([id]) => id),
    activePointLights: (() => {
      let count = 0;
      scene.scene.traverseVisible((o) => {
        if (o.isPointLight) count++;
      });
      return count;
    })(),
    gpuPrograms: scene.renderer.info.programs.length,
    drawCalls: scene.renderer.info.render.calls,
    triangles: scene.renderer.info.render.triangles,
  }),
});
const invitation = new URLSearchParams(location.search).get('room');
if (invitation && !SOLO_ONLY) {
  $('#join-panel').classList.remove('hidden');
  $('#join-code').value = invitation.toUpperCase();
}
