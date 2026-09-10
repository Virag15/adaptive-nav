import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_METRICS,
  capsuleRadii,
  indicatorBox,
  indicatorOffset,
  isWide,
  pillWidth,
  solveSlot,
  visibleSlots,
} from './geometry.ts';

test('slot shrinks on narrow phones and stops at the preferred size on wide ones', () => {
  assert.equal(solveSlot(430, 4, DEFAULT_METRICS), 56);
  assert.equal(solveSlot(393, 4, DEFAULT_METRICS), 52);
  assert.equal(solveSlot(320, 4, DEFAULT_METRICS), 40);
  assert.equal(solveSlot(1024, 4, DEFAULT_METRICS), 56);
});

test('more tabs means smaller slots at the same width', () => {
  assert.ok(solveSlot(393, 5, DEFAULT_METRICS) < solveSlot(393, 4, DEFAULT_METRICS));
});

test('the full cluster — tabs, two circles, gaps — always fits inside the edge inset', () => {
  const m = DEFAULT_METRICS;
  for (const vw of [280, 320, 360, 393, 430, 768])
    for (const tabs of [3, 4, 5, 6]) {
      const slot = solveSlot(vw, tabs, m);
      const sat = slot + m.pad * 2;
      const total = pillWidth('tabs', tabs, slot, sat, vw, m) + 2 * (sat + m.gap);
      assert.ok(total <= vw - m.edge * 2, `${vw}px with ${tabs} tabs needs ${total}px`);
    }
});

test('a degenerate viewport never yields a negative slot', () => {
  assert.equal(solveSlot(0, 4, DEFAULT_METRICS), 0);
});

test('capsule rule: outer radius is half the height, inner is concentric and floored at zero', () => {
  assert.deepEqual(capsuleRadii(64, 6), { outer: 32, inner: 26 });
  assert.deepEqual(capsuleRadii(8, 6), { outer: 4, inner: 0 });
});

test('buy pill spans a phone but caps on a tablet', () => {
  const slot = 52;
  const sat = 64;
  assert.equal(pillWidth('buy', 0, slot, sat, 393, DEFAULT_METRICS), 393 - 20 - 2 * (64 + 8));
  assert.equal(pillWidth('buy', 0, slot, sat, 1024, DEFAULT_METRICS), 520 - 20 - 2 * (64 + 8));
  assert.equal(pillWidth('tabs', 4, slot, sat, 393, DEFAULT_METRICS), 4 * 52 + 12);
});

test('minimized keeps only the active slot and the indicator packs left', () => {
  assert.deepEqual(visibleSlots(4, 'tabs', false, 2), [true, true, true, true]);
  assert.deepEqual(visibleSlots(4, 'tabs', true, 2), [false, false, true, false]);
  assert.deepEqual(visibleSlots(4, 'buy', false, 2), [false, false, false, false]);
  assert.equal(indicatorOffset([true, true, true, true], 2, 52), 104);
  assert.equal(indicatorOffset([false, false, true, false], 2, 52), 0);
});

test('every indicator style sits centred in the slot and shares its x with the capsule', () => {
  const capsule = indicatorBox('capsule', 56, 6);
  assert.deepEqual(capsule, { w: 56, h: 56, top: 6, dx: 0 });
  assert.deepEqual(indicatorBox('lift', 56, 6), capsule);
  const dot = indicatorBox('dot', 56, 6);
  // Horizontally centred: dx + w/2 is the slot's midpoint.
  assert.equal(dot.dx + dot.w / 2, 28);
  // Sits above the slot's bottom edge, inside the pad.
  assert.ok(dot.top + dot.h <= 6 + 56);
  const glow = indicatorBox('glow', 56, 6);
  assert.equal(glow.dx + glow.w / 2, 28);
  assert.equal(glow.top + glow.h / 2, 6 + 28);
});

test('search folds the tabs away and spans the screen like buy; hidden keeps the tab layout', () => {
  assert.deepEqual(visibleSlots(4, 'search', false, 1), [false, false, false, false]);
  assert.equal(
    pillWidth('search', 0, 52, 64, 393, DEFAULT_METRICS),
    pillWidth('buy', 0, 52, 64, 393, DEFAULT_METRICS),
  );
  assert.deepEqual(visibleSlots(4, 'hidden', false, 1), [true, true, true, true]);
  assert.equal(
    pillWidth('hidden', 4, 52, 64, 393, DEFAULT_METRICS),
    pillWidth('tabs', 4, 52, 64, 393, DEFAULT_METRICS),
  );
  assert.ok(isWide('buy') && isWide('search') && !isWide('context') && !isWide('hidden'));
});

test('select and confirm are wide; a toolbar folds the tabs but is only as wide as its tools', () => {
  for (const mode of ['select', 'confirm'] as const) {
    assert.ok(isWide(mode));
    assert.deepEqual(visibleSlots(4, mode, false, 0), [false, false, false, false]);
  }
  assert.ok(!isWide('toolbar'));
  assert.deepEqual(visibleSlots(4, 'toolbar', false, 0), [false, false, false, false]);
  // Three tools at slot 52 with 6px of pad either side.
  assert.equal(pillWidth('toolbar', 3, 52, 64, 393, DEFAULT_METRICS), 3 * 52 + 12);
});
