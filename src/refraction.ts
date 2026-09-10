/**
 * The displacement map behind the refraction. `feDisplacementMap` moves each
 * output pixel's sample point by `scale · (channel/255 − ½)`, so a map pixel of
 * (128, 128) leaves the backdrop alone and anything else bends it. This module
 * is the arithmetic only; the canvas that turns it into an image is in
 * GlassFilters.tsx, so the shape of the lens can be tested in Node.
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
 * The lens profile: how hard the backdrop is pulled at a given depth into the
 * rim, 0 at the band's inner limit rising to 1 at the edge. Quadratic, so the
 * bend is almost all in the outer third of the band, the way a thick slab's
 * edge curves away only near its lip.
 *
 * Input: (0, 20)   Output: 1
 * Input: (10, 20)  Output: 0.25
 * Input: (25, 20)  Output: 0
 */
export function rimProfile(depth: number, band: number): number {
  const t = Math.min(1, Math.max(0, depth / band));
  return (1 - t) * (1 - t);
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
 * The band and the filter's `scale`, from the pill's height. The band is a
 * third of the height; the scale is set so the deepest pull (scale/2 at the
 * edge) equals half the band, the most the profile can take before the rim
 * folds over itself and inverts the image.
 *
 * Input: (64, 1)    Output: { band: 21.333, scale: 21.333 }
 * Input: (64, 0.5)  Output: { band: 21.333, scale: 10.667 }
 */
export function lensFor(height: number, refraction: number): { band: number; scale: number } {
  const band = height / 3;
  return { band, scale: band * Math.min(1, Math.max(0, refraction)) };
}
