/**
 * How much of the glass a device is asked to render. Every backdrop layer is
 * a read of the page beneath, filtered and painted back, on every frame that
 * anything under it moves; the lens adds a displacement pass on top. A phone
 * that cannot afford all of it should get the pill's edge and nothing more, or
 * plain frost, rather than a bar that stutters.
 */

/**
 * auto  — read the device: full on a capable Chromium, edges on a modest one,
 *         off where SVG backdrop filters do not render or transparency is reduced.
 * full  — the pill, the circles and the bubble all bend, the pill fringes.
 * edges — only the pill's rim bends, in one pass; circles and bubble stay frost.
 * off   — no lens anywhere; frost, tint and shine carry the glass.
 */
export type Quality = 'auto' | 'full' | 'edges' | 'off';

export type Environment = {
  /** Chromium applies SVG filters to a backdrop; nothing else does, yet. */
  chromium: boolean;
  /** Little memory or few cores: one lens is affordable, four are not. */
  lowEnd: boolean;
  reducedTransparency: boolean;
};

/** Which shapes get a lens, and whether the pill's lens splits colour. */
export type Rendition = { pill: boolean; circles: boolean; bubble: boolean; dispersion: boolean };

export const NO_LENS: Rendition = { pill: false, circles: false, bubble: false, dispersion: false };
export const FULL_LENS: Rendition = { pill: true, circles: true, bubble: true, dispersion: true };
export const EDGE_LENS: Rendition = { pill: true, circles: false, bubble: false, dispersion: false };

/**
 * Input: ('auto', { chromium: true, lowEnd: false, reducedTransparency: false })   Output: FULL_LENS
 * Input: ('auto', { chromium: true, lowEnd: true, reducedTransparency: false })    Output: EDGE_LENS
 * Input: ('auto', { chromium: false, … })                                          Output: NO_LENS
 * Input: ('full', { chromium: false, … })                                          Output: FULL_LENS  (forced; the host knows better)
 */
export function resolveQuality(quality: Quality, env: Environment): Rendition {
  if (quality === 'off') return NO_LENS;
  if (quality === 'full') return FULL_LENS;
  if (quality === 'edges') return EDGE_LENS;
  if (!env.chromium || env.reducedTransparency) return NO_LENS;
  return env.lowEnd ? EDGE_LENS : FULL_LENS;
}

/** The parts of `navigator` the environment is read from. */
export type NavigatorHints = {
  deviceMemory?: number;
  hardwareConcurrency?: number;
  userAgentData?: { brands?: { brand: string }[] };
};

/**
 * Chromium is the only engine that renders an SVG filter on a backdrop, and
 * `userAgentData` is a Chromium-only API whose brands say so outright — a
 * positive signal, unlike sniffing a user-agent string for what it is not.
 *
 * Input: { userAgentData: { brands: [{ brand: 'Chromium' }, { brand: 'Google Chrome' }] } }   Output: true
 * Input: {}                                                                                    Output: false
 */
export function isChromium(nav: NavigatorHints): boolean {
  return nav.userAgentData?.brands?.some((b) => /chromium/i.test(b.brand)) ?? false;
}

/**
 * Four gigabytes or four cores is where mid-range phones sit; above that a
 * device can carry every lens. Browsers that hide these (WebKit) read as capable.
 *
 * Input: { deviceMemory: 8, hardwareConcurrency: 8 }   Output: false
 * Input: { deviceMemory: 4 }                            Output: true
 * Input: {}                                             Output: false
 */
export function isLowEnd(nav: NavigatorHints): boolean {
  return (
    (nav.deviceMemory !== undefined && nav.deviceMemory <= 4) ||
    (nav.hardwareConcurrency !== undefined && nav.hardwareConcurrency <= 4)
  );
}
