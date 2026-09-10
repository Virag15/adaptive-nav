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
  slot: 56,
  pad: 6,
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
 * Input: (430, 4, DEFAULT_METRICS)  Output: 56
 * Input: (393, 4, DEFAULT_METRICS)  Output: 52
 * Input: (320, 4, DEFAULT_METRICS)  Output: 40
 */
export function solveSlot(viewportWidth: number, tabCount: number, m: NavMetrics): number {
  // Three bodies (pill and two circles), each padded on both sides, two gaps.
  const chrome = m.edge * 2 + m.pad * 6 + m.gap * 2;
  const fit = Math.floor((viewportWidth - chrome) / (tabCount + 2));
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
    if (mode === 'buy') return false;
    if (minimized) return i === activeIndex;
    return true;
  });
}

/** Where the indicator sits: one slot per visible tab before the active one. */
export function indicatorOffset(visible: boolean[], activeIndex: number, slot: number): number {
  let before = 0;
  for (let i = 0; i < activeIndex; i++) if (visible[i]) before++;
  return before * slot;
}

/**
 * Buy mode: full width less the insets and the two circles, so the call to
 * action never collides with Back or the action. Otherwise: the visible slots
 * plus the pill's padding.
 *
 * Input: ('tabs', 4, 52, 64, 393, DEFAULT_METRICS)  Output: 220
 * Input: ('buy', 0, 52, 64, 393, DEFAULT_METRICS)   Output: 229
 */
export function pillWidth(
  mode: NavMode,
  visibleCount: number,
  slot: number,
  satellite: number,
  viewportWidth: number,
  m: NavMetrics,
): number {
  if (mode === 'buy') {
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
