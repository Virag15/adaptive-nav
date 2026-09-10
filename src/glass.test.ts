import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_GLASS, GLASS_PRESETS, glassVars, resolveGlass, type GlassPreset } from './glass.ts';

test('every preset stays inside the ranges the stylesheet expects', () => {
  for (const name of Object.keys(GLASS_PRESETS) as GlassPreset[]) {
    const g = GLASS_PRESETS[name];
    for (const k of ['opacity', 'tintAmount', 'rim', 'refraction', 'dispersion'] as const) {
      assert.ok(g[k] >= 0 && g[k] <= 1, `${name}.${k} = ${g[k]}`);
    }
    assert.ok(g.blur >= 0 && g.saturate >= 0, name);
    // resolveGlass must not change a preset that is already in range.
    assert.deepEqual(resolveGlass(name), g);
  }
});

test('a preset replaces every knob, a patch keeps the rest', () => {
  assert.deepEqual(resolveGlass('clear', GLASS_PRESETS.liquid), GLASS_PRESETS.clear);
  const patched = resolveGlass({ tintAmount: 0.3 }, DEFAULT_GLASS);
  assert.equal(patched.tintAmount, 0.3);
  assert.equal(patched.blur, DEFAULT_GLASS.blur);
  assert.equal(resolveGlass(undefined, GLASS_PRESETS.clear), GLASS_PRESETS.clear);
});

test('drifting sliders are clamped, never emitted as invalid tokens', () => {
  const g = resolveGlass({ opacity: 4, rim: -1, refraction: Number.NaN, blur: -3 });
  assert.equal(g.opacity, 1);
  assert.equal(g.rim, 0);
  assert.equal(g.refraction, 0);
  assert.equal(g.blur, 0);
});

test('the composites agree with the knobs that feed them', () => {
  const vars = glassVars({ ...DEFAULT_GLASS, base: '#1c1c1e', opacity: 0.5, blur: 12, saturate: 1.25 });
  assert.equal(vars['--anav-glass'], 'color-mix(in srgb, #1c1c1e 50%, transparent)');
  assert.equal(vars['--anav-glass-opacity'], '0.5');
  assert.equal(vars['--anav-glass-blur'], 'blur(12px) saturate(125%)');
  assert.equal(vars['--anav-blur'], '12px');
  assert.equal(vars['--anav-saturate'], '125%');
  // Every token is namespaced so a host stylesheet cannot collide with it.
  for (const k of Object.keys(vars)) assert.match(k, /^--anav-/);
});
