import {
  NIGHT,
  rooms,
  doors,
  hides,
  devices,
  stairs,
  props,
  blocked,
  distance,
  pathfind,
  lineClear,
  roomAt,
} from './map.js';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const names = ['Léa', 'Tony « la poêle »', 'Max', 'Sofia', 'Hugo', 'Camille', 'Sam', 'Nora'];
const personalities = [
  'chef',
  'impulsif',
  'courageux',
  'prudent',
  'méthodique',
  'impulsif',
  'méthodique',
  'prudent',
];
export class Simulation {
  constructor({ duration = NIGHT, seed = 2701 } = {}) {
    this.duration = duration;
    this.seed = seed;
    this.phase = 'lobby';
    this.time = 0;
    this.remaining = duration;
    this.players = [];
    this.guards = [];
    this.doorStates = Object.fromEntries(doors.map((d) => [d.id, false]));
    this.lightStates = Object.fromEntries(rooms.map((r) => [r.id, true]));
    this.noises = [];
    this.events = [];
    this.eventId = 0;
    this.visits = {};
    this.thrown = [];
    this.practice = false;
  }
  random() {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  event(type, text, extra = {}) {
    this.events.push({ id: ++this.eventId, type, text, at: this.time, ...extra });
    this.events = this.events.slice(-18);
  }
  addPlayer(id, character = 0) {
    if (this.phase !== 'lobby') return null;
    if (this.players.length >= 2 || this.players.some((p) => p.id === id)) return null;
    const p = {
      id,
      character,
      x: -12 + this.players.length * 2,
      z: -3.8,
      f: 1,
      angle: 0,
      hp: 3,
      status: 'free',
      hidden: null,
      torch: false,
      stamina: 100,
      bottles: 3,
      input: {},
      connected: true,
      invuln: 0,
      rescue: 0,
      step: 0,
      noise: 0,
    };
    this.players.push(p);
    return p;
  }
  start(practice = false) {
    if (this.phase !== 'lobby' && this.phase !== 'ended') return false;
    if (this.players.length < 2 && !practice) return false;
    this.practice = practice;
    this.solo = practice && this.players.length === 1;
    this.phase = 'intro';
    this.time = 0;
    this.remaining = this.duration;
    this.result = null;
    this.guards = [];
    this.noises = [];
    this.events = [];
    this.visits = {};
    this.thrown = [];
    this.doorStates = Object.fromEntries(doors.map((d) => [d.id, false]));
    this.lightStates = Object.fromEntries(rooms.map((r) => [r.id, true]));
    this.players.forEach((p, i) =>
      Object.assign(p, {
        x: -12 + i * 2,
        z: -3.8,
        f: 1,
        hp: 3,
        status: 'free',
        hidden: null,
        torch: false,
        stamina: 100,
        bottles: 3,
        invuln: 0,
        input: {},
        rescue: 0,
        bleed: 0,
      }),
    );
    const spawns = [
      [-13, -8],
      [-8, -8],
      [0, -9],
      [4, -8],
      [10, -8],
      [14, -8],
      [-10, 9],
      [10, 9],
    ];
    for (let i = 0; i < 8; i++) {
      let [x, z] = spawns[i];
      if (blocked(1, x, z, this.doorStates)) {
        x = -14 + i * 4;
        z = 0;
      }
      this.guards.push({
        id: `g${i}`,
        name: names[i],
        personality: personalities[i],
        x,
        z,
        f: 1,
        angle: 0,
        state: 'patrol',
        path: [],
        think: 1 + i * 0.3,
        target: null,
        last: null,
        search: 0,
        attack: 0,
        say: '',
        sayUntil: 0,
        inspection: 0,
      });
    }
    this.event(
      'intro',
      this.solo
        ? 'ATTENDEZ… IL EST TOUT SEUL ! ON EST HUIT, BORDEL !'
        : 'ATTENDEZ… ILS SONT QUE DEUX ! ON EST HUIT, BORDEL !',
    );
    return true;
  }
  setInput(id, data) {
    const p = this.players.find((p) => p.id === id);
    if (!p) return;
    p.input = {
      x: clamp(Number(data.x) || 0, -1, 1),
      z: clamp(Number(data.z) || 0, -1, 1),
      angle: Number.isFinite(data.angle) ? data.angle : 0,
      run: !!data.run,
      crouch: !!data.crouch,
      use: !!data.use,
    };
  }
  noise(f, x, z, radius, text, source) {
    const n = { id: ++this.eventId, f, x, z, radius, text, at: this.time, source };
    this.noises.push(n);
    this.event('noise', text, { f, x, z });
    for (const g of this.guards)
      if (g.f === f && g.state !== 'chase' && g.state !== 'escort') {
        const clear = lineClear(f, g, n, this.doorStates, true),
          range = radius * (clear ? 1 : 0.45);
        if (distance(g, n) < range) {
          g.last = { x, z, f };
          g.state = 'suspicion';
          g.think = 0;
          g.target = null;
          g.search = 5;
        }
      }
  }
  interact(id) {
    const p = this.players.find((p) => p.id === id);
    if (!p || p.status !== 'free' || !['intro', 'playing'].includes(this.phase)) return;
    if (p.hidden) {
      p.hidden = null;
      p.invuln = Math.max(p.invuln, 0.4);
      if (p.input.run) this.noise(p.f, p.x, p.z, 8, 'Une sortie tout sauf discrète.', p.id);
      return;
    }
    const nearby = this.nearby(p);
    if (!nearby) return;
    const { kind, obj } = nearby;
    p.interactUntil = this.time + 0.55;
    if (kind === 'rescue') return;
    if (kind === 'door') {
      this.doorStates[obj.id] = !this.doorStates[obj.id];
      this.event('door', this.doorStates[obj.id] ? 'Porte ouverte' : 'Porte fermée', {
        f: p.f,
        x: obj.x,
        z: obj.z,
      });
      if (p.input.run) this.noise(p.f, p.x, p.z, 12, 'CLAC ! La porte a parlé.', p.id);
    }
    if (kind === 'hide') {
      if (this.players.some((o) => o.hidden === obj.id)) return;
      p.hidden = obj.id;
      p.torch = false;
      p.x = obj.x;
      p.z = obj.z;
      this.event('hide', 'Retenez votre souffle.', { player: p.id });
      for (const g of this.guards)
        if (g.f === p.f && g.target === p.id && lineClear(p.f, g, p, this.doorStates))
          g.sawHide = obj.id;
    }
    if (kind === 'stairs') {
      p.f = obj.to;
      p.x = obj.to > obj.f ? -15 : 15;
      p.z = 0;
      p.hidden = null;
      this.event('stairs', `Direction ${['le sous-sol', 'le rez-de-chaussée', 'l’étage'][p.f]}.`, {
        player: p.id,
      });
    }
    if (kind === 'device') {
      if (obj.type === 'light') {
        this.lightStates[obj.room] = !this.lightStates[obj.room];
        this.event('switch', this.lightStates[obj.room] ? 'Lumière allumée' : 'Lumière éteinte', {
          f: p.f,
          x: p.x,
          z: p.z,
        });
      } else if (obj.type === 'breaker') {
        for (const r of rooms.filter((r) => r.f === p.f))
          this.lightStates[r.id] = !this.lightStates[r.id];
        this.noise(p.f, obj.x, obj.z, 15, 'Le disjoncteur vient de sauter.', p.id);
      } else if (obj.type === 'bottles') {
        p.bottles = 3;
        this.event('pickup', 'Trois bouteilles. Trois mauvaises idées.', { player: p.id });
      } else
        this.noise(
          p.f,
          obj.x,
          obj.z,
          obj.type === 'alarm' ? 25 : 18,
          obj.type === 'alarm'
            ? 'DRIIING ! Réunion de voisins.'
            : 'La télé hurle : « Derrière vous ! »',
          p.id,
        );
    }
  }
  nearby(p) {
    const targets = [];
    for (const o of this.players)
      if (o.id !== p.id && o.f === p.f && o.status === 'captured' && distance(p, o) < 1.7)
        targets.push({
          kind: 'rescue',
          obj: o,
          label: 'Maintenir E · Détacher votre partenaire',
          dist: 0,
        });
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
          lineClear(p.f, p, obj, this.doorStates, true)
        )
          targets.push({
            kind,
            obj,
            dist: distance(p, obj),
            label:
              kind === 'door'
                ? `E · ${this.doorStates[obj.id] ? 'Fermer' : 'Ouvrir'} la porte`
                : kind === 'hide'
                  ? 'E · Se cacher'
                  : kind === 'stairs'
                    ? `E · ${obj.to > p.f ? 'Monter' : 'Descendre'}`
                    : {
                        light: 'E · Interrupteur',
                        tv: 'E · Allumer la télévision',
                        alarm: 'E · Déclencher le réveil',
                        breaker: 'E · Couper / rétablir le courant',
                        bottles: 'E · Reprendre des bouteilles',
                      }[obj.type],
          });
    // Closed doors are intentionally reachable even though their center blocks the sight ray endpoint.
    return targets.sort((a, b) => a.dist - b.dist)[0];
  }
  action(id, type) {
    if (!['intro', 'playing'].includes(this.phase)) return;
    const p = this.players.find((p) => p.id === id);
    if (!p) return;
    if (type === 'interact') this.interact(id);
    if (type === 'torch' && p.status === 'free' && !p.hidden) {
      p.torch = !p.torch;
      this.event('switch', 'Clic.', { player: p.id });
    }
    if (type === 'throw' && p.status === 'free' && !p.hidden && p.bottles > 0) {
      p.bottles--;
      let x = p.x,
        z = p.z;
      const dir = { x: Math.sin(p.angle), z: Math.cos(p.angle) };
      for (let i = 0; i < 25; i++) {
        const nx = x + dir.x * 0.24,
          nz = z + dir.z * 0.24;
        if (blocked(p.f, nx, nz, this.doorStates, 0.05)) break;
        x = nx;
        z = nz;
      }
      this.thrown.push({ id: ++this.eventId, f: p.f, x, z, fromX: p.x, fromZ: p.z, at: this.time });
      this.noise(p.f, x, z, 16, 'CRAC ! C’était un vase de famille ?', p.id);
    }
  }
  move(entity, dx, dz, radius = 0.32) {
    let moved = false;
    // Substeps keep collisions valid even under delayed frames.
    const count = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.15));
    for (let i = 0; i < count; i++) {
      if (!blocked(entity.f, entity.x + dx / count, entity.z, this.doorStates, radius)) {
        entity.x += dx / count;
        moved = true;
      }
      if (!blocked(entity.f, entity.x, entity.z + dz / count, this.doorStates, radius)) {
        entity.z += dz / count;
        moved = true;
      }
    }
    return moved;
  }
  canSee(g, p) {
    if (g.f !== p.f || p.status !== 'free' || p.hidden) return false;
    const d = distance(g, p),
      r = roomAt(p.f, p.x, p.z),
      lit = !r || this.lightStates[r.id];
    const range = (lit ? 8 : 4.6) * (p.input.crouch ? 0.65 : 1) + (p.torch ? 4 : 0);
    if (d > range) return false;
    const facing = Math.atan2(p.x - g.x, p.z - g.z),
      angle = Math.atan2(Math.sin(facing - g.angle), Math.cos(facing - g.angle));
    return (d < 1.5 || Math.abs(angle) < 0.85) && lineClear(g.f, g, p, this.doorStates);
  }
  speak(g, text) {
    g.say = text;
    g.sayUntil = this.time + 3.2;
    this.event('voice', `${g.name} : « ${text} »`, { f: g.f, x: g.x, z: g.z });
  }
  capture(g, p) {
    p.status = 'captured';
    p.hidden = null;
    p.torch = false;
    p.bleed = 75;
    p.captor = g.id;
    g.state = 'escort';
    g.target = p.id;
    g.path = [];
    g.think = 0;
    this.speak(g, 'On fait moins les malins, maintenant.');
    this.event(
      'capture',
      this.solo
        ? 'Vous êtes capturé. Personne ne viendra vous sauver.'
        : `${p.character === 0 ? 'DIAG' : 'Swonni'} est capturé ! Maintenez E près de lui pour le libérer.`,
      { player: p.id },
    );
  }
  updateGuard(g, dt) {
    g.attack = Math.max(0, g.attack - dt);
    g.think -= dt;
    if (g.state === 'escort') {
      const victim = this.players.find((p) => p.id === g.target && p.status === 'captured');
      if (!victim) {
        g.state = 'search';
        g.target = null;
        g.think = 0;
        return;
      }
      const before = { f: g.f, x: g.x, z: g.z };
      this.navigate(g, { f: 1, x: 14, z: 9 }, dt, 1.8);
      victim.f = g.f;
      victim.x = before.f === g.f ? before.x : g.x;
      victim.z = before.f === g.f ? before.z : g.z;
      victim.angle = g.angle;
      if (g.f === 1 && distance(g, { x: 14, z: 9 }) < 1) {
        g.state = 'search';
        g.target = null;
        victim.captor = null;
        g.think = 0;
      }
      return;
    }
    const visible = this.players
      .filter((p) => this.canSee(g, p))
      .sort((a, b) => distance(g, a) - distance(g, b));
    if (visible.length) {
      const p = visible[0];
      if (g.state !== 'chase') {
        this.speak(
          g,
          `J’en ai vu un ${roomAt(p.f, p.x, p.z)?.name ? '— ' + roomAt(p.f, p.x, p.z).name + ' !' : 'dans le couloir !'}`,
        );
        for (const ally of this.guards)
          if (
            ally !== g &&
            ally.f === g.f &&
            distance(g, ally) < 9 &&
            !['chase', 'escort'].includes(ally.state)
          ) {
            ally.state = 'search';
            ally.last = { x: p.x, z: p.z, f: p.f };
            ally.think = 0;
            ally.search = 7;
          }
      }
      g.state = 'chase';
      g.target = p.id;
      g.last = { x: p.x, z: p.z, f: p.f };
      g.search = g.personality === 'courageux' ? 11 : 6;
    } else if (g.state === 'chase') {
      g.state = 'lost';
      g.think = 0;
    }
    if (g.sawHide) {
      const h = hides.find((h) => h.id === g.sawHide);
      g.last = { ...h };
      g.state = 'inspection';
      g.search = 8;
      if (g.f === h.f && distance(g, h) < 1.2) {
        const p = this.players.find((p) => p.hidden === h.id);
        if (p) {
          p.hidden = null;
          this.speak(g, 'Le placard, vraiment ?');
          this.capture(g, p);
        }
        g.sawHide = null;
        return;
      }
    }
    if (g.state === 'chase') {
      const p = this.players.find((p) => p.id === g.target);
      if (!p || p.status !== 'free') {
        g.state = 'search';
        g.think = 0;
        return;
      }
      this.navigate(g, g.last, dt, g.personality === 'prudent' ? 2.9 : 3.6);
      if (
        distance(g, p) < 0.95 &&
        g.f === p.f &&
        g.attack === 0 &&
        p.invuln <= 0 &&
        lineClear(g.f, g, p, this.doorStates)
      ) {
        g.attack = 1.5;
        p.hp--;
        p.invuln = 1.6;
        this.event('hurt', 'Coup de poêle !', { player: p.id });
        if (p.hp <= 0) this.capture(g, p);
      }
      return;
    }
    if (g.last && g.state !== 'patrol') {
      g.search -= dt;
      this.navigate(g, g.last, dt, g.personality === 'impulsif' ? 3.1 : 2.3);
      if (g.f === g.last.f && distance(g, g.last) < 0.8) {
        g.inspection += dt;
        g.angle += dt * 1.4;
        if (g.inspection > 1.4) {
          const h = hides
            .filter((h) => h.f === g.f && distance(g, h) < 2)
            .sort((a, b) => distance(g, a) - distance(g, b))[0];
          if (h) {
            const p = this.players.find((p) => p.hidden === h.id);
            if (p) {
              p.hidden = null;
              this.capture(g, p);
              return;
            }
          }
          g.last = null;
          g.think = 0;
          g.inspection = 0;
          g.state = 'search';
        }
      }
      if (g.search <= 0) {
        g.last = null;
        g.state = 'search';
        g.think = 0;
      }
      return;
    }
    if (g.think <= 0 || !g.goal) {
      const intensity = 1 - this.remaining / this.duration;
      const candidates = rooms
        .map((r) => ({
          r,
          score:
            (this.time - (this.visits[`${g.id}-${r.id}`] || -100)) * 0.02 +
            this.random() * 3 +
            (r.f !== g.f ? intensity * 2 - 1 : 1),
        }))
        .sort((a, b) => b.score - a.score);
      const r = candidates[0].r;
      this.visits[`${g.id}-${r.id}`] = this.time;
      const hs = hides.filter((h) => h.f === r.f && roomAt(h.f, h.x, h.z)?.id === r.id);
      const inspect =
        hs.length && (g.personality === 'méthodique' || this.random() < 0.25 + intensity * 0.6);
      const point = inspect ? hs[Math.floor(this.random() * hs.length)] : { x: r.x, z: r.z + 3 };
      g.goal = { x: point.x, z: point.z, f: r.f };
      g.state = inspect ? 'inspection' : 'patrol';
      g.think = 12 + this.random() * 10;
      g.path = [];
    }
    this.navigate(g, g.goal, dt, g.personality === 'prudent' ? 1.55 : 2.1);
    if (g.f === g.goal.f && distance(g, g.goal) < 0.8) {
      if (g.state === 'inspection') {
        g.inspection += dt;
        g.angle += dt;
        if (g.inspection > 2) {
          const h = hides.find((h) => h.f === g.f && distance(h, g.goal) < 0.5);
          const p = h && this.players.find((p) => p.hidden === h.id);
          if (p) {
            p.hidden = null;
            this.speak(g, 'Trouvé. Mauvaise nouvelle pour toi.');
            this.capture(g, p);
            return;
          }
          g.inspection = 0;
          g.think = 0;
        }
      } else {
        g.angle += dt * 0.8;
        g.think = Math.min(g.think, 2);
      }
    }
  }
  navigate(g, destination, dt, speed) {
    if (!destination) return;
    let dest = destination;
    if (dest.f !== g.f) {
      const s = stairs.find((s) => s.f === g.f && s.to === (dest.f > g.f ? g.f + 1 : g.f - 1));
      if (!s) return;
      dest = s;
      if (distance(g, s) < 0.65) {
        g.f = s.to;
        g.x = s.to > s.f ? -15 : 15;
        g.z = 0;
        g.path = [];
        g.pathAt = 0;
        return;
      }
    }
    if (
      !g.path.length ||
      this.time - (g.pathAt || 0) > 1.1 ||
      !g.pathEnd ||
      distance(g.pathEnd, dest) > 1
    ) {
      g.path = pathfind(g.f, g, dest, this.doorStates);
      g.pathAt = this.time;
      g.pathEnd = { ...dest };
    }
    const next = g.path[0];
    if (!next) return;
    for (const d of doors) if (d.f === g.f && distance(g, d) < 1.6) this.doorStates[d.id] = true;
    const dx = next.x - g.x,
      dz = next.z - g.z,
      d = Math.hypot(dx, dz);
    if (d < 0.14) {
      g.path.shift();
      return;
    }
    g.angle = Math.atan2(dx, dz);
    this.move(g, (dx / d) * Math.min(speed * dt, d), (dz / d) * Math.min(speed * dt, d));
  }
  tick(dt) {
    if (!['intro', 'playing'].includes(this.phase)) return;
    dt = clamp(dt, 0, 0.1);
    this.time += dt;
    if (this.phase === 'intro' && this.time >= 10) {
      this.phase = 'playing';
      this.event('hunt', 'LES PROIES ONT CHANGÉ DE CAMP. La chasse commence.');
    }
    if (this.phase === 'playing') this.remaining = Math.max(0, this.remaining - dt);
    this.noises = this.noises.filter((n) => this.time - n.at < 2.5);
    this.thrown = this.thrown.filter((n) => this.time - n.at < 3);
    for (const p of this.players) {
      p.invuln = Math.max(0, p.invuln - dt);
      p.noise = Math.max(0, p.noise - dt * 2);
      if (p.status === 'captured') {
        p.bleed -= dt;
        if (p.bleed <= 0) {
          p.status = 'eliminated';
          this.event('eliminate', 'Le temps de sauvetage est écoulé.', { player: p.id });
        }
        continue;
      }
      if (p.status !== 'free') continue;
      p.angle = p.input.angle || 0;
      if (p.hidden) continue;
      const inp = p.input,
        length = Math.hypot(inp.x || 0, inp.z || 0),
        moving = length > 0.05;
      const running = inp.run && !inp.crouch && p.stamina > 1 && moving;
      p.running = running;
      p.crouching = !!inp.crouch;
      p.moving = moving;
      p.stamina = clamp(p.stamina + (running ? -24 : 14) * dt, 0, 100);
      if (moving) {
        const speed = inp.crouch ? 1.45 : running ? 4.7 : 2.7;
        this.move(
          p,
          (inp.x / Math.max(1, length)) * speed * dt,
          (inp.z / Math.max(1, length)) * speed * dt,
        );
        p.step += dt * speed;
        if (running && p.step > 2) {
          p.step = 0;
          p.noise = 1;
          this.noise(p.f, p.x, p.z, 8, 'Des pas précipités.', p.id);
          if (
            this.random() < 0.12 &&
            props.some((o) => o.f === p.f && o.solid && distance(o, p) < 2)
          ) {
            this.noise(p.f, p.x, p.z, 13, 'Boum. Le meuble a gagné.', p.id);
          }
        }
      }
      const mate = this.players.find(
        (o) =>
          o.id !== p.id &&
          o.status === 'captured' &&
          o.f === p.f &&
          distance(o, p) < 1.7 &&
          lineClear(p.f, p, o, this.doorStates),
      );
      if (mate && inp.use) {
        p.rescue += dt;
        if (p.rescue >= 2.5) {
          mate.status = 'free';
          mate.hp = 2;
          mate.invuln = 5;
          mate.captor = null;
          p.rescue = 0;
          this.event('rescue', 'Détaché ! Courez. Ensemble, si possible.', { player: mate.id });
        }
      } else p.rescue = 0;
    }
    if (this.phase === 'playing') for (const g of this.guards) this.updateGuard(g, dt);
    if (this.players.every((p) => p.status !== 'free')) {
      this.phase = 'ended';
      this.result = 'defeat';
      this.event('end', 'Les voisins ont gagné. Le quartier est sûr.');
    } else if (this.remaining <= 0) {
      this.phase = 'ended';
      this.result = this.solo
        ? 'solo'
        : this.players.length === 2 && this.players.every((p) => p.status === 'free')
          ? 'perfect'
          : 'imperfect';
      this.event(
        'end',
        this.result === 'solo'
          ? 'Un masque. Une aube. Vous avez survécu.'
          : this.result === 'perfect'
            ? 'Deux masques. Une aube. Aucune dignité.'
            : 'Une aube, un survivant. On en reparlera.',
      );
    }
  }
  snapshot() {
    return {
      phase: this.phase,
      time: this.time,
      remaining: this.remaining,
      duration: this.duration,
      result: this.result,
      practice: this.practice,
      mode: this.solo ? 'solo' : 'coop',
      players: this.players.map(({ input, ...p }) => ({ ...p, input: { crouch: !!input.crouch } })),
      guards: this.guards.map(({ path, pathEnd, goal, ...g }) => g),
      doors: this.doorStates,
      lights: this.lightStates,
      noises: this.noises,
      events: this.events,
      thrown: this.thrown,
    };
  }
}
