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
 * toolbar — a screen's own actions (share, save, more…) fill the pill in place
 *           of the sections, with Back; nothing is selected, so no indicator.
 * select  — a selection session: Close on the left, the count in the pill with
 *           Done, and the action circle for what to do with the selection.
 * confirm — a sheet's decision: Close on the left, a quiet secondary and the
 *           accent primary side by side in the pill.
 * hidden  — the whole cluster slides off the bottom of the screen and is inert,
 *           for a full-screen gallery or a player; it keeps its shape for the return.
 */
export type NavMode =
  | 'tabs'
  | 'context'
  | 'buy'
  | 'search'
  | 'toolbar'
  | 'select'
  | 'confirm'
  | 'hidden';

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
  /**
   * At regular width, keep the field on the trailing edge in every mode, the
   * way the guideline draws a toolbar's optional search field, rather than
   * only once the screen is already searching. Compact views have no room for
   * it, so there the field still arrives with `search` mode.
   */
  persistent?: boolean;
  /**
   * The field took focus. A persistent field uses it to ask the screen to
   * switch to its search section before a character is typed.
   */
  onFocus?: () => void;
};

/** The pill in `select` mode: what is selected, and the way to finish. */
export type SelectSession = {
  /** "3 selected", or whatever the count reads as. */
  label: string;
  /** The Done button's text; defaults to `labels.selectDone`. */
  done?: string;
  onDone: () => void;
};

/** The pill in `confirm` mode: the decision a sheet asks for. */
export type ConfirmActions = {
  primary: { label: string; onPress: () => void };
  /** The quiet way out; omit it and the primary fills the pill. */
  secondary?: { label: string; onPress: () => void };
};

/** Every string assistive tech reads. Defaults are English; pass your own for other locales. */
export type NavLabels = {
  /** Accessible name of the Back circle. */
  back: string;
  /** Accessible name of the left circle in `select` and `confirm` modes. */
  close: string;
  /** Accessible name of the pill in `toolbar` mode. */
  tools: string;
  /** The Done button in `select` mode when the session gives no text. */
  selectDone: string;
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
