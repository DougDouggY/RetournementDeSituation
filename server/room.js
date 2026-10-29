import { Simulation } from '../shared/simulation.js';
export class Room {
  constructor(code, { duration, seed } = {}) {
    this.code = code;
    this.sim = new Simulation({ duration, seed });
    this.members = new Map();
    this.host = null;
    this.last = Date.now();
    this.broadcastAt = 0;
    this.paused = false;
    this.emptySince = Date.now();
    this.created = Date.now();
  }
  join(socket, token) {
    let member = this.members.get(token);
    if (member && member.socket && member.socket.readyState === 1) {
      socket.send(
        JSON.stringify({
          type: 'error',
          message: 'Ce joueur est déjà connecté dans un autre onglet.',
        }),
      );
      socket.close(4001, 'Duplicate session');
      return;
    }
    if (!member) {
      if (this.members.size >= 2) {
        socket.send(JSON.stringify({ type: 'error', message: 'Ce salon est complet.' }));
        socket.close(4000, 'Full');
        return;
      }
      if (this.sim.phase !== 'lobby') {
        socket.send(JSON.stringify({ type: 'error', message: 'La manche a déjà commencé.' }));
        socket.close(4000, 'Started');
        return;
      }
      member = { id: crypto.randomUUID(), token, socket: null, disconnectedAt: null };
      this.members.set(token, member);
      this.sim.addPlayer(member.id, this.members.size - 1);
      if (!this.host) this.host = member.id;
    }
    member.socket = socket;
    member.disconnectedAt = null;
    const p = this.sim.players.find((p) => p.id === member.id);
    p.connected = true;
    p.input = {};
    socket.send(
      JSON.stringify({ type: 'welcome', id: member.id, code: this.code, host: this.host }),
    );
    this.broadcast();
    return member;
  }
  leave(member, socket) {
    if (!member || member.socket !== socket) return;
    member.socket = null;
    member.disconnectedAt = Date.now();
    const p = this.sim.players.find((p) => p.id === member.id);
    if (p) {
      p.connected = false;
      p.input = {};
      p.charging = false;
      p.throwCharge = 0;
    }
    if (this.sim.phase === 'lobby') {
      this.members.delete(member.token);
      this.sim.players = this.sim.players.filter((p) => p.id !== member.id);
      if (this.host === member.id) this.host = this.sim.players[0]?.id || null;
    }
    this.broadcast();
  }
  message(member, raw) {
    if (!member) return;
    let m;
    try {
      m = JSON.parse(raw);
    } catch {
      return;
    }
    if (!m || typeof m !== 'object' || Array.isArray(m)) return;
    if (m.type === 'input') this.sim.setInput(member.id, m);
    if (
      m.type === 'action' &&
      ['interact', 'torch', 'throw', 'attack', 'drag', 'climb', 'charge', 'cancelThrow'].includes(
        m.action,
      )
    )
      this.sim.action(member.id, m.action);
    if (m.type === 'character' && this.sim.phase === 'lobby' && [0, 1].includes(m.character)) {
      const p = this.sim.players.find((p) => p.id === member.id),
        other = this.sim.players.find((p) => p.id !== member.id);
      if (other && other.character === m.character) other.character = p.character;
      p.character = m.character;
      this.broadcast();
    }
    if (m.type === 'start' && member.id === this.host) {
      if (this.sim.players.every((p) => p.connected))
        this.sim.start(!!m.practice && this.sim.players.length === 1);
      this.broadcast();
    }
  }
  tick(now = Date.now()) {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    let waiting = false;
    for (const m of this.members.values())
      if (m.disconnectedAt) {
        if (now - m.disconnectedAt < 45000) waiting = true;
        else {
          const p = this.sim.players.find((p) => p.id === m.id);
          if (p) p.status = 'eliminated';
        }
      }
    this.paused = waiting && ['playing', 'intro', 'infiltration'].includes(this.sim.phase);
    if (!this.paused) this.sim.tick(dt);
    if (now - this.broadcastAt >= 100) {
      this.broadcastAt = now;
      this.broadcast();
    }
    if ([...this.members.values()].some((m) => m.socket)) this.emptySince = now;
  }
  broadcast() {
    const data = JSON.stringify({
      type: 'state',
      code: this.code,
      host: this.host,
      paused: this.paused,
      ...this.sim.snapshot(),
    });
    for (const m of this.members.values())
      if (m.socket?.readyState === 1)
        try {
          m.socket.send(data);
        } catch {}
  }
}
export function validCode(code) {
  return /^[A-HJ-NP-Z2-9]{6}$/.test(code);
}
export function makeCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
    bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
}

export function allowedOrigin(origin, host) {
  if (!origin) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
