import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REGULAR_MIN, nearestTab, resolvePlacement, sameRects, tabAt } from './placement.ts';

const rects = [
  { left: 0, width: 80 },
  { left: 80, width: 60 },
  { left: 140, width: 100 },
];

test('auto follows the size class; a fixed placement ignores it', () => {
  assert.equal(resolvePlacement('auto', true), 'top');
  assert.equal(resolvePlacement('auto', false), 'bottom');
  assert.equal(resolvePlacement('bottom', true), 'bottom');
  assert.equal(resolvePlacement('top', false), 'top');
  // An iPad in portrait is the narrowest regular-width view.
  assert.equal(REGULAR_MIN, 768);
});

test('the tab under a point, clamped to the ends', () => {
  assert.equal(tabAt(rects, 0), 0);
  assert.equal(tabAt(rects, 79.9), 0);
  assert.equal(tabAt(rects, 80), 1);
  assert.equal(tabAt(rects, 200), 2);
  assert.equal(tabAt(rects, -30), 0);
  assert.equal(tabAt(rects, 900), 2);
  assert.equal(tabAt([], 10), -1);
});

test('the nearest tab by centre, for where a flick would rest', () => {
  assert.equal(nearestTab(rects, 30), 0);
  assert.equal(nearestTab(rects, 80), 1);
  assert.equal(nearestTab(rects, 150), 1);
  assert.equal(nearestTab(rects, 170), 2);
  assert.equal(nearestTab([], 10), -1);
});

test('measurements that agree to the pixel count as the same', () => {
  assert.ok(sameRects(rects, rects.map((r) => ({ ...r, left: r.left + 0.2 }))));
  assert.ok(!sameRects(rects, rects.map((r) => ({ ...r, width: r.width + 1 }))));
  assert.ok(!sameRects(rects, rects.slice(1)));
});
