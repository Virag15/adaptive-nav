import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EDGE_LENS, FULL_LENS, NO_LENS, isChromium, isLowEnd, resolveQuality } from './quality.ts';

const capable = { chromium: true, lowEnd: false, reducedTransparency: false };

test('auto reads the device: full where it can, edges where it should, off where it must', () => {
  assert.deepEqual(resolveQuality('auto', capable), FULL_LENS);
  assert.deepEqual(resolveQuality('auto', { ...capable, lowEnd: true }), EDGE_LENS);
  assert.deepEqual(resolveQuality('auto', { ...capable, chromium: false }), NO_LENS);
  assert.deepEqual(resolveQuality('auto', { ...capable, reducedTransparency: true }), NO_LENS);
});

test('a forced quality is honoured whatever the device says', () => {
  const weak = { chromium: false, lowEnd: true, reducedTransparency: true };
  assert.deepEqual(resolveQuality('full', weak), FULL_LENS);
  assert.deepEqual(resolveQuality('edges', weak), EDGE_LENS);
  assert.deepEqual(resolveQuality('off', capable), NO_LENS);
});

test('edges is the pill alone, in one pass', () => {
  assert.ok(EDGE_LENS.pill && !EDGE_LENS.circles && !EDGE_LENS.bubble && !EDGE_LENS.dispersion);
});

test('Chromium is recognised by its own brands, never by what a string lacks', () => {
  assert.equal(isChromium({ userAgentData: { brands: [{ brand: 'Chromium' }, { brand: 'Google Chrome' }] } }), true);
  assert.equal(isChromium({ userAgentData: { brands: [{ brand: 'Not/A)Brand' }] } }), false);
  assert.equal(isChromium({ userAgentData: {} }), false);
  assert.equal(isChromium({}), false);
});

test('low end is four gigabytes or four cores; an engine that hides both reads as capable', () => {
  assert.equal(isLowEnd({ deviceMemory: 8, hardwareConcurrency: 8 }), false);
  assert.equal(isLowEnd({ deviceMemory: 4, hardwareConcurrency: 8 }), true);
  assert.equal(isLowEnd({ deviceMemory: 8, hardwareConcurrency: 4 }), true);
  assert.equal(isLowEnd({}), false);
});
