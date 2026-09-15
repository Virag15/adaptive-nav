import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enterScreen, routeEasing } from './screenEnter.ts';
import { ROUTE_CURVE } from './springs.ts';

/** An element that records what it was asked to animate. */
function fakeElement() {
  const calls: { keyframes: Keyframe[]; options: KeyframeAnimationOptions }[] = [];
  const animation = { startTime: null as number | null, cancel() {} };
  return {
    calls,
    animation,
    animate(keyframes: Keyframe[], options: KeyframeAnimationOptions) {
      calls.push({ keyframes, options });
      return animation;
    },
  } as unknown as HTMLElement & { calls: typeof calls; animation: typeof animation };
}

test('a push comes in from the side it is going, a section change settles downward', () => {
  const pushed = fakeElement();
  enterScreen(pushed, { direction: 1 });
  assert.match(String(pushed.calls[0].keyframes[0].transform), /translate3d\(56px, 0, 0\)/);

  const popped = fakeElement();
  enterScreen(popped, { direction: -1 });
  assert.match(String(popped.calls[0].keyframes[0].transform), /translate3d\(-56px, 0, 0\)/);

  const section = fakeElement();
  enterScreen(section, { direction: 0 });
  assert.match(String(section.calls[0].keyframes[0].transform), /translate3d\(0, 14px, 0\)/);
  // Not from zero: fading up from nothing shows the page's ground for a frame.
  assert.equal(section.calls[0].keyframes[0].opacity, 0.4);
  assert.equal(section.calls[0].keyframes[1].opacity, 1);
});

test('the page runs the bar’s route curve, started at the moment it was created', () => {
  const el = fakeElement();
  const before = performance.now();
  enterScreen(el, { direction: 1 });
  assert.equal(el.calls[0].options.duration, ROUTE_CURVE.duration);
  assert.equal(el.calls[0].options.easing, routeEasing());
  assert.ok(el.animation.startTime !== null && el.animation.startTime >= before);
});

test('reduced motion, a missing element or an engine without animations get no entrance', () => {
  const el = fakeElement();
  assert.equal(enterScreen(el, { skip: true }), null);
  assert.equal(el.calls.length, 0);
  assert.equal(enterScreen(null), null);
  assert.equal(enterScreen({} as HTMLElement), null);
});

test('the easing falls back where linear() is missing', () => {
  // No CSS.supports here, which is the same answer an older engine gives.
  assert.equal(routeEasing(), 'cubic-bezier(0.23, 1, 0.32, 1)');
  assert.match(ROUTE_CURVE.easing, /^linear\(0, /);
});
