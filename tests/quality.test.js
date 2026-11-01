import test from 'node:test';
import assert from 'node:assert/strict';
import { GameScene } from '../src/scene.js';

test('sustained slow rendering reduces resolution twice without changing game state', () => {
  const previous = globalThis.devicePixelRatio;
  globalThis.devicePixelRatio = 2;
  try {
    const ratios = [];
    const scene = {
      renderer: { setPixelRatio: (ratio) => ratios.push(ratio), shadowMap: { enabled: true } },
      resize() {},
    };
    const sample = (fps) => GameScene.prototype.adaptQuality.call(scene, fps);
    sample(15);
    sample(60);
    assert.deepEqual(ratios, [], 'an isolated slow sample should not lower quality');
    for (let i = 0; i < 3; i++) sample(20);
    assert.deepEqual(ratios, [0.9]);
    assert.equal(scene.renderer.shadowMap.enabled, false);
    for (let i = 0; i < 3; i++) sample(20);
    assert.deepEqual(ratios, [0.9, 0.65]);
    for (let i = 0; i < 10; i++) sample(10);
    assert.deepEqual(ratios, [0.9, 0.65]);
  } finally {
    if (previous === undefined) delete globalThis.devicePixelRatio;
    else globalThis.devicePixelRatio = previous;
  }
});
