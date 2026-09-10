import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  NEUTRAL,
  edgeNormal,
  fillDisplacementMap,
  lensFor,
  rimProfile,
  roundedRectDistance,
} from './refraction.ts';

const close = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);

test('signed distance: negative inside, zero on the edge, radial in the corners', () => {
  close(roundedRectDistance(0, 0, 100, 40, 20), -20);
  close(roundedRectDistance(50, 0, 100, 40, 20), 0);
  close(roundedRectDistance(30, 20, 100, 40, 20), 0);
  // The corner arc: a point on the 45° diagonal of the corner circle.
  const c = 20 / Math.SQRT2;
  close(roundedRectDistance(30 + c, c, 100, 40, 20), 0);
  assert.ok(roundedRectDistance(60, 0, 100, 40, 20) > 0);
});

test('the rim profile is 1 at the lip, 0 past the band, and never negative', () => {
  close(rimProfile(0, 20), 1);
  close(rimProfile(10, 20), 0.25);
  close(rimProfile(20, 20), 0);
  close(rimProfile(25, 20), 0);
});

test('edge normals point out along the straight sides and radially at the corners', () => {
  assert.deepEqual(edgeNormal(45, 0, 100, 40, 20), [1, 0]);
  assert.deepEqual(edgeNormal(-45, 0, 100, 40, 20), [-1, 0]);
  assert.deepEqual(edgeNormal(0, -15, 100, 40, 20), [0, -1]);
  const [nx, ny] = edgeNormal(40, 10, 100, 40, 20);
  close(Math.hypot(nx, ny), 1);
  assert.ok(nx > 0 && ny > 0);
});

test('the map is neutral in the middle and pulls inward at the rim', () => {
  // A rounded rectangle, not a capsule, so the lips have straight sections to probe.
  const w = 96;
  const h = 32;
  const out = new Uint8ClampedArray(w * h * 4);
  fillDisplacementMap(out, w, h, 8, h / 3);
  const px = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    return [out[i], out[i + 1], out[i + 2], out[i + 3]];
  };
  assert.deepEqual(px(48, 16), [NEUTRAL, NEUTRAL, NEUTRAL, 255]);
  // Right lip: the sample point moves left (toward the centre), so red drops.
  const [rRight, gRight] = px(95, 16);
  assert.ok(rRight < NEUTRAL, `right lip red ${rRight}`);
  assert.equal(gRight, NEUTRAL);
  // Left lip mirrors it.
  const [rLeft] = px(0, 16);
  assert.equal(rLeft, 2 * NEUTRAL - rRight);
  // Top lip: y moves down, so green rises; x stays put on a straight edge.
  const [rTop, gTop] = px(48, 0);
  assert.equal(rTop, NEUTRAL);
  assert.ok(gTop > NEUTRAL, `top lip green ${gTop}`);
  // Nothing outside the rounded corners — those pixels are outside the shape.
  assert.deepEqual(px(0, 0).slice(0, 2), [NEUTRAL, NEUTRAL]);
});

test('the lens scale never exceeds the fold-over limit', () => {
  const { band, scale } = lensFor(64, 1);
  close(band, 64 / 3);
  // The deepest pull is scale/2 at the lip; the profile folds once it passes band/2.
  assert.ok(scale / 2 <= band / 2 + 1e-9);
  close(lensFor(64, 0.5).scale, band / 2);
  close(lensFor(64, 0).scale, 0);
  close(lensFor(64, 3).scale, band);
});
