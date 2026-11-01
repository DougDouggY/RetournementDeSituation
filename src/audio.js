import { lineClear, regionAt } from '../shared/map.js';

export function proximityGain(source, listener, doors = {}, range = 14) {
  if (source.f !== listener.f) return 0;
  const distance = Math.hypot(source.x - listener.x, source.z - listener.z);
  if (!Number.isFinite(distance) || distance >= range) return 0;
  const gain = Math.pow(Math.max(0, 1 - distance / range), 2);
  return gain * (lineClear(listener.f, listener, source, doors, true, false) ? 1 : 0.18);
}
export function voiceGain(source, listener, doors = {}) {
  if (!lineClear(listener.f, listener, source, doors, true, false)) return 0;
  return proximityGain(source, listener, doors, 6);
}
// Original procedural sounds: no third-party recordings or licensed samples.
export class Sound {
  constructor() {
    this.ctx = null;
    this.volumes = { music: 0.22, effects: 0.55, voices: 0.55 };
    this.lastEvent = 0;
    this.spoken = new Map();
    this.lastStep = 0;
    this.lastPulse = 0;
    this.musicBeat = 0;
    this.lastMusic = 0;
  }
  start() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      const osc = this.ctx.createOscillator(),
        low = this.ctx.createOscillator(),
        filter = this.ctx.createBiquadFilter();
      this.ambient = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 55;
      low.frequency.value = 55.7;
      filter.type = 'lowpass';
      filter.frequency.value = 120;
      osc.connect(filter);
      low.connect(filter);
      filter.connect(this.ambient);
      this.ambient.connect(this.ctx.destination);
      osc.start();
      low.start();
    }
    this.ctx.resume();
    this.apply();
  }
  apply() {
    if (this.ambient)
      this.ambient.gain.setTargetAtTime(this.volumes.music * 0.07, this.ctx.currentTime, 0.2);
  }
  tone(freq = 220, length = 0.15, volume = 0.1, type = 'sine', end = 80) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime,
      o = this.ctx.createOscillator(),
      g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(15, end), t + length);
    g.gain.setValueAtTime(Math.max(0.0001, volume * this.volumes.effects), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + length);
    o.connect(g);
    g.connect(this.ctx.destination);
    o.start();
    o.stop(t + length);
  }
  noise(length = 0.2, volume = 0.12) {
    if (!this.ctx) return;
    const n = Math.floor(this.ctx.sampleRate * length),
      buffer = this.ctx.createBuffer(1, n, this.ctx.sampleRate),
      arr = buffer.getChannelData(0);
    for (let i = 0; i < n; i++) arr[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const source = this.ctx.createBufferSource(),
      filter = this.ctx.createBiquadFilter(),
      gain = this.ctx.createGain();
    source.buffer = buffer;
    filter.type = 'lowpass';
    filter.frequency.value = 800;
    gain.gain.value = volume * this.volumes.effects;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    source.start();
  }
  voice(text, gain = 1) {
    if (!('speechSynthesis' in window) || this.volumes.voices * gain < 0.01) return;
    text = text.replaceAll('/', ' et ');
    const now = performance.now(),
      key = text.toLocaleLowerCase('fr');
    if (now - (this.spoken.get(key) ?? -Infinity) < 45000) return;
    if (speechSynthesis.speaking) return;
    this.spoken.set(key, now);
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'fr-FR';
    u.rate = 1.1;
    u.pitch = 0.8;
    u.volume = Math.min(1, this.volumes.voices * gain);
    const voice = speechSynthesis
      .getVoices()
      .find((v) => v.lang.startsWith('fr') && v.localService);
    if (voice) u.voice = voice;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
    return true;
  }
  musicNote(frequency, length, volume, type = 'sine') {
    if (!this.ctx || volume <= 0 || this.volumes.music <= 0) return;
    const t = this.ctx.currentTime,
      osc = this.ctx.createOscillator(),
      gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(volume * this.volumes.music, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + length);
  }
  update(state, me) {
    if (!state || !me) return;
    if (this.ambient)
      this.ambient.gain.setTargetAtTime(
        state.paused ? 0 : this.volumes.music * 0.025,
        this.ctx.currentTime,
        0.15,
      );
    if (state.paused) {
      if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
      return;
    }
    if (this.activeVoiceSource && voiceGain(this.activeVoiceSource, me, state.doors) < 0.025) {
      if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
      this.activeVoiceSource = null;
    }
    for (const e of state.events) {
      if (e.id <= this.lastEvent) continue;
      this.lastEvent = e.id;
      if (e.f !== undefined && (e.f !== me.f || Math.hypot(e.x - me.x, e.z - me.z) > 20)) continue;
      if (e.type === 'voice') {
        const gain = voiceGain(e, me, state.doors);
        if (gain >= 0.025) {
          if (this.voice(e.text.replace(/^.*? : /, ''), gain)) this.activeVoiceSource = e;
        }
      }
      if (e.type === 'intro') this.voice(e.text);
      if (e.type === 'kill') {
        this.noise(0.4, 0.4);
        this.tone(90, 0.2, 0.12, 'triangle', 35);
      }
      if (e.type === 'noise') {
        this.noise(0.3, 0.3);
        this.tone(320, 0.3, 0.08, 'triangle', 90);
      }
      if (e.type === 'door' || e.type === 'hide') this.tone(135, 0.2, 0.08, 'sawtooth', 70);
      if (e.type === 'clean') this.noise(0.18, 0.08);
      if (e.type === 'switch') this.noise(0.025, 0.1);
      if (e.type === 'hurt' || e.type === 'capture') {
        this.tone(80, 0.5, 0.3, 'sawtooth', 30);
        this.noise(0.3, 0.3);
      }
      if (e.type === 'end')
        for (let i = 0; i < 3; i++)
          setTimeout(() => this.tone(220 * (i + 1), 0.6, 0.15, 'sine', 220 * (i + 1)), i * 190);
    }
    const now = performance.now();
    if (
      me.moving &&
      me.status === 'free' &&
      !me.hidden &&
      now - this.lastStep > (me.running ? 240 : me.crouching ? 650 : 400)
    ) {
      this.lastStep = now;
      this.tone(110, 0.045, me.crouching ? 0.002 : me.running ? 0.014 : 0.006, 'triangle', 55);
    }
    // Original terrace loop, synthesized locally; no remote audio or samples.
    const party =
      state.power !== false && state.phase === 'infiltration'
        ? Math.max(
            proximityGain({ f: 1, x: -12, z: -22 }, me, state.doors, 70),
            me.f === 1 && regionAt(me.f, me.x, me.z) === 'outside'
              ? Math.max(0, 0.45 - Math.hypot(me.x + 12, me.z + 22) / 130)
              : 0,
          )
        : 0;
    if (now - this.lastMusic > 60000 / 110 / 2) {
      this.lastMusic = now;
      const melody = [220, 261.63, 329.63, 392, 329.63, 293.66, 261.63, 196];
      this.musicNote(melody[this.musicBeat % melody.length], 0.24, party * 0.12, 'triangle');
      if (this.musicBeat % 2 === 0)
        this.musicNote(this.musicBeat % 8 < 4 ? 110 : 98, 0.4, party * 0.1);
      this.musicBeat++;
    }
    const chase = state.guards.some(
      (g) => g.target === me.id && g.state === 'chase' && g.f === me.f,
    );
    if (chase && now - this.lastPulse > 650) {
      this.lastPulse = now;
      this.tone(60, 0.18, this.volumes.music * 0.7, 'sine', 40);
      setTimeout(() => this.tone(55, 0.12, this.volumes.music * 0.5, 'sine', 35), 180);
    }
  }
}
