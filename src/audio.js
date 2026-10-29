// Original procedural sounds: no third-party recordings or licensed samples.
export class Sound {
  constructor() {
    this.ctx = null;
    this.volumes = { music: 0.22, effects: 0.55, voices: 0.55 };
    this.lastEvent = 0;
    this.lastStep = 0;
    this.lastPulse = 0;
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
  voice(text) {
    if (!('speechSynthesis' in window) || this.volumes.voices < 0.01) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'fr-FR';
    u.rate = 1.1;
    u.pitch = 0.8;
    u.volume = this.volumes.voices;
    const voice = speechSynthesis
      .getVoices()
      .find((v) => v.lang.startsWith('fr') && v.localService);
    if (voice) u.voice = voice;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }
  update(state, me) {
    if (!state || !me) return;
    for (const e of state.events) {
      if (e.id <= this.lastEvent) continue;
      this.lastEvent = e.id;
      if (e.f !== undefined && (e.f !== me.f || Math.hypot(e.x - me.x, e.z - me.z) > 20)) continue;
      if (e.type === 'voice') this.voice(e.text.replace(/^.*? : /, ''));
      if (e.type === 'intro') this.voice(e.text);
      if (e.type === 'noise') {
        this.noise(0.3, 0.3);
        this.tone(320, 0.3, 0.08, 'triangle', 90);
      }
      if (e.type === 'door' || e.type === 'hide') this.tone(135, 0.2, 0.08, 'sawtooth', 70);
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
      this.tone(me.f === 0 ? 95 : 140, 0.06, me.crouching ? 0.025 : 0.07, 'triangle', 40);
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
