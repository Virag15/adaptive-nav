import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RELEASE_SPRING, ROUTE_CURVE, ROUTE_SPRING, SELECTION_SPRING, SHAPE_SPRING, springCurve } from './springs.ts';

const stops = (easing: string) => easing.slice('linear('.length, -1).split(', ').map(Number);

test('a spring curve runs from rest to rest', () => {
  for (const spring of [SHAPE_SPRING, SELECTION_SPRING, RELEASE_SPRING]) {
    const s = stops(springCurve(spring).easing);
    assert.equal(s[0], 0);
    assert.equal(s.at(-1), 1);
  }
});

test('a damped spring climbs without overshoot, an underdamped one overshoots', () => {
  // The page rides the route spring beside the bar; an overshoot there would
  // push the page past its place while the bar is already still.
  const route = stops(ROUTE_CURVE.easing);
  route.forEach((v, i) => {
    assert.ok(v <= 1, `stop ${i} is ${v}`);
    if (i) assert.ok(v >= route[i - 1], `stop ${i} falls back`);
  });
  assert.ok(Math.max(...stops(springCurve(RELEASE_SPRING).easing)) > 1);
});

test('the route curve is the bar’s shape spring, at the length it takes', () => {
  assert.equal(ROUTE_SPRING, SHAPE_SPRING);
  assert.deepEqual(ROUTE_CURVE, springCurve(SHAPE_SPRING));
  // Long enough to be seen as a movement, short of the 400ms a person reads as waiting.
  assert.ok(ROUTE_CURVE.duration > 250 && ROUTE_CURVE.duration < 400, `${ROUTE_CURVE.duration}ms`);
  // A softer spring takes longer: the length follows the spring, not a constant.
  assert.ok(springCurve(SELECTION_SPRING).duration > ROUTE_CURVE.duration);
});
