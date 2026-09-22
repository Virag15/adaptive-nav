import type { NavMode } from './types';

/**
 * The bar's layout as arithmetic, kept apart from React so it can be tested
 * and so a host can read the numbers — a sheet that has to clear the bar, say —
 * without rendering anything.
 */
export interface NavMetrics {
  /** Preferred width and height of one tab slot; the indicator is this square. */
  slot: number;
  /** Inset from the pill's edge to what sits inside it: the concentric offset. */
  pad: number;
  /** Air between the pill and a satellite circle. */
  gap: number;
  /** The cluster never comes closer than this to the screen edge. */
  edge: number;
  /** Side inset of the widened buy pill, measured to the outer edge of the circles. */
  buyInset: number;
  /** On a tablet or desktop the buy pill stops growing; a metre-wide button is not a button. */
  buyMaxWidth: number;
}

export const DEFAULT_METRICS: NavMetrics = {
  // A 46px indicator inside a 54px pill: the scale of an iOS tab bar (49pt)
  // and its Liquid Glass successor, above the 44pt hit region the guideline
  // asks for — every slot is hit-tested at the pill's full height.
  slot: 46,
  pad: 4,
  gap: 8,
  edge: 12,
  buyInset: 10,
  buyMaxWidth: 520,
};

/**
 * The largest slot that lets the whole cluster — every tab plus the two
 * satellite circles, each the pill's own height — fit the viewport with `edge`
 * to spare on either side. Wide screens get the preferred slot unchanged, so the
 * composition never changes between phones, only its scale.
 *
 * Input: (430, 4, DEFAULT_METRICS)  Output: 46
 * Input: (393, 4, DEFAULT_METRICS)  Output: 46
 * Input: (320, 4, DEFAULT_METRICS)  Output: 42
 */
export function solveSlot(viewportWidth: number, tabCount: number, m: NavMetrics): number {
  // Three bodies (pill and two circles), each padded on both sides, two gaps.
  const chrome = m.edge * 2 + m.pad * 6 + m.gap * 2;
  const fit = Math.floor((viewportWidth - chrome) / (tabCount + 2));
  return Math.max(0, Math.min(m.slot, fit));
}

/** The guideline's floor for a hit region, in px. */
export const MIN_HIT = 44;

/**
 * The slot of a spanning pill. `solveSlot` makes room for a satellite at each
 * end, but a pill that spans the screen shares its width among the sections,
 * so its height is no longer what has to fit: the sections are. The slot is
 * the preferred one unless that would squeeze a section below the 44px hit
 * floor with Back out beside the pill, the narrowest the spanning pill gets.
 *
 * Input: (393, 5, { ...DEFAULT_METRICS, slot: 62, pad: 2, buyInset: 6 })  Output: 62
 * Input: (320, 5, { ...DEFAULT_METRICS, slot: 62, pad: 2, buyInset: 6 })  Output: 62
 * Input: (260, 5, { ...DEFAULT_METRICS, slot: 62, pad: 2, buyInset: 6 })  Output: 12
 */
export function solveFillSlot(viewportWidth: number, tabCount: number, m: NavMetrics): number {
  // Pitch with Back out: (span − 2·buyInset − (slot + 2·pad + gap) − 2·pad) / n ≥ MIN_HIT.
  const span = Math.min(viewportWidth, m.buyMaxWidth);
  const fit = Math.floor(span - m.buyInset * 2 - m.pad * 4 - m.gap - MIN_HIT * Math.max(1, tabCount));
  return Math.max(0, Math.min(m.slot, fit));
}

/**
 * One rule for every curve in the bar. The pill is a capsule, so its radius is
 * half its height; the satellites are circles of that same height, so they share
 * the arc. Anything inset by `pad` inside the pill is concentric at that radius
 * minus `pad` — nested shapes with unrelated radii pinch at the corners.
 *
 * Input: (64, 6)  Output: { outer: 32, inner: 26 }
 */
export function capsuleRadii(satellite: number, pad: number): { outer: number; inner: number } {
  const outer = satellite / 2;
  return { outer, inner: Math.max(0, outer - pad) };
}

/**
 * The modes where the pill spans the screen and the tabs fold away: the call
 * to action, the search field, the selection count, the decision. `toolbar`
 * folds the tabs too but stays as wide as its tools; `hidden` keeps the tab
 * layout, so the bar comes back the shape it left.
 *
 * Input: 'buy'      Output: true
 * Input: 'toolbar'  Output: false
 * Input: 'hidden'   Output: false
 */
export function isWide(mode: NavMode): boolean {
  return mode === 'buy' || mode === 'search' || mode === 'select' || mode === 'confirm';
}

/**
 * Which tabs keep their width. Hidden slots collapse to zero so whatever remains
 * packs left, which is what lets the indicator target stay a simple product.
 */
export function visibleSlots(
  count: number,
  mode: NavMode,
  minimized: boolean,
  activeIndex: number,
): boolean[] {
  return Array.from({ length: count }, (_, i) => {
    if (isWide(mode) || mode === 'toolbar') return false;
    if (minimized) return i === activeIndex;
    return true;
  });
}

/** Where the indicator sits: one slot per visible tab before the active one. */
/**
 * The width of a pill that spans the screen: the viewport (capped, so a tablet
 * does not get a metre-wide bar) less the side insets and the satellite circles
 * hanging off its ends, each with its gap.
 *
 * Input: (393, 56, 1, DEFAULT_METRICS)  Output: 309
 * Input: (393, 56, 0, DEFAULT_METRICS)  Output: 373
 */
export function spanWidth(viewportWidth: number, satellite: number, satellites: number, m: NavMetrics): number {
  return Math.min(viewportWidth, m.buyMaxWidth) - m.buyInset * 2 - (satellite + m.gap) * satellites;
}

export function indicatorOffset(visible: boolean[], activeIndex: number, slot: number): number {
  let before = 0;
  for (let i = 0; i < activeIndex; i++) if (visible[i]) before++;
  return before * slot;
}

/**
 * The wide modes: full width less the insets and the two circles, so what
 * fills the pill never collides with Back or the action. Otherwise: the slots
 * shown (tabs, or a toolbar's tools) plus the pill's padding.
 *
 * Input: ('tabs', 4, 52, 64, 393, DEFAULT_METRICS)    Output: 220
 * Input: ('buy', 0, 52, 64, 393, DEFAULT_METRICS)     Output: 229
 * Input: ('search', 0, 52, 64, 393, DEFAULT_METRICS)  Output: 229
 */
export function pillWidth(
  mode: NavMode,
  visibleCount: number,
  slot: number,
  satellite: number,
  viewportWidth: number,
  m: NavMetrics,
): number {
  if (isWide(mode)) {
    return Math.min(viewportWidth, m.buyMaxWidth) - m.buyInset * 2 - (satellite + m.gap) * 2;
  }
  return visibleCount * slot + m.pad * 2;
}

/** How the selected tab is marked; see the stylesheet for what each looks like. */
export type IndicatorStyle = 'capsule' | 'dot' | 'glow' | 'lift';

/**
 * The indicator's box inside a slot, for the style. `dx` and `top` place it;
 * the travelling spring adds `dx` to the slot offset so every style rides the
 * same x. `lift` has no visible box and reuses the capsule's so the element
 * still exists to fade in when the style changes.
 *
 * Input: ('capsule', 56, 6)  Output: { w: 56, h: 56, top: 6, dx: 0 }
 * Input: ('dot', 56, 6)      Output: { w: 5, h: 5, top: 53, dx: 25.5 }
 */
export function indicatorBox(
  style: IndicatorStyle,
  slot: number,
  pad: number,
): { w: number; h: number; top: number; dx: number } {
  if (style === 'dot') {
    const d = 5;
    return { w: d, h: d, top: pad + slot - d - 4, dx: (slot - d) / 2 };
  }
  if (style === 'glow') {
    const d = Math.round(slot * 0.78);
    return { w: d, h: d, top: pad + (slot - d) / 2, dx: (slot - d) / 2 };
  }
  return { w: slot, h: slot, top: pad, dx: 0 };
}
