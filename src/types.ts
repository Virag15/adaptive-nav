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
 * search  — the pill becomes a search field, with Back to leave it; the bar
 *           lifts above the on-screen keyboard.
 * hidden  — the whole cluster slides off the bottom of the screen and is inert,
 *           for a full-screen gallery or a player; it keeps its shape for the return.
 */
export type NavMode = 'tabs' | 'context' | 'buy' | 'search' | 'hidden';

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

/** The field the pill becomes in `search` mode. Controlled: the host owns the text. */
export type SearchField = {
  value: string;
  onChange: (value: string) => void;
  /** Enter, or the keyboard's search key. */
  onSubmit?: (value: string) => void;
  placeholder?: string;
  /** Accessible name of the field; defaults to `labels.search`. */
  label?: string;
};

/** Every string assistive tech reads. Defaults are English; pass your own for other locales. */
export type NavLabels = {
  /** Accessible name of the Back circle. */
  back: string;
  /** Accessible name of the tab strip. */
  sections: string;
  /** Confirmation after a buy press when `buy.done` is not given. */
  done: string;
  /** Accessible name and placeholder of the search field when the host gives none. */
  search: string;
  /** Accessible name of the button that empties the search field. */
  clear: string;
  /** What assistive tech reads for a badge count. */
  badge: (count: number) => string;
  /** The active tab's name while the bar is minimized, so the extra tap is explained. */
  expandHint: (label: string) => string;
};
