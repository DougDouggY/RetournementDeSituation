import test from 'node:test';
import assert from 'node:assert/strict';
import { Sound } from '../src/audio.js';
test('speech normalizes room slashes, suppresses repeated phrases and does not interrupt an active sentence', () => {
  const saved = Object.fromEntries(
    ['window', 'speechSynthesis', 'SpeechSynthesisUtterance'].map((k) => [k, globalThis[k]]),
  );
  try {
    const spoken = [];
    globalThis.window = { speechSynthesis: {} };
    globalThis.speechSynthesis = {
      speaking: false,
      getVoices: () => [],
      cancel: () => {},
      speak: (u) => spoken.push(u.text),
    };
    globalThis.SpeechSynthesisUtterance = class {
      constructor(text) {
        this.text = text;
      }
    };
    const sound = new Sound();
    sound.voice('Bureau / bibliothèque');
    sound.voice('Bureau / bibliothèque');
    assert.deepEqual(spoken, ['Bureau  et  bibliothèque']);
    globalThis.speechSynthesis.speaking = true;
    sound.voice('Autre phrase');
    assert.equal(spoken.length, 1);
    globalThis.speechSynthesis.speaking = false;
    sound.voice('Autre phrase');
    assert.equal(spoken.length, 2);
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete globalThis[k];
      else globalThis[k] = v;
    }
  }
});
