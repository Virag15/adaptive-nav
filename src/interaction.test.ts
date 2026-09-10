import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextIndex, releaseTarget, scrubPosition, trailVelocity } from './interaction.ts';

test('a held capsule follows each pixel inside the track and resists both edges', () => {
  assert.equal(scrubPosition(31, 52, 4), 31);
  assert.equal(scrubPosition(32, 52, 4), 32);
  const left = scrubPosition(-20, 52, 4);
  const right = scrubPosition(176, 52, 4);
  assert.ok(left > -20 && left < 0);
  assert.ok(Math.abs((right - 156) + left) < 1e-10);
  assert.equal(scrubPosition(30, 0, 4), 0);
});

test('release velocity includes the hold time and forgets stale flicks', () => {
  const trail = [{ x: 0, t: 0 }, { x: 40, t: 40 }];
  assert.equal(trailVelocity(trail, 40), 1000);
  assert.equal(trailVelocity(trail, 80), 500);
  assert.equal(trailVelocity(trail, 121), 0);
  assert.equal(trailVelocity([{ x: 40, t: 40 }], 40), 0);
});

test('cancellation restores the selected tab even if the capsule never left its cell', () => {
  for (const held of [108, 145, 0]) {
    assert.equal(releaseTarget({ held, velocity: 1500, pitch: 52, count: 4, selected: 2, cancelled: true }), 2);
  }
});

test('release projects real momentum, settles slow drags locally, and clamps ends', () => {
  const base = { pitch: 52, count: 4, selected: 0, cancelled: false };
  assert.equal(releaseTarget({ ...base, held: 52, velocity: 0 }), 1);
  assert.equal(releaseTarget({ ...base, held: 52, velocity: 900 }), 2);
  assert.equal(releaseTarget({ ...base, held: 104, velocity: -900 }), 1);
  assert.equal(releaseTarget({ ...base, held: 156, velocity: 3000 }), 3);
  assert.equal(releaseTarget({ ...base, held: 0, velocity: -3000 }), 0);
});

test('arrows wrap, and from no selection Right takes the first section and Left the last', () => {
  assert.equal(nextIndex(-1, 'ArrowRight', 4), 0);
  assert.equal(nextIndex(-1, 'ArrowLeft', 4), 3);
  assert.equal(nextIndex(0, 'ArrowLeft', 4), 3);
  assert.equal(nextIndex(3, 'ArrowRight', 4), 0);
  assert.equal(nextIndex(1, 'ArrowRight', 4), 2);
  assert.equal(nextIndex(-1, 'Home', 4), 0);
  assert.equal(nextIndex(-1, 'End', 4), 3);
  assert.equal(nextIndex(2, 'Enter', 4), -1);
  assert.equal(nextIndex(-1, 'ArrowRight', 0), -1);
});
