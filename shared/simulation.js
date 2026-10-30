import {
  NIGHT,
  FLOORS,
  SPAWN,
  CAPTURE_POINT,
  PARTY_SPOTS,
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
  regionAt,
  nearWindow,
  windowLanding,
  bottleTrajectory,
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
  constructor({ duration = NIGHT, seed = 2701, scenario = 'infiltration', observer = false } = {}) {
    this.scenario = scenario;
    this.observer = observer;
    this.bodies = [];
    this.blood = [];
    this.alarmAt = null;
    this.lastSpeech = -20;
    this.power = true;
    this.tension = 0;
    this.lastIncident = -20;
    this.nextRoutine = 24;
    this.routineIndex = 0;
    this.socialMemory = [];
    this.socialAt = 0;
    this.repairDevice = null;
    this.duration = duration;
    this.seed = seed;
    this.phase = 'lobby';
    this.time = 0;
    this.remaining = duration;
    this.players = [];
    this.guards = [];
    this.doorLocks = {};
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
    this.phase = this.scenario === 'hunt' ? 'intro' : 'infiltration';
    this.bodies = [];
    this.blood = [];
    this.alarmAt = null;
    this.lastSpeech = -20;
    this.power = true;
    this.tension = 0;
    this.lastIncident = -20;
    this.nextRoutine = 24;
    this.routineIndex = 0;
    this.socialMemory = [];
    this.socialAt = 0;
    this.repairDevice = null;
    this.time = 0;
    this.remaining = this.duration;
    this.result = null;
    this.guards = [];
    this.noises = [];
    this.events = [];
    this.visits = {};
    this.thrown = [];
    this.doorLocks = {};
    this.doorStates = Object.fromEntries(doors.map((d) => [d.id, false]));
    this.lightStates = Object.fromEntries(rooms.map((r) => [r.id, true]));
    this.players.forEach((p, i) =>
      Object.assign(p, {
        x: this.scenario === 'hunt' ? 5 + i : SPAWN.x,
        z: this.scenario === 'hunt' ? -2 : SPAWN.z + i * 1.5,
        dragging: null,
        climb: null,
        climbHeight: 0,
        cleaning: null,
        cleanProgress: 0,
        charging: false,
        throwCharge: 0,
        path: [],
        botSabotaged: false,
        opening: null,
        openProgress: 0,
        attackCooldown: 0,
        exhaustedUntil: 0,
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
    for (let i = 0; i < PARTY_SPOTS.length; i++) {
      const { x, z, f } = PARTY_SPOTS[i];
      this.guards.push({
        id: `g${i}`,
        name: names[i],
        personality: personalities[i],
        x,
        z,
        f: 1,
        angle: 0,
        state: this.scenario === 'hunt' ? 'patrol' : 'party',
        home: { f, x, z },
        socialStyle: ['talk', 'listen', 'drink', 'dance'][i % 4],
        socialNext: 5 + i * 1.3,
        socialSpot: null,
        alive: true,
        armed: this.scenario === 'hunt',
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
    this.socialMemory = this.guards.map((g) => ({
      id: g.id,
      name: g.name,
      lastSeen: 0,
      checkedAt: -100,
      point: { f: g.f, x: g.x, z: g.z },
    }));
    if (this.scenario === 'hunt')
      this.event(
        'intro',
        this.solo
          ? 'ATTENDEZ… IL EST TOUT SEUL ! ON EST HUIT, BORDEL !'
          : 'ATTENDEZ… ILS SONT QUE DEUX ! ON EST HUIT, BORDEL !',
      );
    else this.event('infiltration', 'Entrez discrètement. Personne ne se doute encore de rien.');
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
      clean: !!data.clean,
    };
  }
  noise(f, x, z, radius, text, source) {
    const n = { id: ++this.eventId, f, x, z, radius, text, at: this.time, source };
    this.noises.push(n);
    this.event('noise', text, { f, x, z });
    const candidates = this.guards
      .filter((g) => {
        if (g.alive === false || g.f !== f || ['chase', 'escort'].includes(g.state)) return false;
        return distance(g, n) < radius * (lineClear(f, g, n, this.doorStates, true) ? 1 : 0.45);
      })
      .sort((a, b) => distance(a, n) - distance(b, n));
    if (this.phase === 'infiltration' && candidates.length && this.time - this.lastIncident > 6) {
      this.tension = Math.min(6, this.tension + (radius >= 20 ? 2 : 1));
      this.lastIncident = this.time;
    }
    const limit =
      this.phase === 'infiltration'
        ? Math.min(4, (radius >= 14 ? 2 : 1) + Math.floor(this.tension / 3))
        : candidates.length;
    for (const g of candidates.slice(0, limit)) {
      g.last = { x, z, f };
      g.state = 'suspicion';
      g.think = 0;
      g.target = null;
      g.search = 7;
      g.inspection = 0;
      g.goal = null;
    }
  }

  interact(id, ajar = false) {
    const p = this.players.find((p) => p.id === id);
    if (!p || p.status !== 'free' || !['intro', 'playing', 'infiltration'].includes(this.phase))
      return;
    if (p.climb) return;
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
      if (this.doorLocks[obj.id]) {
        this.event('warning', 'Porte verrouillée · L pour déverrouiller depuis l’intérieur.', {
          player: p.id,
        });
        return;
      }
      if (obj.window && this.players.some((other) => other.climb?.window === obj.id)) return;
      if (obj.window && !this.doorStates[obj.id]) {
        p.opening = obj.id;
        p.openStarted = this.time;
        p.openProgress = 0;
        return;
      }
      this.doorStates[obj.id] =
        ajar && !obj.window && !obj.patio
          ? this.doorStates[obj.id] === 'ajar'
            ? false
            : 'ajar'
          : this.doorStates[obj.id] === 'ajar'
            ? true
            : !this.doorStates[obj.id];
      this.event('door', this.doorStates[obj.id] ? 'Porte ouverte' : 'Porte fermée', {
        f: p.f,
        x: obj.x,
        z: obj.z,
      });
      if (p.input.run) this.noise(p.f, p.x, p.z, 12, 'CLAC ! La porte a parlé.', p.id);
    }
    if (kind === 'hide') {
      if (p.dragging) {
        const body = this.bodies.find((b) => b.id === p.dragging);
        if (
          !body ||
          this.bodies.some((b) => b.hidden === obj.id) ||
          this.players.some((o) => o.hidden === obj.id)
        ) {
          this.event('warning', 'Cette cachette est occupée.', { player: p.id });
          return;
        }
        Object.assign(body, { hidden: obj.id, draggedBy: null, x: obj.x, z: obj.z, f: obj.f });
        p.dragging = null;
        this.event('stash', 'Corps dissimulé. Nettoyez aussi les traces laissées derrière vous.', {
          player: p.id,
        });
        return;
      }
      if (
        this.players.some((o) => o.hidden === obj.id) ||
        this.bodies.some((b) => b.hidden === obj.id)
      )
        return;
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
      p.x = obj.landing.x;
      p.z = obj.landing.z;
      p.hidden = null;
      this.event('stairs', `Direction ${FLOORS[p.f]}.`, {
        player: p.id,
      });
    }
    if (kind === 'device') {
      if (obj.type === 'light') {
        this.lightStates[obj.room] = !this.lightStates[obj.room];
        this.event(
          'switch',
          !this.power
            ? 'Pas de courant : rétablissez le coffret électrique.'
            : this.lightStates[obj.room]
              ? 'Lumière allumée'
              : 'Lumière éteinte',
          {
            f: p.f,
            x: p.x,
            z: p.z,
          },
        );
      } else if (obj.type === 'breaker') {
        this.power = !this.power;
        this.repairDevice = this.power ? null : obj.id;
        if (this.power) for (const g of this.guards) g.repair = null;
        this.noise(
          p.f,
          obj.x,
          obj.z,
          12,
          this.power
            ? 'Le courant est rétabli.'
            : 'Courant coupé : maison et allée plongées dans le noir.',
          p.id,
        );
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
          lineClear(
            p.f,
            p,
            obj,
            kind === 'door' ? { ...this.doorStates, [obj.id]: true } : this.doorStates,
            true,
            !!obj.window,
          )
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
    if (!['intro', 'playing', 'infiltration'].includes(this.phase)) return;
    const p = this.players.find((p) => p.id === id);
    if (!p) return;
    if (type === 'cancelThrow') {
      p.charging = false;
      p.throwCharge = 0;
      return;
    }
    if (
      type === 'charge' &&
      p.status === 'free' &&
      !p.hidden &&
      !p.climb &&
      !p.dragging &&
      p.bottles > 0
    ) {
      p.charging = true;
      p.chargeStarted = this.time;
      p.throwCharge = 0;
      return;
    }
    if (type === 'lock') this.toggleLock(p);
    if (type === 'climb') this.climbWindow(p);
    if (p.climb && type !== 'torch') return;
    if (type === 'attack') this.stab(p);
    if (type === 'drag') this.toggleDrag(p);
    if (type === 'interact') this.interact(id);
    if (type === 'ajar') this.interact(id, true);
    if (type === 'torch' && p.status === 'free' && !p.hidden) {
      p.torch = !p.torch;
      this.event('switch', 'Clic.', { player: p.id });
    }
    if (type === 'throw') this.throwBottle(p);
  }
  toggleLock(p) {
    if (p.status !== 'free' || p.hidden || p.climb || p.dragging) return;
    const region = regionAt(p.f, p.x, p.z);
    if (!rooms.some((r) => r.id === region)) return;
    const d = doors
      .filter(
        (d) =>
          !d.window &&
          d.f === p.f &&
          distance(p, d) < 1.9 &&
          [
            regionAt(d.f, d.x + (d.axis === 'z' ? 0.7 : 0), d.z + (d.axis === 'x' ? 0.7 : 0)),
            regionAt(d.f, d.x - (d.axis === 'z' ? 0.7 : 0), d.z - (d.axis === 'x' ? 0.7 : 0)),
          ].includes(region),
      )
      .sort((a, b) => distance(p, a) - distance(p, b))[0];
    if (!d) return;
    const lock = this.doorLocks[d.id];
    if (lock && lock.region !== region) return;
    if (lock) delete this.doorLocks[d.id];
    else {
      this.doorStates[d.id] = false;
      this.doorLocks[d.id] = { region, at: this.time, player: p.id };
    }
    this.event(
      'door',
      lock ? 'Porte déverrouillée.' : 'Porte verrouillée. Ne restez pas enfermé trop longtemps.',
      { player: p.id },
    );
  }
  throwBottle(p) {
    if (p.status !== 'free' || p.hidden || p.climb || p.dragging || p.bottles <= 0) {
      p.charging = false;
      p.throwCharge = 0;
      return;
    }
    const charge = p.charging ? Math.min(1, (this.time - p.chargeStarted) / 2) : 0.37;
    const path = bottleTrajectory(p, this.doorStates, charge);
    p.bottles--;
    p.charging = false;
    p.throwCharge = 0;
    this.thrown.push({
      id: ++this.eventId,
      f: p.f,
      ...path,
      fromX: p.x,
      fromZ: p.z,
      at: this.time,
      source: p.id,
      impacted: false,
    });
  }
  turnToward(g, angle, dt) {
    const delta = Math.atan2(Math.sin(angle - g.angle), Math.cos(angle - g.angle));
    g.angle += clamp(delta, -dt * 2.2, dt * 2.2);
    return Math.abs(delta);
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
    if (g.alive === false || g.f !== p.f || p.status !== 'free' || p.hidden) return false;
    const d = distance(g, p),
      r = roomAt(p.f, p.x, p.z),
      lit = this.power && (!r || this.lightStates[r.id]);
    const range = (lit ? 8 : 4.6) * (p.input.crouch ? 0.65 : 1) + (p.torch ? 4 : 0);
    if (d > range) return false;
    const facing = Math.atan2(p.x - g.x, p.z - g.z),
      angle = Math.atan2(Math.sin(facing - g.angle), Math.cos(facing - g.angle));
    return Math.abs(angle) < 0.85 && lineClear(g.f, g, p, this.doorStates);
  }
  speak(g, text, urgent = false) {
    if (!urgent && (this.time - this.lastSpeech < 5 || this.time < (g.nextSpeech || 0))) return;
    this.lastSpeech = this.time;
    g.nextSpeech = this.time + 16;
    g.say = text;
    g.sayUntil = this.time + 3.2;
    this.event('voice', `${g.name} : « ${text} »`, { f: g.f, x: g.x, z: g.z });
  }
  climbWindow(p) {
    if (p.status !== 'free' || p.hidden || p.climb) return;
    const d = doors
      .filter((d) => nearWindow(p, d))
      .sort((a, b) => distance(p, a) - distance(p, b))[0];
    if (!d || !['outside', d.room].includes(regionAt(p.f, p.x, p.z))) return;
    if (p.dragging) {
      this.event('warning', 'Déposez le corps avant d’escalader.', { player: p.id });
      return;
    }
    if (!this.doorStates[d.id]) {
      this.event('warning', 'Maintenez E pour déverrouiller la fenêtre, puis V pour l’escalader.', {
        player: p.id,
      });
      return;
    }
    const dest = windowLanding(p, d, this.doorStates);
    if (!dest) {
      this.event('warning', 'Le passage est encombré.', { player: p.id });
      return;
    }
    p.climb = {
      window: d.id,
      fromX: p.x,
      fromZ: p.z,
      x: dest.x,
      z: dest.z,
      elapsed: 0,
      duration: 0.85,
    };
    p.opening = null;
    p.openProgress = 0;
    p.input = {};
    p.running = false;
    this.event('climb', 'Vous franchissez la fenêtre.', { player: p.id });
  }
  isolated(g) {
    return !this.guards.some(
      (other) =>
        other !== g &&
        other.alive !== false &&
        other.f === g.f &&
        distance(other, g) < 6 &&
        lineClear(g.f, other, g, this.doorStates),
    );
  }
  stab(p) {
    if (p.status !== 'free' || p.hidden || p.dragging || p.attackCooldown > 0 || p.climb) return;
    if (p.stamina < 40) {
      this.event('warning', 'Pas assez d’énergie pour attaquer (40 nécessaires).', {
        player: p.id,
      });
      return;
    }
    const target = this.guards
      .filter(
        (g) =>
          g.alive !== false &&
          g.f === p.f &&
          distance(g, p) < 1.6 &&
          lineClear(p.f, p, g, this.doorStates, false, false),
      )
      .sort((a, b) => distance(p, a) - distance(p, b))[0];
    if (!target) return;
    if (!this.isolated(target)) {
      this.event('warning', 'Trop de témoins. Attendez qu’il soit isolé.', { player: p.id });
      return;
    }
    target.alive = false;
    target.repair = null;
    target.state = 'dead';
    target.armed = false;
    target.target = null;
    p.stamina -= 40;
    p.exhaustedUntil = this.time + 5;
    p.attackCooldown = 3;
    p.attackUntil = this.time + 0.6;
    const body = {
      id: `body-${target.id}`,
      guard: target.id,
      index: Number(target.id.slice(1)),
      name: target.name,
      f: target.f,
      x: target.x,
      z: target.z,
      angle: target.angle,
      draggedBy: null,
    };
    body.lastBlood = { x: body.x, z: body.z };
    this.bodies.push(body);
    this.addBlood(body, 0.65);
    this.noise(body.f, body.x, body.z, 18, 'Un cri étouffé, puis un corps qui tombe.', p.id);
    this.event(
      'kill',
      `${target.name} est éliminé. Ils peuvent avoir entendu : cachez le corps et nettoyez !`,
      {
        player: p.id,
        f: body.f,
        x: body.x,
        z: body.z,
      },
    );
  }
  toggleDrag(p) {
    if (p.status !== 'free' || p.hidden) return;
    if (p.dragging) {
      const b = this.bodies.find((b) => b.id === p.dragging);
      if (b) b.draggedBy = null;
      p.dragging = null;
      this.event('drop', 'Corps déposé. Les traces restent.', { player: p.id });
      return;
    }
    const body = this.bodies
      .filter(
        (b) =>
          !b.draggedBy &&
          b.f === p.f &&
          distance(p, b) < 1.9 &&
          lineClear(p.f, p, b, this.doorStates, false, false),
      )
      .sort((a, b) => distance(a, p) - distance(b, p))[0];
    if (body) {
      body.hidden = null;
      body.draggedBy = p.id;
      p.dragging = body.id;
      this.event('drag', 'Vous traînez le corps. R pour le déposer.', { player: p.id });
    }
  }
  addBlood(point, size = 0.23) {
    this.blood.push({
      id: `blood-${this.eventId++}-${this.blood.length}`,
      f: point.f,
      x: point.x,
      z: point.z,
      size,
    });
  }
  dragBody(p) {
    if (!p.dragging) return;
    const body = this.bodies.find((b) => b.id === p.dragging);
    if (!body) return;
    if (p.status !== 'free' || p.hidden) {
      body.draggedBy = null;
      p.dragging = null;
      return;
    }
    if (body.f !== p.f) {
      body.f = p.f;
      body.x = p.x;
      body.z = p.z;
      this.addBlood(body);
      return;
    }
    const d = distance(body, p);
    if (d < 0.7) return;
    const old = { ...body },
      dx = (p.x - body.x) / d,
      dz = (p.z - body.z) / d;
    this.move(body, dx * Math.min(0.18, d - 0.65), dz * Math.min(0.18, d - 0.65), 0.2);
    body.angle = Math.atan2(dx, dz) + Math.PI / 2;
    const last = body.lastBlood || old;
    if (distance(body, last) > 0.4) {
      this.addBlood(body);
      body.lastBlood = { x: body.x, z: body.z };
    }
  }
  seesEvidence(g, e) {
    if (e.hidden) return false;
    const room = roomAt(e.f, e.x, e.z),
      lit = this.power && (!room || this.lightStates[room.id]);
    if (g.f !== e.f || distance(g, e) > (lit ? 6 : 2.2)) return false;
    const a = Math.atan2(e.x - g.x, e.z - g.z),
      delta = Math.atan2(Math.sin(a - g.angle), Math.cos(a - g.angle));
    return Math.abs(delta) < 0.85 && lineClear(g.f, g, e, this.doorStates);
  }
  raiseAlarm(g, e, masked = false) {
    if (this.phase !== 'infiltration') return;
    this.phase = 'playing';
    this.alarmAt = this.time;
    for (const other of this.guards)
      if (other.alive !== false) {
        other.armed = true;
        other.state = 'search';
        other.last = { f: e.f, x: e.x, z: e.z };
        other.search = 12;
        other.think = 0;
        other.goal = null;
      }
    this.event(
      'hunt',
      masked
        ? 'UN INTRUS MASQUÉ ! La soirée vire à la panique : les invités s’arment.'
        : this.solo
          ? 'UN CORPS ! IL EST TOUT SEUL, ON EST ENCORE PLUSIEURS !'
          : 'UN CORPS ! ILS SONT DEUX ! ON LES CHERCHE !',
    );
    this.speak(
      g,
      masked
        ? 'C’est un intrus ! Fermez les portes !'
        : 'Du sang ! Prenez quelque chose, on les cherche !',
      true,
    );
  }
  updateGuest(g, dt) {
    g.think -= dt;
    const evidence = [...this.bodies, ...this.blood].find((e) => this.seesEvidence(g, e));
    if (evidence) {
      this.raiseAlarm(g, evidence);
      return;
    }
    const intruder = this.players.find((p) => this.canSee(g, p));
    if (intruder) {
      if (g.challenge?.player !== intruder.id) {
        g.challenge = { player: intruder.id, at: this.time, x: intruder.x, z: intruder.z };
        this.speak(g, 'Tu es invité, toi ? Pourquoi ce masque ?');
      }
      g.state = 'confrontation';
      g.last = { f: intruder.f, x: intruder.x, z: intruder.z };
      this.turnToward(g, Math.atan2(intruder.x - g.x, intruder.z - g.z), dt);
      if (
        intruder.running ||
        distance(intruder, g.challenge) > 1.4 ||
        this.time - g.challenge.at > 2.5
      ) {
        this.raiseAlarm(g, intruder, true);
        return;
      }
    } else if (g.challenge) {
      const p = this.players.find((p) => p.id === g.challenge.player);
      if (p?.status === 'free') {
        this.raiseAlarm(g, g.last || g.challenge, true);
        return;
      }
      g.challenge = null;
    }
    if (!g.challenge && this.updateRepair(g, dt)) return;
    if (g.last) {
      g.search -= dt;
      if (g.f === g.last.f && distance(g, g.last) < 0.8) {
        g.inspection += dt;
        g.angle += dt * 1.1;
      } else this.navigate(g, g.last, dt, g.challenge ? 1.9 : 1.5);
      if (!g.challenge && (g.inspection > 2.5 || g.search <= 0)) {
        g.last = null;
        g.goal = null;
        g.path = [];
        g.think = 0;
        g.inspection = 0;
      }
      return;
    }
    if (g.errand) {
      this.navigate(g, g.errand, dt, 1.2);
      g.state = 'routine';
      if (g.f === g.errand.f && distance(g, g.errand) < 0.85) {
        g.errand.wait -= dt;
        g.angle += dt * 0.2;
        if (g.errand.wait <= 0) {
          g.errand = null;
          g.goal = null;
          g.path = [];
        }
      }
      return;
    }
    const patrolCount = Math.min(3, Math.floor(this.tension / 2));
    const patrol = this.guards.filter((a) => a.alive !== false).indexOf(g) < patrolCount;
    if (patrol) {
      if (!g.goal || (g.f === g.goal.f && distance(g, g.goal) < 0.85) || g.think <= 0) {
        const candidates = rooms.filter((r) => r.f === 1);
        const r = candidates[Math.floor(this.random() * candidates.length)];
        g.goal = { f: r.f, ...r.nav };
        g.think = 20;
        g.path = [];
      }
      g.state = 'patrol';
      this.navigate(g, g.goal, dt, 1.35);
    } else {
      g.state = 'party';
      if (this.time >= g.socialNext) {
        g.socialNext = this.time + 9 + this.random() * 10;
        g.socialStyle = ['talk', 'listen', 'drink', 'dance'][Math.floor(this.random() * 4)];
        g.socialSpot = null;
        // Local steps only: stay in the same party area and avoid furniture/other guests.
        for (let attempt = 0; attempt < 6; attempt++) {
          const angle = this.random() * Math.PI * 2,
            radius = 0.35 + this.random() * 0.65;
          const spot = {
            f: g.home.f,
            x: g.home.x + Math.sin(angle) * radius,
            z: g.home.z + Math.cos(angle) * radius,
          };
          if (
            regionAt(spot.f, spot.x, spot.z) !== regionAt(g.home.f, g.home.x, g.home.z) ||
            blocked(spot.f, spot.x, spot.z, this.doorStates, 0.4) ||
            !lineClear(spot.f, g.home, spot, this.doorStates, false, false) ||
            this.guards.some(
              (other) =>
                other !== g &&
                other.alive !== false &&
                other.f === spot.f &&
                distance(other, spot) < 1.1,
            )
          )
            continue;
          g.socialSpot = spot;
          break;
        }
      }
      const socialSpot = g.socialSpot || g.home;
      if (g.f !== g.home.f || distance(g, g.home) > 1.5) this.navigate(g, g.home, dt, 1.2);
      else if (distance(g, socialSpot) > 0.12) {
        const dx = socialSpot.x - g.x,
          dz = socialSpot.z - g.z,
          length = Math.hypot(dx, dz);
        if (this.turnToward(g, Math.atan2(dx, dz), dt) < 0.5)
          this.move(
            g,
            (dx / length) * Math.min(0.65 * dt, length),
            (dz / length) * Math.min(0.65 * dt, length),
          );
      } else {
        const companions = this.guards.filter(
          (other) =>
            other !== g &&
            other.alive !== false &&
            other.f === g.f &&
            other.state === 'party' &&
            distance(other, g) < 7.5 &&
            lineClear(g.f, g, other, this.doorStates),
        );
        const partner = companions[
          (Math.floor(this.time / 12) + Number(g.id.slice(1))) % companions.length
        ] || { x: -10, z: -7 };
        this.turnToward(
          g,
          Math.atan2(partner.x - g.x, partner.z - g.z) + Math.sin(this.time * 0.35) * 0.12,
          dt,
        );
        if (g.think <= 0) {
          this.speak(
            g,
            [
              'Qui veut un verre ?',
              'Elle est bien, cette soirée.',
              'Tony, laisse un peu de musique !',
            ][Number(g.id.slice(1)) % 3],
          );
          g.think = 25 + this.random() * 20;
        }
      }
    }
  }
  assignRepair() {
    if (
      !this.power &&
      this.repairDevice &&
      !this.guards.some((g) => g.alive !== false && g.repair)
    ) {
      const d = devices.find((d) => d.id === this.repairDevice);
      const g = this.guards
        .filter((g) => g.alive !== false && !g.challenge && !['chase', 'escort'].includes(g.state))
        .sort(
          (a, b) =>
            Math.abs(a.f - d.f) * 30 + distance(a, d) - Math.abs(b.f - d.f) * 30 - distance(b, d),
        )[0];
      if (g) {
        g.repair = { device: d.id, progress: 0 };
        g.last = null;
        g.errand = null;
        g.path = [];
      }
    }
  }
  updateRepair(g, dt) {
    if (g.repair) {
      const d = devices.find((d) => d.id === g.repair.device);
      if (!d || this.power) {
        g.repair = null;
        g.path = [];
        return true;
      }
      g.state = 'repair';
      const target = d.room === 'outside' ? { f: d.f, x: d.x - 0.6, z: d.z } : d;
      this.navigate(g, target, dt, 1.4);
      if (g.f === d.f && distance(g, target) < 1.1) {
        g.repair.progress += dt;
        if (g.repair.progress >= 3) {
          this.power = true;
          this.repairDevice = null;
          g.repair = null;
          g.last = null;
          g.goal = null;
          g.path = [];
          this.event(
            'switch',
            'Le courant est rétabli par un invité. Rien d’autre ? On retourne à la soirée.',
            { f: d.f, x: d.x, z: d.z },
          );
          this.speak(g, 'C’était le disjoncteur. C’est réparé.');
        }
      }
      return true;
    }
    return false;
  }
  updateParty(dt = 0.05) {
    if (this.time - this.lastIncident > 35) this.tension = Math.max(0, this.tension - dt * 0.12);
    this.updateSocialMemory();
    if (this.time < this.nextRoutine) return;
    this.nextRoutine = this.time + 30 + this.random() * 20;
    if (this.guards.some((g) => g.alive !== false && g.errand)) return;
    const guests = this.guards.filter((g) => g.alive !== false && g.state === 'party' && !g.repair);
    if (!guests.length) return;
    const g = guests[this.routineIndex % guests.length];
    const destinations = ['r1-4', 'r1-2', 'r2-5', 'r1-2'];
    const destination = destinations[this.routineIndex++ % destinations.length];
    const r = rooms.find((r) => r.id === destination);
    g.errand = { f: r.f, ...r.nav, wait: 14 };
    g.path = [];
    g.goal = null;
  }
  updateSocialMemory() {
    if (this.time < this.socialAt) return;
    this.socialAt = this.time + 1;
    for (const m of this.socialMemory) {
      const friend = this.guards.find((g) => g.id === m.id);
      if (
        friend &&
        friend.alive !== false &&
        this.guards.some(
          (g) =>
            g !== friend &&
            g.alive !== false &&
            this.canSee(g, { ...friend, status: 'free', input: {} }),
        )
      ) {
        m.lastSeen = this.time;
        m.point = { f: friend.f, x: friend.x, z: friend.z };
      }
      if (this.time - m.lastSeen < 70 || this.time - m.checkedAt < 70) continue;
      const searcher = this.guards.find(
        (g) => g.id !== m.id && g.alive !== false && g.state === 'party' && !g.errand && !g.repair,
      );
      if (!searcher) continue;
      m.checkedAt = this.time;
      searcher.last = { ...m.point };
      searcher.search = 12;
      searcher.inspection = 0;
      searcher.path = [];
      searcher.state = 'suspicion';
      this.tension = Math.max(1, this.tension);
      this.lastIncident = this.time;
      this.event('suspicion', `${searcher.name} va voir où est passé ${m.name}.`, {
        f: searcher.f,
        x: searcher.x,
        z: searcher.z,
      });
      break;
    }
  }
  updateKillerAI(dt) {
    const p = this.players[0];
    if (!p || p.status !== 'free' || p.climb || p.hidden) return;
    p.path ||= [];
    p.input = { angle: p.angle, crouch: true };
    if (this.phase === 'infiltration' && !p.botSabotaged) {
      const d = devices.find((d) => d.type === 'breaker' && d.room === 'outside');
      const target = { f: d.f, x: d.x - 0.65, z: d.z };
      this.navigate(p, target, dt, 1.8);
      if (distance(p, target) < 0.7) {
        this.interact(p.id);
        p.botSabotaged = true;
        p.path = [];
      }
    } else if (this.phase === 'infiltration') {
      const isolated = this.guards
        .filter((g) => g.alive !== false && this.isolated(g))
        .sort(
          (a, b) =>
            Math.abs(a.f - p.f) * 30 + distance(a, p) - Math.abs(b.f - p.f) * 30 - distance(b, p),
        )[0];
      const target = isolated || { f: 1, x: 7, z: 8 };
      this.navigate(p, target, dt, 1.8);
      if (isolated && isolated.f === p.f && distance(p, isolated) < 1.5) {
        this.stab(p);
        p.path = [];
      }
    } else {
      const threat = this.guards
        .filter((g) => g.alive !== false && g.f === p.f)
        .sort((a, b) => distance(a, p) - distance(b, p))[0];
      if (!p.botEscape || this.time > p.botEscape.until || distance(p, p.botEscape) < 1) {
        const candidates = [
          { f: 1, x: -33, z: -24 },
          { f: 1, x: 33, z: 22 },
          { f: 1, x: -33, z: 22 },
          { f: 1, x: 32, z: -24 },
          { f: 2, x: -3, z: 6 },
          { f: 2, x: 9, z: -12 },
        ];
        p.botEscape = {
          ...candidates.sort((a, b) =>
            threat ? distance(b, threat) - distance(a, threat) : this.random() - 0.5,
          )[0],
          until: this.time + 12,
        };
        p.path = [];
      }
      this.navigate(p, p.botEscape, dt, 3.4);
      const victim = this.guards.find(
        (g) => g.alive !== false && g.f === p.f && distance(p, g) < 1.5 && this.isolated(g),
      );
      if (victim) this.stab(p);
    }
    p.input.angle = p.angle;
  }
  nearestBlood(p) {
    return this.blood
      .filter(
        (b) =>
          b.f === p.f &&
          distance(p, b) < 1.7 &&
          lineClear(p.f, p, b, this.doorStates, false, false),
      )
      .sort((a, b) => distance(p, a) - distance(p, b))[0];
  }
  cleanBlood(p, dt, moving) {
    if (!p.input.clean || moving || p.dragging || p.hidden || p.climb) {
      p.cleaning = null;
      p.cleanProgress = 0;
      return false;
    }
    const mark = this.blood.find((b) => b.id === p.cleaning) || this.nearestBlood(p);
    if (
      !mark ||
      mark.f !== p.f ||
      distance(p, mark) >= 1.7 ||
      !lineClear(p.f, p, mark, this.doorStates, false, false)
    ) {
      p.cleaning = null;
      p.cleanProgress = 0;
      return false;
    }
    if (p.cleaning !== mark.id) {
      p.cleaning = mark.id;
      p.cleanProgress = 0;
    }
    p.cleanProgress += dt;
    p.interactUntil = this.time + 0.2;
    p.moving = false;
    p.running = false;
    p.opening = null;
    p.openProgress = 0;
    if (p.cleanProgress >= 3) {
      // A scrub cleans a small patch, including overlapping drag marks, never through walls.
      this.blood = this.blood.filter(
        (b) =>
          b.f !== mark.f ||
          distance(b, mark) > 1.1 ||
          !lineClear(p.f, mark, b, this.doorStates, true, false),
      );
      p.cleaning = null;
      p.cleanProgress = 0;
      this.event('clean', 'Le sang est nettoyé à cet endroit.', {
        player: p.id,
        f: p.f,
        x: mark.x,
        z: mark.z,
      });
    }
    return true;
  }
  capture(g, p) {
    p.climb = null;
    p.climbHeight = 0;
    p.cleaning = null;
    p.cleanProgress = 0;
    if (p.dragging) {
      const body = this.bodies.find((b) => b.id === p.dragging);
      if (body) body.draggedBy = null;
      p.dragging = null;
    }
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
    if (g.alive === false) return;
    if (this.phase === 'infiltration') {
      this.updateGuest(g, dt);
      return;
    }
    if (
      g.state !== 'escort' &&
      !this.players.some((p) => this.canSee(g, p)) &&
      this.updateRepair(g, dt)
    )
      return;
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
      this.navigate(g, CAPTURE_POINT, dt, 1.8);
      victim.f = g.f;
      victim.x = before.f === g.f ? before.x : g.x;
      victim.z = before.f === g.f ? before.z : g.z;
      victim.angle = g.angle;
      if (g.f === CAPTURE_POINT.f && distance(g, CAPTURE_POINT) < 1) {
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
          `Il est là, ${roomAt(p.f, p.x, p.z)?.name?.replaceAll('/', ' et ') || 'dans le couloir'} !`,
        );
        for (const ally of this.guards)
          if (
            ally.alive !== false &&
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
        lineClear(g.f, g, p, this.doorStates, false, false)
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
      const point = inspect ? hs[Math.floor(this.random() * hs.length)] : r.nav;
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
      const s = stairs
        .filter((s) => s.f === g.f && s.to === dest.f)
        .sort(
          (a, b) =>
            distance(g, a) + distance(a.landing, dest) - distance(g, b) - distance(b.landing, dest),
        )[0];
      if (!s) return;
      dest = s;
      if (distance(g, s) < 0.65) {
        g.f = s.to;
        g.x = s.landing.x;
        g.z = s.landing.z;
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
    for (const d of doors)
      if (!d.window && d.f === g.f && distance(g, d) < 1.6 && !this.doorLocks[d.id])
        this.doorStates[d.id] = true;
    const dx = next.x - g.x,
      dz = next.z - g.z,
      d = Math.hypot(dx, dz);
    if (d < 0.14) {
      g.path.shift();
      return;
    }
    if (this.turnToward(g, Math.atan2(dx, dz), dt) > 0.7) return;
    this.move(g, (dx / d) * Math.min(speed * dt, d), (dz / d) * Math.min(speed * dt, d));
  }
  tick(dt) {
    if (!['intro', 'playing', 'infiltration'].includes(this.phase)) return;
    for (const [id, lock] of Object.entries(this.doorLocks)) {
      const age = this.time - lock.at;
      const d = doors.find((d) => d.id === id);
      if (age > 25 && !lock.questioned) {
        lock.questioned = true;
        this.noise(
          d.f,
          d.x,
          d.z,
          12,
          'Cette porte reste fermée… Quelqu’un va vérifier.',
          lock.player,
        );
      }
      if (age > 45) {
        delete this.doorLocks[id];
        this.noise(
          d.f,
          d.x,
          d.z,
          16,
          'La serrure cède : impossible de rester barricadé.',
          lock.player,
        );
      }
    }

    if (!['intro', 'playing', 'infiltration'].includes(this.phase)) return;
    dt = clamp(dt, 0, 0.1);
    this.time += dt;
    if (this.phase === 'intro' && this.time >= 10) {
      this.phase = 'playing';
      this.event('hunt', 'LES PROIES ONT CHANGÉ DE CAMP. La chasse commence.');
    }
    if (this.phase === 'playing' || this.phase === 'infiltration')
      this.remaining = Math.max(0, this.remaining - dt);
    if (this.observer) this.updateKillerAI(dt);
    for (const b of this.thrown)
      if (!b.impacted && this.time >= b.at + b.duration) {
        b.impacted = true;
        this.noise(b.f, b.x, b.z, 16, 'CRAC ! La bouteille attire les invités ici.', b.source);
      }
    this.noises = this.noises.filter((n) => this.time - n.at < 2.5);
    this.thrown = this.thrown.filter((n) => this.time - n.at < 3);
    for (const p of this.players) {
      p.invuln = Math.max(0, p.invuln - dt);
      p.attackCooldown = Math.max(0, (p.attackCooldown || 0) - dt);
      p.noise = Math.max(0, p.noise - dt * 2);
      if (p.hidden || p.climb || p.status !== 'free') {
        p.charging = false;
        p.throwCharge = 0;
      }
      if (p.charging) p.throwCharge = Math.min(1, (this.time - p.chargeStarted) / 2);
      if (p.status === 'captured') {
        p.bleed -= dt;
        if (p.bleed <= 0) {
          p.status = 'eliminated';
          this.event('eliminate', 'Le temps de sauvetage est écoulé.', { player: p.id });
        }
        continue;
      }
      if (p.status !== 'free') continue;
      if (p.climb) {
        const c = p.climb;
        c.elapsed += dt;
        const t = Math.min(1, c.elapsed / c.duration);
        p.x = c.fromX + (c.x - c.fromX) * t;
        p.z = c.fromZ + (c.z - c.fromZ) * t;
        p.climbHeight = Math.sin(t * Math.PI) * 0.8;
        p.moving = false;
        if (t >= 1) {
          p.x = c.x;
          p.z = c.z;
          p.climb = null;
          p.climbHeight = 0;
        }
        continue;
      }
      p.angle = p.input.angle || 0;
      if (p.hidden) continue;
      const inp = p.input,
        length = Math.hypot(inp.x || 0, inp.z || 0),
        moving = length > 0.05;
      if (this.cleanBlood(p, dt, moving)) continue;
      if (p.opening) {
        const d = doors.find((d) => d.id === p.opening);
        if (!d || (!inp.use && this.time - (p.openStarted || 0) > 0.2) || distance(p, d) > 1.9) {
          p.opening = null;
          p.openProgress = 0;
        } else {
          p.openProgress += dt;
          if (p.openProgress >= 2) {
            this.doorStates[d.id] = true;
            p.opening = null;
            p.openProgress = 0;
            p.interactUntil = this.time + 0.7;
            this.noise(p.f, d.x, d.z, 5, 'Un léger grincement de fenêtre.', p.id);
            this.event('door', 'Fenêtre ouverte.', { player: p.id });
          }
        }
      }
      const running = !p.dragging && inp.run && !inp.crouch && p.stamina > 1 && moving;
      p.running = running;
      p.crouching = !!inp.crouch;
      p.moving = moving;
      p.stamina = clamp(
        p.stamina + (running ? -24 : this.time < (p.exhaustedUntil || 0) ? 0 : 10) * dt,
        0,
        100,
      );
      if (moving) {
        const speed = p.dragging ? 1.25 : inp.crouch ? 1.45 : running ? 4.7 : 2.7;
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
      this.dragBody(p);
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
    this.assignRepair();
    if (this.phase === 'infiltration') this.updateParty(dt);
    if (this.phase === 'playing' || this.phase === 'infiltration')
      for (const g of this.guards) this.updateGuard(g, dt);
    if (this.guards.length && this.guards.every((g) => g.alive === false)) {
      this.phase = 'ended';
      this.result = 'elimination';
      this.event('end', 'Tous les invités sont éliminés. La maison est silencieuse.');
      return;
    }
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
      scenario: this.scenario,
      observer: this.observer,
      power: this.power,
      bodies: this.bodies,
      blood: this.blood,
      alarmAt: this.alarmAt,
      tension: this.tension,
      living: this.guards.filter((g) => g.alive !== false).length,
      time: this.time,
      remaining: this.remaining,
      duration: this.duration,
      result: this.result,
      practice: this.practice,
      mode: this.solo ? 'solo' : 'coop',
      players: this.players.map(({ input, ...p }) => ({ ...p, input: { crouch: !!input.crouch } })),
      guards: this.guards.map(({ path, pathEnd, goal, ...g }) => g),
      doors: this.doorStates,
      doorLocks: this.doorLocks,
      lights: this.lightStates,
      noises: this.noises,
      events: this.events,
      thrown: this.thrown,
    };
  }
}
