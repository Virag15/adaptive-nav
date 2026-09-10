import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DARK_BELOW,
  LIGHT_ABOVE,
  colorsIn,
  lightness,
  meanColor,
  nextTone,
  over,
  parseHex,
  parseRgb,
} from './tone.ts';

const close = (a: number, b: number, eps = 0.01) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);

test('lightness is CIE L*: white 100, black 0, mid grey a little over half', () => {
  close(lightness(1, 1, 1), 100);
  close(lightness(0, 0, 0), 0);
  close(lightness(0.5, 0.5, 0.5), 53.39, 0.05);
  // A saturated blue reads darker than its bytes suggest; a yellow lighter.
  assert.ok(lightness(0, 0, 1) < 40);
  assert.ok(lightness(1, 1, 0) > 90);
});

test('compositing: half white over black is mid grey, opaque paint hides what is under it', () => {
  const c = over({ r: 1, g: 1, b: 1, a: 0.5 }, { r: 0, g: 0, b: 0, a: 1 });
  close(c.r, 0.5);
  close(c.a, 1);
  const red = over({ r: 1, g: 0, b: 0, a: 1 }, { r: 0, g: 1, b: 0, a: 1 });
  assert.deepEqual(red, { r: 1, g: 0, b: 0, a: 1 });
  // Two translucent layers add up without ever reaching full cover.
  const two = over({ r: 0, g: 0, b: 0, a: 0.5 }, { r: 0, g: 0, b: 0, a: 0.5 });
  close(two.a, 0.75);
  assert.deepEqual(over({ r: 1, g: 1, b: 1, a: 0 }, { r: 1, g: 1, b: 1, a: 0 }), { r: 0, g: 0, b: 0, a: 0 });
});

test('a gradient averages to one colour, weighted by alpha', () => {
  const m = meanColor([
    { r: 1, g: 1, b: 1, a: 1 },
    { r: 0, g: 0, b: 0, a: 1 },
  ]);
  assert.ok(m);
  close(m.r, 0.5);
  close(m.a, 1);
  const half = meanColor([
    { r: 1, g: 0, b: 0, a: 1 },
    { r: 0, g: 0, b: 0, a: 0 },
  ]);
  assert.ok(half);
  // The transparent stop contributes no colour, only thinner cover.
  close(half.r, 1);
  close(half.a, 0.5);
  assert.equal(meanColor([]), null);
});

test('the tone flips with hysteresis and holds when nothing is readable', () => {
  assert.equal(nextTone('light', DARK_BELOW - 1), 'dark');
  assert.equal(nextTone('light', DARK_BELOW + 1), 'light');
  assert.equal(nextTone('light', LIGHT_ABOVE - 1), 'light');
  assert.equal(nextTone('dark', LIGHT_ABOVE - 1), 'dark');
  assert.equal(nextTone('dark', LIGHT_ABOVE + 1), 'light');
  assert.equal(nextTone('dark', null), 'dark');
  assert.equal(nextTone('light', null), 'light');
});

test('computed colour strings parse, and the ones a canvas must normalise are refused', () => {
  assert.deepEqual(parseRgb('rgb(255, 0, 0)'), { r: 1, g: 0, b: 0, a: 1 });
  assert.deepEqual(parseRgb('rgba(0, 0, 0, 0.5)'), { r: 0, g: 0, b: 0, a: 0.5 });
  assert.deepEqual(parseRgb('rgb(0 0 0 / 40%)'), { r: 0, g: 0, b: 0, a: 0.4 });
  assert.equal(parseRgb('oklab(0.5 0 0)'), null);
  assert.equal(parseRgb('transparent'), null);
  assert.deepEqual(parseHex('#fff'), { r: 1, g: 1, b: 1, a: 1 });
  const h = parseHex('#00000080');
  assert.ok(h);
  close(h.a, 0.502);
  assert.equal(parseHex('#12345'), null);
});

test('every stop of a gradient is found, nested functions included, and an image yields none', () => {
  assert.deepEqual(colorsIn('linear-gradient(135deg, rgb(1, 2, 3), rgba(4, 5, 6, 0.5))'), [
    'rgb(1, 2, 3)',
    'rgba(4, 5, 6, 0.5)',
  ]);
  assert.deepEqual(colorsIn('repeating-linear-gradient(90deg, rgb(0, 0, 0) 0px, transparent 6px)'), [
    'rgb(0, 0, 0)',
    'transparent',
  ]);
  assert.deepEqual(colorsIn('radial-gradient(circle, color-mix(in srgb, rgb(1, 2, 3) 40%, transparent), #abc)'), [
    'color-mix(in srgb, rgb(1, 2, 3) 40%, transparent)',
    '#abc',
  ]);
  assert.deepEqual(colorsIn('url("photo.jpg")'), []);
});
