import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../shared/simulation.js';
import {
  doors,
  devices,
  blocked,
  lineClear,
  doorLeafContains,
  AJAR_ANGLE,
  peekView,
  canObserve,
} from '../shared/map.js';
import { Sound, proximityGain, voiceGain } from '../src/audio.js';

test('conversation is local, inaudible through a closed door and cancelled when walking away', () => {
  const listener = { f: 1, x: -27, z: -1 };
  assert.ok(voiceGain({ f: 1, x: -28, z: -1 }, listener) > 0.5);
  assert.equal(voiceGain({ f: 1, x: -34, z: -1 }, listener), 0);
  const source = { f: 1, x: -23, z: -1 };
  assert.equal(voiceGain(source, listener, {}), 0);
  assert.ok(voiceGain(source, listener, { 'entry-west': true }) > 0);
  const previous = globalThis.speechSynthesis;
  let cancelled = 0;
  globalThis.speechSynthesis = { cancel: () => cancelled++ };
  try {
    const sound = new Sound();
    sound.activeVoiceSource = source;
    sound.update(
      { events: [], guards: [], doors: {}, phase: 'infiltration', power: false },
      listener,
    );
    assert.equal(cancelled, 1);
    assert.equal(sound.activeVoiceSource, null);
  } finally {
    if (previous === undefined) delete globalThis.speechSynthesis;
    else globalThis.speechSynthesis = previous;
  }
});

test('nearby voices fade with distance, stop between floors and attenuate behind opaque doors', () => {
  const listener = { f: 1, x: -27, z: -1 };
  const nearby = { f: 1, x: -28, z: -1 };
  assert.ok(proximityGain(nearby, listener) > proximityGain({ ...nearby, x: -35 }, listener));
  assert.equal(proximityGain({ ...nearby, x: -45 }, listener), 0);
  assert.equal(proximityGain({ ...nearby, f: 2 }, listener), 0);
  const inside = { f: 1, x: -23, z: -1 };
  assert.ok(
    proximityGain(inside, listener, {}) <
      proximityGain(inside, listener, { 'entry-west': true }) * 0.2,
  );
});

test('tap E opens normally; holding E crouched looks through a closed keyhole until release', () => {
  const s = new Simulation();
  s.addPlayer('p');
  s.start(true);
  const p = s.players[0];
  Object.assign(p, { f: 1, x: -26.1, z: -1 });
  s.setInput('p', { use: true, crouch: true });
  s.action('p', 'beginUse');
  assert.equal(s.doorStates['entry-west'], false, 'the initial press must not reveal the room');
  s.action('p', 'endUse');
  assert.equal(s.doorStates['entry-west'], true);
  s.action('p', 'interact');
  s.action('p', 'beginUse');
  s.time += 0.5;
  s.updatePeek(p, false);
  assert.equal(s.doorStates['entry-west'], false);
  assert.equal(p.peeking, 'entry-west');
  s.action('p', 'endUse');
  assert.equal(s.doorStates['entry-west'], false);
  assert.equal(p.peeking, null);
  s.doorLocks['entry-west'] = { region: 'hall1' };
  s.action('p', 'beginUse');
  s.time += 0.5;
  s.updatePeek(p, false);
  assert.equal(s.doorStates['entry-west'], false);
});

test('narrow ajar doors permit sight through the slit but block every body crossing', () => {
  const d = doors.find((d) => d.id === 'entry-west');
  assert.equal(d.d, 1);
  const states = { [d.id]: 'ajar' };
  const x = d.x - Math.sin(AJAR_ANGLE) * 0.5,
    z = d.z + 0.5 - Math.cos(AJAR_ANGLE) * 0.5;
  assert.equal(doorLeafContains(d, x, z), true);
  assert.equal(blocked(1, x, z, states), true);
  assert.equal(lineClear(1, { x: -27, z: -1 }, { x: -23, z: -1 }, states), false);
  assert.equal(lineClear(1, { x: -25.2, z: -1.35 }, { x: -24.8, z: -1.35 }, states), true);
  for (let z = -1.45; z < -0.5; z += 0.05) assert.equal(blocked(1, -25, z, states, 0.32), true);
  assert.equal(blocked(1, -25, -1, { [d.id]: true }, 0.32), false);
});

test('B leaves an opaque door ajar, E opens it fully, and locked doors stay closed', () => {
  const s = new Simulation();
  s.addPlayer('p');
  s.start(true);
  const p = s.players[0];
  Object.assign(p, { f: 1, x: -26.1, z: -1 });
  s.action('p', 'ajar');
  assert.equal(s.doorStates['entry-west'], 'ajar');
  assert.equal(lineClear(1, { x: -27, z: -1 }, { x: -23, z: -1 }, s.doorStates), false);
  s.action('p', 'interact');
  assert.equal(s.doorStates['entry-west'], true);
  s.action('p', 'ajar');
  s.action('p', 'ajar');
  assert.equal(s.doorStates['entry-west'], false);
  s.doorLocks['entry-west'] = { region: 'hall1' };
  s.action('p', 'ajar');
  assert.equal(s.doorStates['entry-west'], false);
});

test('the closed keyhole provides an interior view without exposing the body, and cancels on movement', () => {
  const s = new Simulation();
  s.addPlayer('p');
  s.start(true);
  const p = s.players[0];
  Object.assign(p, { f: 1, x: -26.1, z: -1 });
  s.setInput('p', { use: true, crouch: true });
  s.action('p', 'beginUse');
  s.time += 0.5;
  s.updatePeek(p, false);
  const eye = peekView(p, s.doorStates);
  assert.ok(eye.x > -25 && p.x < -25);
  assert.ok(canObserve(p, { f: 1, x: -24, z: -1.35 }, s.doorStates));
  const guard = s.guards[0];
  Object.assign(guard, { f: 1, x: -24, z: -1.35, angle: -Math.PI / 2 });
  assert.equal(s.canSee(guard, p), false);
  s.updatePeek(p, true);
  assert.equal(s.doorStates['entry-west'], false);
  assert.equal(p.peeking, null);
  s.doorStates['entry-west'] = true;
  p.torch = true;
  assert.equal(s.canSee(guard, p), true, 'the player becomes visible through a fully open door');
});

test('office switch is reachable beside the jamb and does not steal the door interaction', () => {
  const s = new Simulation();
  s.addPlayer('p');
  s.start(true);
  const p = s.players[0],
    light = devices.find((d) => d.room === 'r1-3' && d.type === 'light');
  assert.equal(blocked(1, light.x, light.z), false);
  Object.assign(p, { f: 1, x: -11.1, z: 8 });
  assert.equal(s.nearby(p).kind, 'door');
  Object.assign(p, { x: light.x, z: light.z });
  assert.equal(s.nearby(p).obj.id, light.id);
});

test('walking footsteps are quieter than running and crouching is quietest', () => {
  const sound = new Sound(),
    levels = [];
  sound.tone = (f, duration, gain) => levels.push(gain);
  const state = { events: [], guards: [], doors: {}, phase: 'playing' };
  const p = { f: 1, x: 0, z: 0, moving: true, status: 'free' };
  for (const mode of [{ crouching: true }, { crouching: false }, { running: true }]) {
    Object.assign(p, mode);
    sound.lastStep = -Infinity;
    sound.update(state, p);
  }
  assert.ok(levels[0] < levels[1] && levels[1] < levels[2]);
  assert.ok(levels[2] < 0.025);
});

test('terrace music follows power and distance and uses the music channel', () => {
  const sound = new Sound(),
    notes = [];
  sound.musicNote = (...args) => notes.push(args);
  const state = { events: [], guards: [], doors: {}, phase: 'infiltration', power: true };
  const p = { f: 1, x: -12, z: -22, status: 'free' };
  const beat = () => {
    sound.lastMusic = -Infinity;
    sound.update(state, p);
  };
  beat();
  assert.ok(notes.some((n) => n[2] > 0));
  notes.length = 0;
  state.power = false;
  beat();
  assert.ok(notes.every((n) => n[2] === 0));
  notes.length = 0;
  state.power = true;
  p.f = 2;
  beat();
  assert.ok(notes.every((n) => n[2] === 0));
  notes.length = 0;
  state.paused = true;
  beat();
  assert.equal(notes.length, 0);
});
