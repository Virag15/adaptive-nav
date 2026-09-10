import type { ComponentType } from 'react';

export type TabOption = {
  id: string;
  /** Not rendered — the bar is icon-only, so this is what assistive tech reads. */
  label: string;
  Icon: ComponentType<{ className?: string }>;
  badge?: number;
};

/**
 * tabs    — home level: one pill, the sections, the indicator marks the active one.
 * context — a pushed screen: Back slides out of the pill's left end as its own
 *           circle and the sections stay put, so any of them is one tap away.
 *           The screen may hang an action circle off the right end.
 * buy     — a product: the same two circles, but the pill itself becomes the
 *           call to action.
 */
export type NavMode = 'tabs' | 'context' | 'buy';

/** The right-hand circle. The screen decides what it is: bag, save, share… */
export type NavAction = {
  /** Keyed, so swapping bag for heart crossfades instead of snapping. */
  id: string;
  label: string;
  Icon: ComponentType<{ className?: string }>;
  badge?: number;
  /** Toggles (saved, following) render filled and announce aria-pressed. */
  active?: boolean;
  onPress: () => void;
};

export type BuyAction = {
  label: string;
  price: string;
  /** Short confirmation shown in place of the label after a press. */
  done?: string;
  onPress: () => void;
};

/** Every string assistive tech reads. Defaults are English; pass your own for other locales. */
export type NavLabels = {
  /** Accessible name of the Back circle. */
  back: string;
  /** Accessible name of the tab strip. */
  sections: string;
  /** Confirmation after a buy press when `buy.done` is not given. */
  done: string;
  /** What assistive tech reads for a badge count. */
  badge: (count: number) => string;
  /** The active tab's name while the bar is minimized, so the extra tap is explained. */
  expandHint: (label: string) => string;
};
