import type { NavMetrics } from './geometry';

/**
 * Where the bar lives. On a phone it floats at the bottom, within reach of the
 * thumb. At regular width — an iPad, a Mac window — the Human Interface
 * Guidelines put the tab bar "near the top of the screen", with icons and
 * labels side by side, sharing one band with the toolbar: navigation on the
 * leading edge, the tabs in the centre, search and the one prominent action
 * on the trailing edge. The switch is by width, not device: Safari on an iPad
 * reports itself as a Mac, and the guideline's own model is compact versus
 * regular size class.
 */
export type Placement = 'top' | 'bottom';
export type PlacementSetting = Placement | 'auto';

/** The regular size class begins here: an iPad in portrait is 768 CSS px wide. */
export const REGULAR_MIN = 768;

/**
 * Input: ('auto', true)     Output: 'top'
 * Input: ('auto', false)    Output: 'bottom'
 * Input: ('bottom', true)   Output: 'bottom'
 */
export function resolvePlacement(setting: PlacementSetting, regular: boolean): Placement {
  return setting === 'auto' ? (regular ? 'top' : 'bottom') : setting;
}

/**
 * The band at the top of a regular-width view. With touch (an iPad) every
 * section is 48px, so a hit region is never under the 44pt the guideline
 * asks for; with a pointer alone (a Mac) it is the 44px compact scale of a
 * Mac toolbar, whose controls are smaller than a finger needs. The 16px edge
 * is the layout margin the sections are pinned to.
 */
export const TOP_TOUCH_METRICS: Partial<NavMetrics> = { slot: 40, pad: 4, gap: 10, edge: 16 };
export const TOP_POINTER_METRICS: Partial<NavMetrics> = { slot: 36, pad: 4, gap: 10, edge: 16 };
/** The touch band; kept under its old name. */
export const TOP_METRICS = TOP_TOUCH_METRICS;

/** A tab's box along the track, in px from the first tab's leading edge. */
export type TabRect = { left: number; width: number };

/**
 * The tab whose span holds x, clamped to the ends; -1 with no tabs.
 *
 * Input: ([{left:0,width:80},{left:80,width:60}], 90)    Output: 1
 * Input: ([{left:0,width:80},{left:80,width:60}], -5)    Output: 0
 * Input: ([{left:0,width:80},{left:80,width:60}], 500)   Output: 1
 */
export function tabAt(rects: TabRect[], x: number): number {
  if (!rects.length) return -1;
  for (let i = 0; i < rects.length; i++) {
    if (x < rects[i].left + rects[i].width) return Math.max(0, i);
  }
  return rects.length - 1;
}

/**
 * The tab whose centre is nearest to x, for a flick's projected rest.
 *
 * Input: ([{left:0,width:80},{left:80,width:60}], 75)   Output: 1   (75 is nearer 110 than 40)
 * Input: ([{left:0,width:80},{left:80,width:60}], 30)   Output: 0
 */
export function nearestTab(rects: TabRect[], x: number): number {
  let best = -1;
  let gap = Infinity;
  rects.forEach((r, i) => {
    const d = Math.abs(r.left + r.width / 2 - x);
    if (d < gap) {
      gap = d;
      best = i;
    }
  });
  return best;
}

/** True when two measurements agree to the pixel, so a re-measure never re-renders for nothing. */
export function sameRects(a: TabRect[], b: TabRect[]): boolean {
  return a.length === b.length && a.every((r, i) => Math.abs(r.left - b[i].left) < 0.5 && Math.abs(r.width - b[i].width) < 0.5);
}
