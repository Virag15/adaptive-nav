/**
 * The displacement map behind the refraction, and the mask that thins the
 * frost toward the lip. `feDisplacementMap` moves each output pixel's sample
 * point by `scale · (channel/255 − ½)`, so a map pixel of (128, 128) leaves the
 * backdrop alone and anything else bends it. This module is the arithmetic
 * only; the canvas that turns it into images is in GlassFilters.tsx, so the
 * shape of the lens can be tested in Node.
 */

/** Neutral: no displacement in either axis. */
export const NEUTRAL = 128;

/**
 * Signed distance from a point to the edge of a capsule-cornered rectangle
 * centred at the origin; negative inside.
 *
 * Input: (0, 0, 100, 40, 20)     Output: -20   (centre of a 100×40 capsule)
 * Input: (50, 0, 100, 40, 20)    Output: 0     (on the right edge)
 * Input: (30, 20, 100, 40, 20)   Output: 0     (top edge, straight section)
 */
export function roundedRectDistance(x: number, y: number, w: number, h: number, r: number): number {
  const qx = Math.abs(x) - (w / 2 - r);
  const qy = Math.abs(y) - (h / 2 - r);
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  const inside = Math.min(Math.max(qx, qy), 0);
  return outside + inside - r;
}

/**
 * Where the pull peaks, as a fraction of the band. Trace a vertical ray into a
 * slab whose edge is a quarter-round: at the lip itself the glass is paper
 * thin and bends nothing, a little way in the surface is steep and the ray is
 * thrown hardest, and from there the tilt eases off to the flat top. So the
 * profile rises fast, peaks early, and decays.
 */
export const PEAK = 0.12;
const DECAY = 1.3;
/** The unnormalised profile's maximum, at the peak, so the profile can top out at 1. */
const PROFILE_MAX = (1 - PEAK) ** DECAY;
/**
 * The steepest the profile falls, just past the peak. A pull that decays
 * faster than one pixel per pixel folds the image over on itself; this is the
 * slope that limit is measured against.
 */
const STEEPEST = (DECAY * (1 - PEAK) ** (DECAY - 1)) / PROFILE_MAX;
/**
 * How far the deepest pull may reach, as a fraction of the band, before the
 * rim folds. `lensFor` sets the filter's scale so it never exceeds this.
 */
export const FOLD_LIMIT = 1 / STEEPEST;
/** The band is this much of the pill's height: a thick slab's rounded edge. */
export const BAND = 0.4;

/**
 * The lens profile: how hard the backdrop is pulled at a given depth into the
 * rim, 0 at the lip, 1 at the peak, 0 again at the band's inner limit.
 *
 * Input: (0, 20)             Output: 0
 * Input: (0.12 · 20, 20)     Output: 1
 * Input: (10, 20)            Output: ≈ 0.48
 * Input: (25, 20)            Output: 0
 */
export function rimProfile(depth: number, band: number): number {
  const t = Math.min(1, Math.max(0, depth / band));
  if (t < PEAK) {
    // Ease-out up to the peak: the lip bends nothing, then the pull comes on fast.
    const u = t / PEAK;
    return 1 - (1 - u) * (1 - u);
  }
  return (1 - t) ** DECAY / PROFILE_MAX;
}

/**
 * Unit outward normal of the rounded rectangle nearest to a point inside it:
 * axis-aligned along the straight edges, radial in the corners.
 *
 * Input: (45, 0, 100, 40, 20)    Output: [1, 0]
 * Input: (0, -15, 100, 40, 20)   Output: [0, -1]
 */
export function edgeNormal(x: number, y: number, w: number, h: number, r: number): [number, number] {
  const qx = Math.abs(x) - (w / 2 - r);
  const qy = Math.abs(y) - (h / 2 - r);
  const sx = Math.sign(x) || 1;
  const sy = Math.sign(y) || 1;
  if (qx > 0 && qy > 0) {
    const len = Math.hypot(qx, qy) || 1;
    return [(sx * qx) / len, (sy * qy) / len];
  }
  return qx > qy ? [sx, 0] : [0, sy];
}

/**
 * Fills `out` (RGBA, w·h·4 bytes) with the displacement map for a w×h
 * rounded rectangle of corner radius r. The rim `band` px deep pulls its sample
 * point inward along the edge normal — inward, never outward, because a
 * backdrop filter can only see the pixels under its own element, and a sample
 * fetched from beyond the edge would come back empty.
 *
 * Red carries x, green carries y, blue is unused and alpha is opaque.
 */
export function fillDisplacementMap(
  out: Uint8ClampedArray,
  w: number,
  h: number,
  r: number,
  band: number,
): void {
  const cx = w / 2;
  const cy = h / 2;
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const x = px + 0.5 - cx;
      const y = py + 0.5 - cy;
      const d = roundedRectDistance(x, y, w, h, r);
      const i = (py * w + px) * 4;
      let dx = 0;
      let dy = 0;
      if (d < 0) {
        const strength = rimProfile(-d, band);
        if (strength > 0) {
          const [nx, ny] = edgeNormal(x, y, w, h, r);
          // Toward the centre: minus the outward normal.
          dx = -nx * strength;
          dy = -ny * strength;
        }
      }
      out[i] = NEUTRAL + Math.round(dx * 127);
      out[i + 1] = NEUTRAL + Math.round(dy * 127);
      out[i + 2] = NEUTRAL;
      out[i + 3] = 255;
    }
  }
}

/**
 * Fills `out` with the frost mask: opaque across the middle, easing down to
 * `lip` (0–1) at the edge over the same band the lens works in, so the blur
 * thins exactly where the bend is and the bend stays crisp. The shape's own
 * edge is anti-aliased by coverage so the mask never adds a jagged lip of its
 * own; outside the shape it is clear.
 *
 * Input: lip 0.4 → centre pixel alpha 255, a pixel on the lip ≈ 0.4 · 255 · coverage, a corner pixel 0
 */
export function fillRimMask(
  out: Uint8ClampedArray,
  w: number,
  h: number,
  r: number,
  band: number,
  lip: number,
): void {
  const cx = w / 2;
  const cy = h / 2;
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const x = px + 0.5 - cx;
      const y = py + 0.5 - cy;
      const d = roundedRectDistance(x, y, w, h, r);
      const coverage = Math.min(1, Math.max(0, 0.5 - d));
      const t = Math.min(1, Math.max(0, -d / band));
      const frost = lip + (1 - lip) * t * t * (3 - 2 * t);
      const i = (py * w + px) * 4;
      out[i] = 255;
      out[i + 1] = 255;
      out[i + 2] = 255;
      out[i + 3] = Math.round(coverage * frost * 255);
    }
  }
}

/**
 * The band and the filter's `scale`, from the pill's height. The deepest pull
 * is scale/2 at the peak; it is held at the fold limit so the rim compresses
 * and magnifies but never inverts.
 *
 * Input: (64, 1)    Output: { band: 25.6, scale: ≈ 34.7 }
 * Input: (64, 0.5)  Output: { band: 25.6, scale: ≈ 17.3 }
 */
export function lensFor(height: number, refraction: number): { band: number; scale: number } {
  const band = height * BAND;
  return { band, scale: 2 * band * FOLD_LIMIT * Math.min(1, Math.max(0, refraction)) };
}

/**
 * How much frost is left at the lip for a given refraction: all of it with
 * no lens, a little under half with the lens at full strength.
 *
 * Input: 0    Output: 1
 * Input: 1    Output: 0.45
 */
export function frostLip(refraction: number): number {
  return 1 - 0.55 * Math.min(1, Math.max(0, refraction));
}
