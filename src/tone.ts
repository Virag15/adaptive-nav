/**
 * Which way the bar faces: dark ink on light glass over light content, white
 * ink on dark glass over dark content. This module is the arithmetic — colour
 * parsing, compositing, lightness, the decision — kept apart from the DOM
 * sampling in useBackdropTone.ts so it can be tested in Node.
 */

export type Tone = 'light' | 'dark';
/** `auto` samples what is under the bar; a tone pins it. */
export type ToneSetting = Tone | 'auto';

/** Straight (not premultiplied) sRGB with channels 0–1. */
export type RGBA = { r: number; g: number; b: number; a: number };

/** The backdrop is dark once its mean lightness drops below this… */
export const DARK_BELOW = 45;
/** …and light again only once it climbs above this, so a boundary never flickers. */
export const LIGHT_ABOVE = 55;

const linear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/**
 * Perceived lightness, CIE L* (0 black – 100 white), of an opaque sRGB colour.
 *
 * Input: (1, 1, 1)          Output: 100
 * Input: (0, 0, 0)          Output: 0
 * Input: (0.5, 0.5, 0.5)    Output: ≈ 53.4
 */
export function lightness(r: number, g: number, b: number): number {
  const y = 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
  return y <= 0.008856 ? 903.3 * y : 116 * Math.cbrt(y) - 16;
}

/**
 * `top` painted over `under`, both straight alpha.
 *
 * Input: ({1,1,1,0.5}, {0,0,0,1})   Output: {0.5, 0.5, 0.5, 1}
 * Input: ({1,0,0,1}, anything)      Output: {1, 0, 0, 1}
 */
export function over(top: RGBA, under: RGBA): RGBA {
  const a = top.a + under.a * (1 - top.a);
  if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
  const mix = (t: number, u: number) => (t * top.a + u * under.a * (1 - top.a)) / a;
  return { r: mix(top.r, under.r), g: mix(top.g, under.g), b: mix(top.b, under.b), a };
}

/**
 * The alpha-weighted mean of a set of colours, as one colour: what a gradient
 * amounts to, on average, for the purpose of telling light from dark.
 *
 * Input: [{1,1,1,1}, {0,0,0,1}]        Output: {0.5, 0.5, 0.5, 1}
 * Input: [{1,0,0,1}, {0,0,0,0}]        Output: {1, 0, 0, 0.5}
 * Input: []                            Output: null
 */
export function meanColor(colors: RGBA[]): RGBA | null {
  if (!colors.length) return null;
  let r = 0;
  let g = 0;
  let b = 0;
  let a = 0;
  for (const c of colors) {
    r += c.r * c.a;
    g += c.g * c.a;
    b += c.b * c.a;
    a += c.a;
  }
  if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
  return { r: r / a, g: g / a, b: b / a, a: a / colors.length };
}

/**
 * The tone to show next, given the one showing now and the backdrop's mean
 * lightness; null (nothing readable under the bar) keeps what is there.
 *
 * Input: ('light', 30)    Output: 'dark'
 * Input: ('light', 50)    Output: 'light'   (inside the band: no change)
 * Input: ('dark', 50)     Output: 'dark'
 * Input: ('dark', 60)     Output: 'light'
 */
export function nextTone(current: Tone, l: number | null): Tone {
  if (l === null) return current;
  if (current === 'light') return l < DARK_BELOW ? 'dark' : 'light';
  return l > LIGHT_ABOVE ? 'light' : 'dark';
}

/**
 * The rgb()/rgba() forms a computed style hands back, comma or space separated.
 *
 * Input: 'rgb(255, 0, 0)'              Output: {1, 0, 0, 1}
 * Input: 'rgba(0, 0, 0, 0.5)'          Output: {0, 0, 0, 0.5}
 * Input: 'rgb(0 0 0 / 40%)'            Output: {0, 0, 0, 0.4}
 * Input: 'oklab(0.5 0 0)'              Output: null   (hand it to a canvas)
 */
export function parseRgb(s: string): RGBA | null {
  const m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i.exec(s.trim());
  if (!m) return null;
  let a = 1;
  if (m[4] !== undefined) a = m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
  return { r: +m[1] / 255, g: +m[2] / 255, b: +m[3] / 255, a };
}

/**
 * Hex colours, 3 to 8 digits, as a canvas normalises them.
 *
 * Input: '#fff'         Output: {1, 1, 1, 1}
 * Input: '#00000080'    Output: {0, 0, 0, ≈0.5}
 */
export function parseHex(s: string): RGBA | null {
  const m = /^#([0-9a-f]{3,8})$/i.exec(s.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
  if (h.length !== 6 && h.length !== 8) return null;
  const n = (i: number) => parseInt(h.slice(i, i + 2), 16) / 255;
  return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) : 1 };
}

/**
 * Every colour literal in a computed background-image, so a gradient can be
 * averaged from its stops.
 *
 * Input: 'linear-gradient(135deg, rgb(1, 2, 3), rgba(4, 5, 6, 0.5))'   Output: ['rgb(1, 2, 3)', 'rgba(4, 5, 6, 0.5)']
 * Input: 'url("a.png")'                                                 Output: []
 */
export function colorsIn(css: string): string[] {
  return (
    css.match(
      /(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\((?:[^()]|\([^()]*\))*\)|#[0-9a-f]{3,8}\b|\btransparent\b/gi,
    ) ?? []
  );
}
