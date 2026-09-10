import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  useVelocity,
  type MotionValue,
  type Transition,
} from 'motion/react';
import { Satellite } from './Satellite';
import { GlassFilters, useFrostMasks } from './GlassFilters';
import { IconBack, IconClear, IconSearch } from './icons';
import {
  capsuleRadii,
  DEFAULT_METRICS,
  indicatorBox,
  indicatorOffset,
  isWide,
  pillWidth,
  solveSlot,
  spanWidth,
  type IndicatorStyle,
  type NavMetrics,
  visibleSlots,
} from './geometry';
import {
  FADE_IN,
  FADE_OUT,
  GLYPH,
  PRESS_SPRING,
  RELEASE_SPRING,
  SELECTION_SPRING,
  SHAPE_SPRING,
  STRETCH_SPRING,
} from './springs';
import { releaseTarget, scrubPosition, trailVelocity, TRAIL_MS, type PointerSample } from './interaction';
import { glassVars, type GlassInput } from './glass';
import { useGlass } from './useGlass';
import { useBackdropTone } from './useBackdropTone';
import { resolveQuality, type Quality } from './quality';
import { useEnvironment } from './useEnvironment';
import { TOP_POINTER_METRICS, TOP_TOUCH_METRICS, type PlacementSetting } from './placement';
import { usePlacement } from './usePlacement';
import type { ToneSetting } from './tone';
import type {
  BuyAction,
  ConfirmActions,
  NavAction,
  NavLabels,
  NavMode,
  SearchField,
  SelectSession,
  TabOption,
} from './types';

export type AdaptiveNavProps = {
  mode: NavMode;
  options: TabOption[];
  /** The id of the selected tab. */
  value: string;
  onChange: (id: string) => void;
  /** The left circle: Back on a pushed screen, Close in `select` and `confirm`. */
  onBack?: () => void;
  /** The right-hand circle, chosen by the screen. Omit for Back alone. */
  action?: NavAction;
  /** The call to action the pill becomes in `buy` mode. */
  buy?: BuyAction;
  /** The field the pill becomes in `search` mode. */
  search?: SearchField;
  /** The actions that fill the pill in `toolbar` mode. */
  tools?: NavAction[];
  /** The count and Done that fill the pill in `select` mode. */
  select?: SelectSession;
  /** The decision that fills the pill in `confirm` mode. */
  confirm?: ConfirmActions;
  /** Collapsed to the active section only, the way a tab bar folds away on scroll. */
  minimized?: boolean;
  /** Any tap or arrow key on the minimized bar asks to unfold rather than switching. */
  onExpand?: () => void;
  /**
   * The material, for this bar alone: a preset name or any of the knobs, laid
   * over the global glass. Omit it and the bar follows `setGlobalGlass`.
   */
  glass?: GlassInput;
  /** How the selected tab is marked. */
  indicator?: IndicatorStyle;
  /**
   * Which way the bar faces. `auto` reads what is under it and flips to dark
   * glass with white ink over dark content; a tone pins it.
   */
  tone?: ToneSetting;
  /**
   * How much of the lens the device is asked for. `auto` reads the device;
   * `edges` bends the pill's rim only; `off` is frost, tint and shine alone.
   */
  quality?: Quality;
  /** Override the strings assistive tech reads; defaults are English. */
  labels?: Partial<NavLabels>;
  /** Replaces the built-in chevron (or cross) inside the left circle. */
  backIcon?: ReactNode;
  /** Override slot size, paddings and the buy pill's cap; see `DEFAULT_METRICS`. */
  metrics?: Partial<NavMetrics>;
  /** Print each section's (and tool's) label under its glyph. Off, the bar is icon-only. */
  labelled?: boolean;
  /**
   * In tabs and context modes the pill spans the screen the way the wide modes
   * do, the sections sharing its width. Off, it hugs its slots. Minimized, it
   * still folds to the one slot.
   */
  fill?: boolean;
  /**
   * Where the bar lives: floating at the bottom on a phone, or the band at the
   * top of a regular-width view, the way the guideline places a tab bar on an
   * iPad or a Mac — Back leading, the tabs in the centre with their names
   * beside the glyphs, search and the one prominent action trailing. `auto`
   * switches on width.
   */
  placement?: PlacementSetting;
  /**
   * The view's title, for the leading edge at regular width, after Back:
   * "a word or short phrase", the guideline says, under 15 characters. In
   * `select` mode the count stands in when none is given. A phone has no room
   * for it and never shows it.
   */
  title?: string;
  className?: string;
};

const DEFAULT_LABELS: NavLabels = {
  back: 'Back',
  close: 'Close',
  tools: 'Actions',
  selectDone: 'Done',
  sections: 'Sections',
  done: 'Added',
  search: 'Search',
  clear: 'Clear',
  badge: (n) => `${n} items`,
  expandHint: (label) => `${label}, tap to show all sections`,
};

/** How far a pointer may travel before it stops being a tap and becomes a scrub or a scroll. */
const DRAG_CANCEL = 10;
/** How long the buy confirmation stays before the label returns. */
const CONFIRM_MS = 1400;
/** A phone-sized guess for the server render; the client measures on mount. */
const SSR_VIEWPORT = 393;
/** Velocity, in px/s, at which the travelling indicator reaches its full stretch. */
const STRETCH_AT = 2000;
const STRETCH_MAX = 0.04;
/** The swell of a pressed bubble. */
const PRESS_SCALE = 1.02;
/**
 * The magnet: a glyph leans toward the bubble as it passes, most (a quarter
 * of this) when the bubble is half a slot away, and swells a little under it.
 */
const MAGNET_PX = 4;
const MAGNET_SCALE = 0.015;
/** Air either side of a glyph and its name in a regular-width cell. */
const TOP_TAB_PAD = 14;
/** A regular-width cell before the names have been measured. */
const TOP_PITCH_GUESS = 96;
/** A regular-width cell with the name gone: the glyph alone. */
const TOP_ICON_CELL = 56;
/** A cell never shrinks below this, whatever the window. */
const TOP_CELL_MIN = 44;
/** Air either side of the title in its section. */
const TITLE_PAD = 14;
/** The field's section, within these. */
const FIELD_MIN = 140;
const FIELD_MAX = 260;

/** How the band fits its window: the cell, the widest name's cell, whether names show, whether the title shows. */
type TopFit = { pitch: number; widest: number; labels: boolean; title: boolean };

const POP_EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';
const BADGE_POP: Keyframe[] = [{ transform: 'scale(1)' }, { transform: 'scale(1.12)', offset: 0.45 }, { transform: 'scale(1)' }];

type Press = {
  id: number;
  x: number;
  y: number;
  /** Set once the finger moves sideways: the capsule is grabbed and follows it. */
  scrub: boolean;
  trackLeft: number;
  /** Offset from the live capsule position when the horizontal drag takes over. */
  grabOffset: number;
  /** The tab under the capsule while scrubbing, so preview only re-renders on change. */
  over: string;
  /** Where the finger has put the capsule over the last few frames, for its velocity at release. */
  trail: PointerSample[];
};

function useViewportWidth() {
  const [vw, setVw] = useState(() =>
    typeof window === 'undefined' ? SSR_VIEWPORT : window.innerWidth,
  );
  useEffect(() => {
    const sync = () => setVw(window.innerWidth);
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, []);
  return vw;
}

/**
 * How far the on-screen keyboard has eaten into the viewport, in px, while
 * `enabled`. A fixed bar sits at the bottom of the layout viewport, which the
 * keyboard covers; the visual viewport says by how much.
 */
function useKeyboardInset(enabled: boolean) {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!enabled || !vv) return;
    const sync = () =>
      setInset(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)));
    sync();
    vv.addEventListener('resize', sync);
    vv.addEventListener('scroll', sync);
    return () => {
      vv.removeEventListener('resize', sync);
      vv.removeEventListener('scroll', sync);
      setInset(0);
    };
  }, [enabled]);
  return inset;
}

/** A count that pops when it changes; the visually hidden text beside it is what is read aloud. */
function Badge({ count, reduce }: { count: number; reduce: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(count);
  useEffect(() => {
    if (shown.current === count) return;
    shown.current = count;
    if (!reduce) ref.current?.animate?.(BADGE_POP, { duration: 200, easing: POP_EASE });
  }, [count, reduce]);
  return (
    <span ref={ref} className="anav__badge" aria-hidden>
      {count}
    </span>
  );
}

/**
 * One of the things that fill the pill in a wide mode. Zero-width and inert
 * outside its own mode. A short crossfade keeps its content readable while
 * the surrounding glass changes shape.
 */
function Segment({
  name,
  active,
  height,
  shape,
  className,
  children,
}: {
  name: NavMode;
  active: boolean;
  height: number;
  shape: Transition;
  className?: string;
  children: ReactNode;
}) {
  return (
    <motion.div
      className={`anav__segment anav__segment--${name}${className ? ` ${className}` : ''}`}
      aria-hidden={!active || undefined}
      inert={!active || undefined}
      initial={false}
      animate={{ opacity: active ? 1 : 0, transform: active ? 'scale(1)' : 'scale(0.97)' }}
      transition={{ transform: shape, opacity: active ? FADE_IN : FADE_OUT }}
      style={{ height, pointerEvents: active ? 'auto' : 'none' }}
    >
      {children}
    </motion.div>
  );
}

/** One thing in the trailing section at regular width; it crossfades in place as the mode changes. */
function GroupItem({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <motion.div
      className={`anav__item${className ? ` ${className}` : ''}`}
      initial={{ opacity: 0, transform: 'scale(0.97)' }}
      animate={{ opacity: 1, transform: 'scale(1)', transition: { opacity: FADE_IN, transform: SHAPE_SPRING } }}
      exit={{ opacity: 0, transform: 'scale(0.97)', transition: { opacity: FADE_OUT, transform: FADE_OUT } }}
    >
      {children}
    </motion.div>
  );
}

type TabHandlers = {
  down: (e: ReactPointerEvent<HTMLButtonElement>, id: string) => void;
  move: (e: ReactPointerEvent<HTMLButtonElement>) => void;
  up: (e: ReactPointerEvent<HTMLButtonElement>) => void;
  cancel: (e: ReactPointerEvent<HTMLButtonElement>) => void;
  key: (e: ReactKeyboardEvent<HTMLButtonElement>) => void;
  click: (e: ReactMouseEvent<HTMLButtonElement>, id: string) => void;
};

/**
 * One section. Its glyph rides a magnet driven by the bubble's position: it
 * leans toward the bubble as it passes and swells a little under it, on the
 * compositor, with no render in between.
 */
function Tab({
  tab,
  index,
  offset,
  hit,
  pitch,
  x,
  magnet,
  hidden,
  isValue,
  active,
  label,
  labelled,
  shape,
  reduce,
  badgeText,
  handlers,
}: {
  tab: TabOption;
  index: number;
  offset: number;
  /** The button's height: the pill's, so the hit region is never smaller than the guideline's 44pt. */
  hit: number;
  /** The width of one section's cell: the slot, or a share of a spanning pill. */
  pitch: number;
  x: MotionValue<number>;
  magnet: boolean;
  hidden: boolean;
  isValue: boolean;
  active: boolean;
  label: string;
  labelled: boolean;
  shape: Transition;
  reduce: boolean;
  badgeText: ReactNode;
  handlers: TabHandlers;
}) {
  // The bubble's centre sits pitch/2 beyond x; so does this glyph's beyond
  // index·pitch, so their distance in cells is simply this.
  const pull = useTransform(x, (v) => {
    if (!magnet) return 0;
    const d = (v - index * pitch) / pitch;
    return Math.abs(d) >= 1 ? 0 : MAGNET_PX * d * (1 - Math.abs(d));
  });
  const swell = useTransform(x, (v) => {
    if (!magnet) return 1;
    const d = Math.abs(v - index * pitch) / pitch;
    return d >= 1 ? 1 : 1 + MAGNET_SCALE * (1 - d) * (1 - d);
  });
  const magnetTransform = useTransform([pull, swell], ([position, scale]: number[]) =>
    `translateX(${position}px) scale(${scale})`,
  );
  return (
    <motion.button
      type="button"
      role="tab"
      aria-selected={isValue}
      aria-label={label}
      aria-hidden={hidden || undefined}
      tabIndex={hidden ? -1 : isValue ? 0 : -1}
      data-active={active || undefined}
      className="anav__btn"
      initial={false}
      animate={{
        transform: `translateX(${offset}px) scale(${hidden ? 0.97 : 1})`,
        opacity: hidden ? 0 : 1,
      }}
      transition={shape}
      style={{ width: pitch, height: hit, pointerEvents: hidden ? 'none' : 'auto' }}
      onPointerDown={(e) => handlers.down(e, tab.id)}
      onPointerMove={handlers.move}
      onPointerUp={handlers.up}
      onPointerCancel={handlers.cancel}
      onLostPointerCapture={handlers.cancel}
      onKeyDown={handlers.key}
      onClick={(e) => handlers.click(e, tab.id)}
    >
      <motion.span className="anav__magnet" style={{ transform: magnetTransform }}>
        <span className="anav__glyph">
          <tab.Icon />
        </span>
        {labelled && <span className="anav__label">{tab.label}</span>}
      </motion.span>
      {tab.badge ? <Badge count={tab.badge} reduce={reduce} /> : null}
      {badgeText}
    </motion.button>
  );
}

export function AdaptiveNav({
  mode,
  options,
  value,
  onChange,
  onBack,
  action,
  buy,
  search,
  tools,
  select,
  confirm,
  minimized = false,
  onExpand,
  glass,
  indicator = 'capsule',
  tone: toneSetting = 'auto',
  quality = 'auto',
  labels,
  backIcon,
  metrics,
  labelled = false,
  fill = false,
  placement: placementSetting = 'auto',
  title,
  className,
}: AdaptiveNavProps) {
  const placement = usePlacement(placementSetting);
  const top = placement === 'top';
  const env = useEnvironment();
  // At the top, a finger gets a band whose sections are 48px, a pointer alone
  // the 44px compact scale of a Mac toolbar; both keep 44px hit regions.
  const m: NavMetrics = {
    ...DEFAULT_METRICS,
    ...(top ? (env.touch ? TOP_TOUCH_METRICS : TOP_POINTER_METRICS) : null),
    ...metrics,
  };
  const L: NavLabels = { ...DEFAULT_LABELS, ...labels };

  const [preview, setPreview] = useState<string | null>(null);
  const press = useRef<Press | null>(null);
  // A drag or a browser-claimed gesture must not count as a tap; the click
  // that may still follow reads this.
  const cancelled = useRef(false);
  const pendingTapFrame = useRef<number | null>(null);
  const [pressed, setPressed] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const [keyboardInput, setKeyboardInput] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const reduceMotion = useReducedMotion() ?? false;
  const wide = isWide(mode);
  const hidden = mode === 'hidden';
  const searching = mode === 'search';
  const toolbar = mode === 'toolbar';
  // At the top the tabs stay through every mode and what a mode adds goes to
  // the trailing section, so the track there only ever holds the tabs.
  const wideTrack = wide && !top;
  const toolsInTrack = toolbar && !top;
  const folded = minimized && !top;
  /** The pill takes the screen: always in a wide mode, in tabs and context when asked to and not minimized. */
  const spanning = !top && (wide || (fill && !minimized && !toolbar));
  /** The left circle is out whenever the bar is not at the home level… */
  const pushed = mode !== 'tabs' && !hidden;
  /** …and reads as Close, not Back, where the screen is a session or a sheet. */
  const closing = mode === 'select' || mode === 'confirm';
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const g = useGlass(glass);
  // What the lens costs is decided per device; what it looks like, per material.
  const rendition = resolveQuality(quality, env);
  const bends = g.refraction > 0;
  const pillLens = bends && rendition.pill;
  const circleLens = bends && rendition.circles;
  /** Only the travelling capsule is a bubble; a dot or a glow has no lip to bend at. */
  // A cell wider than the slot gets a rounded indicator, not a disc; the bubble's lens map is a disc, so it sits this out there.
  const bubbleLens = pillLens && rendition.bubble && indicator === 'capsule' && !(spanning && !wide) && !top;
  const dispersion = rendition.dispersion ? g.dispersion : 0;
  // url(#…) cannot carry the punctuation React puts around its ids.
  const filterId = 'anav-' + useId().replace(/[^\w-]/g, '');

  // The pill spans the screen in the wide modes and the slot tightens on
  // narrow phones; both need the viewport width. A toolbar with more tools
  // than there are tabs has to fit too.
  const vw = useViewportWidth();
  const slot = solveSlot(vw, Math.max(options.length, tools?.length ?? 0), m);
  /** Satellites match the pill's outer height, so their arcs share its radius. */
  const sat = slot + m.pad * 2;
  // The glass needs a box-shadow and a backdrop blur, which a clip-path cannot
  // carry, so the resolved radii are applied as border radii rather than as
  // clipped paths.
  const { outer: outerRadius, inner: innerRadius } = capsuleRadii(sat, m.pad);
  const keyboard = useKeyboardInset(searching && !top);

  // Where the indicator is headed while a finger is down; not a commitment yet.
  const activeId = preview ?? value;
  const activeIndex = Math.max(0, options.findIndex((o) => o.id === activeId));

  const visible = visibleSlots(options.length, top ? 'tabs' : mode, folded, activeIndex);
  const visibleCount = visible.filter(Boolean).length;
  /** What the pill is sized around: the tabs shown, or the toolbar's tools. */
  const shown = toolsInTrack ? (tools?.length ?? 0) : visibleCount;

  // A spanning pill takes the screen less its insets and whatever circles hang
  // off it: Back on every pushed screen, the action when the screen gives one.
  // The wide modes always span; tabs and context span when asked to and not
  // minimized. It shifts by half a circle when only one end carries one, so
  // its leading edge stays beside Back.
  const leading = mode !== 'tabs';
  const trailing = !!action;
  // At regular width every cell is one width, the widest name's, measured
  // from stand-ins before paint. One pitch is what keeps the capsule, the
  // scrub and the magnet arithmetic the same as in a compact pill.
  /** The title on the leading edge at regular width; a selection's count stands in for it. */
  const heading = top ? (title ?? (mode === 'select' ? select?.label : undefined)) : undefined;
  const [topFit, setTopFit] = useState<TopFit>({ pitch: TOP_PITCH_GUESS, widest: TOP_PITCH_GUESS, labels: true, title: true });
  // The band must never overflow: the guideline leaves overflow menus to the
  // system and asks for layouts that do not need one, and it has the centre
  // give way before the edges. So, measured before paint: names beside
  // glyphs while they fit; glyphs alone when they do not; the title last;
  // and only then narrower cells. The edges are pinned to the window's
  // margins and the pill is centred between them, as the guideline draws
  // them, so the pill's room is the window less twice the wider edge.
  useLayoutEffect(() => {
    if (!top) return;
    const track = trackRef.current;
    const root = rootRef.current;
    if (!track || !root) return;
    const names = [...track.querySelectorAll<HTMLElement>('.anav__measure--name')].map((el) => el.offsetWidth);
    if (!names.length) return;
    const widest = Math.ceil(Math.max(...names)) + TOP_TAB_PAD * 2;
    const titleText = track.querySelector<HTMLElement>('.anav__measure--title')?.offsetWidth ?? 0;
    const titleW = titleText ? Math.ceil(titleText) + TITLE_PAD * 2 : 0;
    const backW = pushed ? sat : 0;
    // Only sections that are staying count: one on its way out still has its
    // width for a moment, and a fit measured against it would flicker.
    const staying = [...root.querySelectorAll<HTMLElement>('.anav__side--trailing .anav__satellite')].filter(
      (el) => el.dataset.for === '*' || el.dataset.for === mode,
    );
    const trailingW = staying.reduce((sum, el) => sum + el.offsetWidth, 0) + m.gap * Math.max(0, staying.length - 1);
    const room = (leadingW: number) => vw - m.edge * 2 - 2 * (Math.max(leadingW, trailingW) + m.gap) - m.pad * 2;
    const n = options.length;
    const withTitle = backW + (titleW ? titleW + (backW ? m.gap : 0) : 0);
    let labels = true;
    let showTitle = titleW > 0;
    let pitch = widest;
    if (widest * n > room(withTitle)) {
      labels = false;
      pitch = TOP_ICON_CELL;
      if (TOP_ICON_CELL * n > room(withTitle)) {
        showTitle = false;
        pitch = Math.max(TOP_CELL_MIN, Math.min(TOP_ICON_CELL, Math.floor(room(backW) / n)));
      }
    }
    setTopFit((prev) =>
      prev.pitch === pitch && prev.widest === widest && prev.labels === labels && prev.title === showTitle
        ? prev
        : { pitch, widest, labels, title: showTitle },
    );
  });
  const showLabel = labelled || (top && topFit.labels);
  const topPitch = topFit.pitch;
  const width = top
    ? options.length * topPitch + m.pad * 2
    : spanning
      ? spanWidth(vw, sat, (leading ? 1 : 0) + (trailing ? 1 : 0), m)
      : pillWidth(mode, shown, slot, sat, vw, m);
  const shift = spanning ? (((leading ? 1 : 0) - (trailing ? 1 : 0)) * (sat + m.gap)) / 2 : 0;
  /** One section's share of the pill: the slot, a spanning width divided among the sections, or a regular-width cell. */
  const pitch = top ? topPitch : spanning && !wide ? (width - m.pad * 2) / Math.max(1, shown) : slot;
  // The field takes what the trailing edge's half of the window can spare
  // beside a pill that still shows its names: the margin, the gap, half of
  // that pill, and the action. Only when even the least field would not fit
  // do the names give way, in the fit above.
  const fieldWidth = Math.round(
    Math.max(
      FIELD_MIN,
      Math.min(
        FIELD_MAX,
        vw / 2 - m.edge - m.gap - (topFit.widest * options.length + m.pad * 2) / 2 - (action ? sat + m.gap : 0),
      ),
    ),
  );

  const capsuleTarget = indicatorOffset(visible, activeIndex, pitch);
  const x = useMotionValue(capsuleTarget);
  // Remember the destination, so clearing a preview does not restart the
  // release spring and discard the velocity that the finger handed it.
  const destination = useRef<number | null>(capsuleTarget);
  useLayoutEffect(() => {
    // While the finger holds the capsule, it alone decides where x goes.
    if (press.current?.scrub) return;
    if (reduceMotion || keyboardInput) {
      x.jump(capsuleTarget);
      destination.current = capsuleTarget;
      return;
    }
    if (destination.current === capsuleTarget) return;
    destination.current = capsuleTarget;
    animate(x, capsuleTarget, SELECTION_SPRING);
  }, [capsuleTarget, scrubbing, x, reduceMotion, keyboardInput]);

  // Speed becomes shape: the capsule lengthens along its travel and thins to
  // keep its area, so a fast pass reads as motion rather than a strobe of
  // positions. The small deformation settles without a second wobble.
  const velocity = useVelocity(x);
  const rawStretch = useTransform(velocity, (v) =>
    reduceMotion || keyboardInput ? 1 : 1 + Math.min(Math.abs(v) / STRETCH_AT, 1) * STRETCH_MAX,
  );
  const stretch = useSpring(rawStretch, STRETCH_SPRING);
  const scale = useSpring(1, PRESS_SPRING);
  useLayoutEffect(() => {
    if (reduceMotion || keyboardInput) {
      scale.jump(1);
      stretch.jump(1);
    } else {
      scale.set(pressed ? PRESS_SCALE : 1);
    }
  }, [pressed, reduceMotion, keyboardInput, scale, stretch]);
  const scaleX = useTransform([scale, stretch], ([s, st]: number[]) => s * st);
  const scaleY = useTransform([scale, stretch], ([s, st]: number[]) => s / Math.sqrt(st));
  const slotBox = indicatorBox(indicator, slot, m.pad);
  // In a spanning pill the capsule is its cell: the same width, so at either
  // end it sits the pad from the pill's edge on every side, concentric with
  // the pill's own corner, the way the disc is in a compact pill. A dot or a
  // glow keeps its size. Either way it sits centred in the cell.
  const box =
    (spanning || top) && !wideTrack && indicator === 'capsule' ? { ...slotBox, w: Math.max(slotBox.w, pitch) } : slotBox;
  const capsuleX = useTransform(x, (v) => v + box.dx + (pitch - box.w) / 2);
  const showCapsule = !wideTrack && !toolsInTrack && indicator !== 'lift';
  // The magnet only makes sense while every slot is where the arithmetic says.
  const magnet = showCapsule && scrubbing && !folded && !reduceMotion && !keyboardInput;
  const capsuleTransform = useTransform([capsuleX, scaleX, scaleY], ([position, sx, sy]: number[]) =>
    `translateX(${position}px) scaleX(${sx}) scaleY(${sy})`,
  );

  // The field takes focus as the pill opens. Synchronously in the commit, so
  // it still counts as part of the tap that asked for it and the keyboard comes up.
  useLayoutEffect(() => {
    if (searching) inputRef.current?.focus({ preventScroll: true });
    else inputRef.current?.blur();
  }, [searching]);

  // Confirmation reverts on its own; the bar should never be stuck on "Added".
  useEffect(() => {
    if (!confirmed) return;
    const t = setTimeout(() => setConfirmed(false), CONFIRM_MS);
    return () => clearTimeout(t);
  }, [confirmed]);
  // Leaving the product hides the label anyway; the timer above clears the flag.
  const showConfirmed = confirmed && mode === 'buy';

  useEffect(() => () => {
    if (pendingTapFrame.current !== null) cancelAnimationFrame(pendingTapFrame.current);
  }, []);

  const endPress = useCallback(() => {
    press.current = null;
    setPressed(false);
    setScrubbing(false);
    setPreview(null);
  }, []);

  // On a pushed screen every section is a way out, the current one included.
  const commit = (id: string) => {
    if (folded) onExpand?.();
    else if (pushed || id !== value) onChange(id);
  };

  /**
   * Letting go. A scrub commits the tab the capsule would coast to — the
   * finger's velocity projected forward, the way a scroll view decides where
   * to stop — and springs there carrying that velocity. A scrub the browser
   * or the window took from us just falls back to the selection.
   */
  const release = (commitScrub: boolean) => {
    const p = press.current;
    if (!p) return;
    if (p.scrub) {
      const velocity = commitScrub ? trailVelocity(p.trail, performance.now()) : 0;
      const idx = releaseTarget({
        held: x.get(), velocity, pitch, count: options.length,
        selected: Math.max(0, options.findIndex((option) => option.id === value)),
        cancelled: !commitScrub,
      });
      const target = idx * pitch;
      destination.current = target;
      if (reduceMotion) x.jump(target);
      else animate(x, target, commitScrub ? { ...RELEASE_SPRING, velocity } : SELECTION_SPRING);
      // A scrub is a selection, not a tap: landing on the current tab changes nothing.
      if (commitScrub && options[idx].id !== value) onChange(options[idx].id);
    } else if (commitScrub) {
      // Keep the pressed destination through pointerup -> click. Clearing it
      // here would briefly spring back to the old tab before click commits.
      press.current = null;
      setPressed(false);
      if (pendingTapFrame.current !== null) cancelAnimationFrame(pendingTapFrame.current);
      pendingTapFrame.current = requestAnimationFrame(() => {
        pendingTapFrame.current = null;
        setPreview(null);
      });
      return;
    } else {
      // Restore even if the preview already equals value: there may be no
      // state change to trigger the selection effect after cancellation.
      const selected = Math.max(0, options.findIndex((option) => option.id === value));
      const target = indicatorOffset(visible, selected, pitch);
      destination.current = target;
      if (reduceMotion) x.jump(target);
      else animate(x, target, SELECTION_SPRING);
    }
    endPress();
  };
  const releaseRef = useRef(release);
  releaseRef.current = release;

  // If the button never sees an up — capture stolen, gesture handed to the
  // browser, window blurred — the press would stay stuck on.
  useEffect(() => {
    if (!press.current && !pressed) return;
    const up = (event: PointerEvent) => {
      if (press.current?.id === event.pointerId) releaseRef.current(true);
    };
    const drop = (event: Event) => {
      if ('pointerId' in event && press.current?.id !== event.pointerId) return;
      if (press.current) {
        cancelled.current = true;
        releaseRef.current(false);
      }
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', drop);
    window.addEventListener('blur', drop);
    return () => {
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', drop);
      window.removeEventListener('blur', drop);
    };
  }, [pressed]);

  const canScrub = !folded && !wideTrack && !toolsInTrack && !hidden && options.length > 1;

  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>, id: string) => {
    if (!e.isPrimary || press.current) return;
    setKeyboardInput(false);
    // Capture keeps move/up coming if the finger slides off, but it throws
    // when the pointer is already gone — and a throw here would skip the
    // feedback below and leave the control feeling dead.
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      /* the window listener still covers us */
    }
    press.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      scrub: false,
      trackLeft: 0,
      grabOffset: 0,
      over: id,
      trail: [],
    };
    cancelled.current = false;
    setPressed(true);
    if (!folded) setPreview(id);
  };

  /** The capsule under the finger: 1:1 along the track, rubber-banded past the ends. */
  const track = (clientX: number) => {
    const p = press.current;
    if (!p) return;
    const n = options.length;
    const held = clientX - p.trackLeft - m.pad - p.grabOffset;
    const target = scrubPosition(held, pitch, n);
    // A held object tracks the pointer directly; springs only own the release.
    x.set(target);
    const now = performance.now();
    p.trail.push({ x: target, t: now });
    while (p.trail.length > 1 && now - p.trail[0].t > TRAIL_MS) p.trail.shift();
    const idx = Math.min(n - 1, Math.max(0, Math.round(target / pitch)));
    const id = options[idx].id;
    if (p.over !== id) {
      p.over = id;
      setPreview(id);
    }
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    if (p.scrub) {
      track(e.clientX);
      return;
    }
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (Math.hypot(dx, dy) <= DRAG_CANCEL) return;
    // Past the threshold, intent is clear: sideways grabs the capsule, anything
    // else is a scroll or a change of mind. Either way the click is spent.
    cancelled.current = true;
    if (canScrub && Math.abs(dx) > Math.abs(dy)) {
      p.scrub = true;
      p.trackLeft = trackRef.current?.getBoundingClientRect().left ?? 0;
      // Grab the current presentation position, including an interrupted tap
      // spring. Crossing the drag threshold must not snap it to the finger.
      x.stop();
      p.grabOffset = e.clientX - p.trackLeft - m.pad - x.get();
      destination.current = null;
      p.trail = [{ x: x.get(), t: performance.now() }];
      setScrubbing(true);
      track(e.clientX);
    } else {
      release(false);
    }
  };

  const onPointerCancel = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (press.current?.id !== e.pointerId) return;
    cancelled.current = true;
    release(false);
  };

  // Feedback ends here; a tap's commit waits for the click that follows, so a
  // tap and a keyboard activation share one path and nothing fires twice. A
  // scrub commits now — there is no click coming that means anything.
  const onPointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (press.current?.id === e.pointerId) release(true);
  };

  const onClick = (e: ReactMouseEvent<HTMLButtonElement>, id: string) => {
    if (pendingTapFrame.current !== null) cancelAnimationFrame(pendingTapFrame.current);
    pendingTapFrame.current = null;
    setPreview(null);
    // Keyboard and assistive-tech activation arrive with detail 0 and no
    // pointer sequence; a pointer click is only a tap if it was never cancelled.
    if (e.detail === 0) setKeyboardInput(true);
    if (e.detail === 0 || !cancelled.current) commit(id);
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    setKeyboardInput(true);
    if (folded) {
      if (['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) {
        e.preventDefault();
        onExpand?.();
      }
      return;
    }
    const i = options.findIndex((o) => o.id === value);
    let next = -1;
    if (e.key === 'ArrowRight') next = (i + 1) % options.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + options.length) % options.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = options.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onChange(options[next].id);
    e.currentTarget.parentElement
      ?.querySelectorAll<HTMLElement>('[role="tab"]')
      [next]?.focus();
  };

  const onSearchKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') search?.onSubmit?.(search.value);
    else if (e.key === 'Escape') onBack?.();
  };

  const handlers: TabHandlers = {
    down: onPointerDown,
    move: onPointerMove,
    up: onPointerUp,
    cancel: onPointerCancel,
    key: onKeyDown,
    click: onClick,
  };

  const shape: Transition = reduceMotion || keyboardInput ? { duration: 0 } : SHAPE_SPRING;
  const glyph = reduceMotion || keyboardInput ? { duration: 0 } : GLYPH;
  // The frost thins toward the lip only inside the lens filter, where the bend
  // explains it; a crisp ring without a bend reads as a cut-out.
  const masks = useFrostMasks({ width, height: sat, circle: sat, refraction: pillLens ? g.refraction : 0 });

  // Which way the bar faces. Over dark content the material itself flips to
  // its dark base; a bar with its own `glass` writes the tokens inline, so the
  // flip has to happen here rather than in the stylesheet's tone rule.
  const tone = useBackdropTone(rootRef, toneSetting, `${mode}:${width}:${vw}`);
  const material = tone === 'dark' ? { ...g, base: g.baseDark } : g;

  const badgeText = (count?: number) => (count ? <span className="anav__sr">{L.badge(count)}</span> : null);

  // The field is one thing in two homes: the pill in a compact view, the
  // trailing section at regular width. One ref, since only one home renders.
  const field = (
    <>
      <span className="anav__fieldIcon" aria-hidden>
        <IconSearch />
      </span>
      <input
        ref={inputRef}
        className="anav__input"
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        aria-label={search?.label ?? L.search}
        placeholder={search?.placeholder ?? L.search}
        value={search?.value ?? ''}
        onChange={(e) => search?.onChange(e.target.value)}
        onKeyDown={onSearchKeyDown}
      />
      {searching && search?.value ? (
        <button
          type="button"
          className="anav__clear"
          aria-label={L.clear}
          onClick={() => {
            search.onChange('');
            inputRef.current?.focus();
          }}
        >
          <IconClear />
        </button>
      ) : null}
    </>
  );
  /** The prominent action for the mode, at regular width: one, trailing, tinted. */
  const prominent =
    mode === 'buy' ? (
      <button
        type="button"
        className="anav__prominent"
        onClick={() => {
          if (!buy) return;
          buy.onPress();
          setConfirmed(true);
        }}
      >
        <span className="anav__ctaLabel" data-confirmed={showConfirmed || undefined}>
          <span>{buy?.label ?? ''}</span>
          <span aria-hidden>{buy?.done ?? L.done}</span>
        </span>
        <span className="anav__ctaPrice">{buy?.price ?? ''}</span>
        <span className="anav__sr" aria-live="polite">
          {showConfirmed ? (buy?.done ?? L.done) : ''}
        </span>
      </button>
    ) : mode === 'select' ? (
      <button type="button" className="anav__prominent" onClick={select?.onDone}>
        {select?.done ?? L.selectDone}
      </button>
    ) : mode === 'confirm' ? (
      <button type="button" className="anav__prominent" onClick={confirm?.primary.onPress}>
        {confirm?.primary.label ?? ''}
      </button>
    ) : null;
  const iconButton = (item: NavAction) => (
    <button
      type="button"
      className="anav__iconButton"
      aria-label={item.label}
      aria-pressed={item.active}
      data-on={item.active || undefined}
      onClick={item.onPress}
    >
      <span className="anav__glyph">
        <item.Icon />
      </span>
      {item.badge ? <Badge count={item.badge} reduce={reduceMotion} /> : null}
      {badgeText(item.badge)}
    </button>
  );
  const back = pushed ? (
    <Satellite key="back" side="leading" tuck={sat + m.gap} reduce={reduceMotion || keyboardInput} lens={circleLens}>
      <button type="button" className="anav__circle" aria-label={closing ? L.close : L.back} onClick={onBack}>
        {backIcon ?? (closing ? <IconClear /> : <IconBack />)}
      </button>
    </Satellite>
  ) : null;
  const calm = reduceMotion || keyboardInput;
  const leadingEdge = top ? (
    // The leading edge, pinned to the margin: Back or Close at the far end,
    // then the title, each its own section, the way the guideline orders them.
    <div className="anav__side anav__side--leading">
            <AnimatePresence initial={false}>
              {back}
              {heading && topFit.title && (
                <Satellite key="title" side="leading" group tuck={sat + m.gap} reduce={calm} lens={false}>
                  <span className="anav__surface" aria-hidden />
                  <div className="anav__row">
                    <span className="anav__title" aria-live={mode === 'select' && !title ? 'polite' : undefined}>
                      {heading}
                    </span>
                  </div>
                </Satellite>
              )}
            </AnimatePresence>
          </div>
  ) : null;
  const section = (key: string, tag: string, className: string | undefined, children: ReactNode) => (
    <Satellite key={key} side="trailing" group className={className} tag={tag} tuck={sat + m.gap} reduce={calm} lens={false}>
      <span className="anav__surface" aria-hidden />
      {children}
    </Satellite>
  );
  const trailingEdge = top ? (
    // The trailing edge, pinned to the margin, in distinct sections with fixed
    // space between: the symbol actions together, the field, the quiet
    // secondary, and last the one prominent action, its whole section tinted.
    <div className="anav__side anav__side--trailing">
            <AnimatePresence initial={false}>
              {(action || (toolbar && tools?.length)) &&
                section(
                  'actions',
                  '*',
                  undefined,
                  <div className="anav__row" role="toolbar" aria-label={L.tools}>
                    <AnimatePresence initial={false}>
                      {toolbar && tools?.map((tool) => <GroupItem key={`tool:${tool.id}`}>{iconButton(tool)}</GroupItem>)}
                      {action && <GroupItem key={`action:${action.id}`}>{iconButton(action)}</GroupItem>}
                    </AnimatePresence>
                  </div>,
                )}
              {searching &&
                section(
                  'field',
                  'search',
                  'anav__satellite--field',
                  <div className="anav__row anav__fieldRow" style={{ width: fieldWidth }}>
                    {field}
                  </div>,
                )}
              {mode === 'confirm' &&
                confirm?.secondary &&
                section(
                  'secondary',
                  'confirm',
                  undefined,
                  <div className="anav__row">
                    <button type="button" className="anav__quiet" onClick={confirm.secondary.onPress}>
                      {confirm.secondary.label}
                    </button>
                  </div>,
                )}
              {prominent && section(`prominent:${mode}`, mode, 'anav__satellite--prominent', <div className="anav__row">{prominent}</div>)}
            </AnimatePresence>
          </div>
  ) : null;

  const pillNode = (
      <motion.div
        key="pill"
        className="anav__pill"
        initial={false}
        // Hidden slides the whole cluster below the screen edge, shadow
        // included, shrinking a little as it goes so it reads as leaving.
        animate={{
          width,
          transform: top
            ? 'translateX(0px) translateY(0px) scale(1)'
            : `translateX(${shift}px) translateY(${hidden ? sat + 96 : 0}px) scale(${hidden ? 0.97 : 1})`,
        }}
        transition={shape}
        style={{ transformOrigin: '50% 100%' }}
      >
        {pillLens && <span className="anav__refract" aria-hidden />}
        <span className="anav__frost anav__frost--pill" aria-hidden />
        <span className="anav__surface" aria-hidden />
        <span className="anav__edge anav__edge--pill" aria-hidden />
        <span className="anav__shine" aria-hidden />

        {!top && <AnimatePresence initial={false}>{back}</AnimatePresence>}

        <nav
          ref={trackRef}
          className="anav__track"
          aria-label={toolsInTrack ? L.tools : L.sections}
          role={toolsInTrack ? 'toolbar' : wideTrack ? undefined : 'tablist'}
        >
          {top &&
            options.map((tab) => (
              <span key={`measure-${tab.id}`} className="anav__measure anav__measure--name" aria-hidden>
                <span className="anav__magnet">
                  <span className="anav__glyph">
                    <tab.Icon />
                  </span>
                  <span className="anav__label">{tab.label}</span>
                </span>
              </span>
            ))}
          {top && heading && (
            <span className="anav__measure anav__measure--title" aria-hidden>
              {heading}
            </span>
          )}
          <motion.span
            className="anav__capsule"
            aria-hidden
            style={{ transform: capsuleTransform, width: box.w, height: box.h, top: box.top }}
            initial={false}
            animate={{ opacity: showCapsule ? 1 : 0 }}
            transition={glyph}
          >
            {bubbleLens && <span className="anav__refract--capsule" />}
          </motion.span>
          {options.map((tab, i) => {
            const isValue = tab.id === value;
            return (
              <Tab
                key={tab.id}
                tab={tab}
                index={i}
                offset={indicatorOffset(visible, i, pitch)}
                hit={sat}
                pitch={pitch}
                x={x}
                magnet={magnet}
                hidden={!visible[i]}
                isValue={isValue}
                active={tab.id === activeId}
                label={folded && isValue ? L.expandHint(tab.label) : tab.label}
                labelled={showLabel}
                shape={shape}
                reduce={reduceMotion || keyboardInput}
                badgeText={badgeText(tab.badge)}
                handlers={handlers}
              />
            );
          })}

          {/* Toolbar only, compact: the screen's actions take the slots the tabs left. */}
          {!top &&
            tools?.map((tool, i) => (
            <motion.button
              key={tool.id}
              type="button"
              className="anav__btn anav__tool"
              aria-label={tool.label}
              aria-pressed={tool.active}
              aria-hidden={!toolsInTrack || undefined}
              tabIndex={toolsInTrack ? 0 : -1}
              data-on={tool.active || undefined}
              initial={false}
              animate={{ transform: `translateX(${toolsInTrack ? i * slot : 0}px) scale(${toolsInTrack ? 1 : 0.97})`, opacity: toolsInTrack ? 1 : 0 }}
              transition={shape}
              style={{ width: slot, height: sat, pointerEvents: toolsInTrack ? 'auto' : 'none' }}
              onClick={tool.onPress}
            >
              <span className="anav__magnet">
                <span className="anav__glyph">
                  <tool.Icon />
                </span>
                {labelled && <span className="anav__label">{tool.label}</span>}
              </span>
              {tool.badge ? <Badge count={tool.badge} reduce={reduceMotion} /> : null}
              {badgeText(tool.badge)}
            </motion.button>
          ))}

          {!top && (
            <>
          <Segment name="buy" active={mode === 'buy'} height={slot} shape={shape}>
            <button
              type="button"
              className="anav__cta"
              onClick={() => {
                if (mode !== 'buy' || !buy) return;
                buy.onPress();
                setConfirmed(true);
              }}
            >
              <span className="anav__ctaLabel" data-confirmed={showConfirmed || undefined}>
                <span>{buy?.label ?? ''}</span>
                {/* Visual only; the live region below is what gets announced. */}
                <span aria-hidden>{buy?.done ?? L.done}</span>
              </span>
              <span className="anav__ctaPrice">{buy?.price ?? ''}</span>
              <span className="anav__sr" aria-live="polite">
                {showConfirmed ? (buy?.done ?? L.done) : ''}
              </span>
            </button>
          </Segment>

          <Segment name="search" active={searching} height={slot} shape={shape} className="anav__field">
            {field}
          </Segment>

          <Segment name="select" active={mode === 'select'} height={slot} shape={shape}>
            <div className="anav__select">
              <span className="anav__selectLabel" aria-live="polite">
                {select?.label ?? ''}
              </span>
              <button type="button" className="anav__selectDone" onClick={select?.onDone}>
                {select?.done ?? L.selectDone}
              </button>
            </div>
          </Segment>

          <Segment name="confirm" active={mode === 'confirm'} height={slot} shape={shape}>
            <div className="anav__confirm">
              {confirm?.secondary && (
                <button type="button" className="anav__secondary" onClick={confirm.secondary.onPress}>
                  {confirm.secondary.label}
                </button>
              )}
              <button type="button" className="anav__primary" onClick={confirm?.primary.onPress}>
                {confirm?.primary.label ?? ''}
              </button>
            </div>
          </Segment>
            </>
          )}
        </nav>

        {!top && (
          <AnimatePresence initial={false}>
            {action && (
              <Satellite
                key={action.id}
                side="trailing"
                tuck={sat + m.gap}
                reduce={calm}
                lens={circleLens}
                badge={action.badge ? <Badge count={action.badge} reduce={reduceMotion} /> : undefined}
              >
                <button
                  type="button"
                  className="anav__circle"
                  aria-label={action.label}
                  aria-pressed={action.active}
                  data-on={action.active || undefined}
                  onClick={action.onPress}
                >
                  <action.Icon />
                  {badgeText(action.badge)}
                </button>
              </Satellite>
            )}
          </AnimatePresence>
        )}
      </motion.div>
  );

  return (
    <div
      ref={rootRef}
      onPointerDownCapture={() => setKeyboardInput(false)}
      onKeyDownCapture={() => setKeyboardInput(true)}
      className={className ? `anav ${className}` : 'anav'}
      data-mode={mode}
      data-placement={placement}
      data-fill={spanning || undefined}
      data-tone={tone}
      data-labelled={labelled || undefined}
      data-minimized={folded || undefined}
      data-hidden={hidden || undefined}
      data-indicator={indicator}
      data-pressed={pressed || undefined}
      data-scrub={scrubbing || undefined}
      data-keyboard={keyboardInput || undefined}
      data-input={env.touch ? 'touch' : 'pointer'}
      data-pill-lens={pillLens || undefined}
      data-circle-lens={circleLens || undefined}
      aria-hidden={hidden || undefined}
      inert={hidden || undefined}
      style={{
        // A bar with its own material writes every token here, where the
        // composites are read, so the override stays scoped to this bar.
        ...(glass !== undefined ? glassVars(material) : null),
        ['--anav-slot' as string]: `${slot}px`,
        ['--anav-sat' as string]: `${sat}px`,
        ['--anav-pad' as string]: `${m.pad}px`,
        ['--anav-gap' as string]: `${m.gap}px`,
        ['--anav-r-outer' as string]: `${outerRadius}px`,
        ['--anav-r-inner' as string]: `${innerRadius}px`,
        ['--anav-pitch' as string]: `${pitch}px`,
        ['--anav-edge' as string]: `${m.edge}px`,
        ['--anav-keyboard' as string]: `${keyboard}px`,
        ['--anav-refract-pill' as string]: pillLens ? `url(#${filterId}-pill)` : 'none',
        ['--anav-refract-circle' as string]: circleLens ? `url(#${filterId}-circle)` : 'none',
        ['--anav-refract-capsule' as string]: bubbleLens ? `url(#${filterId}-capsule)` : 'none',
      }}
    >
      {pillLens && (
        <GlassFilters
          id={filterId}
          width={width}
          height={sat}
          circle={sat}
          circles={circleLens}
          capsule={bubbleLens ? box.w : 0}
          blur={g.blur}
          saturate={g.saturate}
          refraction={g.refraction}
          dispersion={dispersion}
          masks={masks}
        />
      )}

      {top ? (
        // At regular width the bar is a band across the window: the edges at
        // its margins, the tabs centred between them. Hidden slides the whole
        // band off the top edge, shrinking a little as it goes.
        <motion.div
          // Keyed apart from the pill: React would otherwise reuse the pill's
          // element here when the placement flips, and Motion would carry the
          // pill's last width onto the band.
          key="band"
          className="anav__band"
          initial={false}
          animate={{ transform: hidden ? `translateY(${-(sat + 96)}px) scale(0.97)` : 'translateY(0px) scale(1)' }}
          transition={shape}
          style={{ transformOrigin: '50% 0%' }}
        >
          {leadingEdge}
          {pillNode}
          {trailingEdge}
        </motion.div>
      ) : (
        pillNode
      )}
    </div>
  );
}
