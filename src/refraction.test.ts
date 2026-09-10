import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BAND,
  FOLD_LIMIT,
  NEUTRAL,
  PEAK,
  edgeNormal,
  fillDisplacementMap,
  fillRimMask,
  frostLip,
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

test('the lens profile bends nothing at the lip, peaks early, and is gone by the band', () => {
  close(rimProfile(0, 20), 0);
  close(rimProfile(PEAK * 20, 20), 1);
  close(rimProfile(20, 20), 0);
  close(rimProfile(25, 20), 0);
  // Rises to the peak, falls after it, never negative, never above 1.
  let prev = -1;
  for (let d = 0; d <= PEAK * 20; d += 0.1) {
    const v = rimProfile(d, 20);
    assert.ok(v >= prev - 1e-12 && v >= 0 && v <= 1, `rise at ${d}`);
    prev = v;
  }
  prev = rimProfile(PEAK * 20, 20);
  for (let d = PEAK * 20; d <= 20; d += 0.1) {
    const v = rimProfile(d, 20);
    assert.ok(v <= prev + 1e-12 && v >= 0, `decay at ${d}`);
    prev = v;
  }
});

test('at the fold limit the rim compresses and magnifies but never inverts', () => {
  const band = 25.6;
  const pull = band * FOLD_LIMIT;
  // Where each depth samples from; must never run backwards.
  let prev = -Infinity;
  for (let s = 0; s <= band; s += 0.05) {
    const sampled = s + pull * rimProfile(s, band);
    assert.ok(sampled >= prev - 1e-9, `fold at depth ${s}`);
    prev = sampled;
  }
  // And a pull a tenth stronger does fold, so the limit is doing work.
  let folded = false;
  prev = -Infinity;
  for (let s = 0; s <= band; s += 0.05) {
    const sampled = s + pull * 1.1 * rimProfile(s, band);
    if (sampled < prev - 1e-9) folded = true;
    prev = sampled;
  }
  assert.ok(folded);
});

test('edge normals point out along the straight sides and radially at the corners', () => {
  assert.deepEqual(edgeNormal(45, 0, 100, 40, 20), [1, 0]);
  assert.deepEqual(edgeNormal(-45, 0, 100, 40, 20), [-1, 0]);
  assert.deepEqual(edgeNormal(0, -15, 100, 40, 20), [0, -1]);
  const [nx, ny] = edgeNormal(40, 10, 100, 40, 20);
  close(Math.hypot(nx, ny), 1);
  assert.ok(nx > 0 && ny > 0);
});

test('the map is neutral in the middle and pulls inward through the rim', () => {
  // A rounded rectangle, not a capsule, so the lips have straight sections to probe.
  const w = 96;
  const h = 32;
  const band = h * BAND;
  const out = new Uint8ClampedArray(w * h * 4);
  fillDisplacementMap(out, w, h, 8, band);
  const px = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    return [out[i], out[i + 1], out[i + 2], out[i + 3]];
  };
  assert.deepEqual(px(48, 16), [NEUTRAL, NEUTRAL, NEUTRAL, 255]);
  // Just inside the right lip, at the peak: the sample point moves left, so red drops.
  const peakX = 95 - Math.round(PEAK * band);
  const [rRight, gRight] = px(peakX, 16);
  assert.ok(rRight < NEUTRAL - 100, `right rim red ${rRight}`);
  assert.equal(gRight, NEUTRAL);
  // Left rim mirrors it.
  const [rLeft] = px(95 - peakX, 16);
  assert.equal(rLeft, 2 * NEUTRAL - rRight);
  // Top rim: y moves down, so green rises; x stays put on a straight edge.
  const [rTop, gTop] = px(48, Math.round(PEAK * band));
  assert.equal(rTop, NEUTRAL);
  assert.ok(gTop > NEUTRAL + 100, `top rim green ${gTop}`);
  // Nothing outside the rounded corners — those pixels are outside the shape.
  assert.deepEqual(px(0, 0).slice(0, 2), [NEUTRAL, NEUTRAL]);
});

test('the frost mask is opaque in the middle, thins to the lip, and is clear outside', () => {
  const w = 96;
  const h = 32;
  const out = new Uint8ClampedArray(w * h * 4);
  fillRimMask(out, w, h, 16, h * BAND, 0.4);
  const alpha = (x: number, y: number) => out[(y * w + x) * 4 + 3];
  assert.equal(alpha(48, 16), 255);
  // On the right lip the frost is at its floor (the pixel centre sits half a px inside).
  assert.ok(alpha(95, 16) >= 0.35 * 255 && alpha(95, 16) <= 0.45 * 255, `lip alpha ${alpha(95, 16)}`);
  // A few px in, more frost than at the lip; inside the band, all of it.
  assert.ok(alpha(90, 16) > alpha(95, 16));
  assert.equal(alpha(70, 16), 255);
  // The corner pixel lies outside the capsule.
  assert.equal(alpha(0, 0), 0);
});

test('the lens scale follows the fold limit and the frost lip follows the refraction', () => {
  const { band, scale } = lensFor(64, 1);
  close(band, 64 * BAND);
  close(scale, 2 * band * FOLD_LIMIT);
  close(lensFor(64, 0.5).scale, band * FOLD_LIMIT);
  close(lensFor(64, 0).scale, 0);
  close(lensFor(64, 3).scale, 2 * band * FOLD_LIMIT);
  close(frostLip(0), 1);
  close(frostLip(1), 0.45);
  close(frostLip(0.5), 0.725);
});
