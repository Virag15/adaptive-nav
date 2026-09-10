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
  DEFAULT_METRICS,
  capsuleRadii,
  indicatorBox,
  indicatorOffset,
  isWide,
  pillWidth,
  solveSlot,
  visibleSlots,
  type IndicatorStyle,
  type NavMetrics,
} from './geometry';
import {
  FADE_IN,
  FADE_OUT,
  FOLLOW_SPRING,
  GLYPH,
  PRESS_SPRING,
  REDUCED_SPRING,
  RELEASE_SPRING,
  SELECTION_SPRING,
  SHAPE_SPRING,
  STRETCH_SPRING,
  project,
  rubberband,
} from './springs';
import { glassVars, type GlassInput } from './glass';
import { useGlass } from './useGlass';
import { useBackdropTone } from './useBackdropTone';
import { resolveQuality, type Quality } from './quality';
import { useEnvironment } from './useEnvironment';
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
const STRETCH_MAX = 0.22;
/** The swell of a pressed bubble. */
const PRESS_SCALE = 1.05;
/** How much finger history feeds the release velocity. */
const TRAIL_MS = 80;
/**
 * The magnet: a glyph leans toward the bubble as it passes, most (a quarter
 * of this) when the bubble is half a slot away, and swells a little under it.
 */
const MAGNET_PX = 12;
const MAGNET_SCALE = 0.05;

const POP_EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
const POP: Record<'rest' | 'lift', Keyframe[]> = {
  rest: [{ transform: 'scale(0.84)' }, { transform: 'scale(1.07)', offset: 0.6 }, { transform: 'scale(1)' }],
  lift: [
    { transform: 'translateY(1px) scale(0.84)' },
    { transform: 'translateY(-2.5px) scale(1.18)', offset: 0.6 },
    { transform: 'translateY(-1.5px) scale(1.12)' },
  ],
};
const RIPPLE: Keyframe[] = [
  { transform: 'scale(1)', opacity: 0.7 },
  { transform: 'scale(1.4)', opacity: 0 },
];
const BADGE_POP: Keyframe[] = [{ transform: 'scale(1)' }, { transform: 'scale(1.35)', offset: 0.45 }, { transform: 'scale(1)' }];

type Press = {
  id: number;
  x: number;
  y: number;
  /** Set once the finger moves sideways: the capsule is grabbed and follows it. */
  scrub: boolean;
  trackLeft: number;
  /** The tab under the capsule while scrubbing, so preview only re-renders on change. */
  over: string;
  /** Where the finger has put the capsule over the last few frames, for its velocity at release. */
  trail: { x: number; t: number }[];
};

/**
 * The finger's speed from its recent trail, in px/s. The capsule's own spring
 * lags the finger by design, so its velocity is the wrong one to throw with.
 */
function trailVelocity(trail: { x: number; t: number }[]): number {
  if (trail.length < 2) return 0;
  const last = trail[trail.length - 1];
  const first = trail[0];
  const dt = last.t - first.t;
  return dt > 0 ? ((last.x - first.x) / dt) * 1000 : 0;
}

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
    if (!reduce) ref.current?.animate?.(BADGE_POP, { duration: 360, easing: POP_EASE });
  }, [count, reduce]);
  return (
    <span ref={ref} className="anav__badge" aria-hidden>
      {count}
    </span>
  );
}

/**
 * One of the things that fill the pill in a wide mode. Zero-width and inert
 * outside its own mode; it materialises — sharpens from a blur as it scales
 * up — rather than merely fading, so it reads as glass arriving.
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
      animate={{ opacity: active ? 1 : 0, scale: active ? 1 : 0.92, filter: active ? 'blur(0px)' : 'blur(6px)' }}
      // The shape spring's tail is right for width, wrong for opacity — it
      // would leave the label translucent long after it arrived.
      transition={{ scale: shape, opacity: active ? FADE_IN : FADE_OUT, filter: active ? FADE_IN : FADE_OUT }}
      style={{ height, pointerEvents: active ? 'auto' : 'none' }}
    >
      {children}
    </motion.div>
  );
}

type TabHandlers = {
  down: (e: ReactPointerEvent<HTMLButtonElement>, id: string) => void;
  move: (e: ReactPointerEvent<HTMLButtonElement>) => void;
  up: () => void;
  cancel: () => void;
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
  slot,
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
  slot: number;
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
  // The bubble's centre sits slot/2 beyond x; so does this glyph's beyond
  // index·slot, so their distance in slots is simply this.
  const pull = useTransform(x, (v) => {
    if (!magnet) return 0;
    const d = (v - index * slot) / slot;
    return Math.abs(d) >= 1 ? 0 : MAGNET_PX * d * (1 - Math.abs(d));
  });
  const swell = useTransform(x, (v) => {
    if (!magnet) return 1;
    const d = Math.abs(v - index * slot) / slot;
    return d >= 1 ? 1 : 1 + MAGNET_SCALE * (1 - d) * (1 - d);
  });
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
        width: hidden ? 0 : slot,
        opacity: hidden ? 0 : 1,
        scale: hidden ? 0.6 : 1,
      }}
      transition={shape}
      style={{ height: slot, pointerEvents: hidden ? 'none' : 'auto' }}
      onPointerDown={(e) => handlers.down(e, tab.id)}
      onPointerMove={handlers.move}
      onPointerUp={handlers.up}
      onPointerCancel={handlers.cancel}
      onKeyDown={handlers.key}
      onClick={(e) => handlers.click(e, tab.id)}
    >
      <motion.span className="anav__magnet" style={{ x: pull, scale: swell }}>
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
  className,
}: AdaptiveNavProps) {
  const m: NavMetrics = { ...DEFAULT_METRICS, ...metrics };
  const L: NavLabels = { ...DEFAULT_LABELS, ...labels };

  const [preview, setPreview] = useState<string | null>(null);
  const press = useRef<Press | null>(null);
  // A drag or a browser-claimed gesture must not count as a tap; the click
  // that may still follow reads this.
  const cancelled = useRef(false);
  const [pressed, setPressed] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const reduceMotion = useReducedMotion() ?? false;
  const wide = isWide(mode);
  const hidden = mode === 'hidden';
  const searching = mode === 'search';
  const toolbar = mode === 'toolbar';
  /** The left circle is out whenever the bar is not at the home level… */
  const pushed = mode !== 'tabs' && !hidden;
  /** …and reads as Close, not Back, where the screen is a session or a sheet. */
  const closing = mode === 'select' || mode === 'confirm';
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const rippleRef = useRef<HTMLSpanElement>(null);

  const g = useGlass(glass);
  // What the lens costs is decided per device; what it looks like, per material.
  const rendition = resolveQuality(quality, useEnvironment());
  const bends = g.refraction > 0;
  const pillLens = bends && rendition.pill;
  const circleLens = bends && rendition.circles;
  /** Only the travelling capsule is a bubble; a dot or a glow has no lip to bend at. */
  const bubbleLens = pillLens && rendition.bubble && indicator === 'capsule';
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
  const keyboard = useKeyboardInset(searching);

  // Where the indicator is headed while a finger is down; not a commitment yet.
  const activeId = preview ?? value;
  const activeIndex = Math.max(0, options.findIndex((o) => o.id === activeId));

  const visible = visibleSlots(options.length, mode, minimized, activeIndex);
  const visibleCount = visible.filter(Boolean).length;
  /** What the pill is sized around: the tabs shown, or the toolbar's tools. */
  const shown = toolbar ? (tools?.length ?? 0) : visibleCount;

  /** The ring a landing bubble sends out. */
  const ripple = useCallback(() => {
    if (reduceMotion) return;
    rippleRef.current?.animate?.(RIPPLE, { duration: 520, easing: POP_EASE });
  }, [reduceMotion]);

  const capsuleTarget = indicatorOffset(visible, activeIndex, slot);
  const x = useMotionValue(capsuleTarget);
  const settled = useRef(false);
  // True between letting go of a scrub and the next settle, so that one spring
  // carries the finger's momentum rather than the calmer tap spring.
  const released = useRef(false);
  useEffect(() => {
    if (!settled.current) {
      x.jump(capsuleTarget);
      settled.current = true;
      return;
    }
    // While the finger holds the capsule, it alone decides where x goes.
    if (press.current?.scrub) return;
    const spring = reduceMotion ? REDUCED_SPRING : released.current ? RELEASE_SPRING : SELECTION_SPRING;
    released.current = false;
    animate(x, capsuleTarget, { ...spring, onComplete: ripple });
  }, [capsuleTarget, x, reduceMotion, ripple]);

  // Speed becomes shape: the capsule lengthens along its travel and thins to
  // keep its area, so a fast pass reads as motion rather than a strobe of
  // positions. Smoothed through an underdamped spring, so it settles with one
  // small wobble, the way jelly lands.
  const velocity = useVelocity(x);
  const rawStretch = useTransform(velocity, (v) =>
    reduceMotion ? 1 : 1 + Math.min(Math.abs(v) / STRETCH_AT, STRETCH_MAX),
  );
  const stretch = useSpring(rawStretch, STRETCH_SPRING);
  const scale = useSpring(1, PRESS_SPRING);
  useEffect(() => {
    scale.set(pressed ? PRESS_SCALE : 1);
  }, [pressed, scale]);
  const scaleX = useTransform([scale, stretch], ([s, st]: number[]) => s * st);
  const scaleY = useTransform([scale, stretch], ([s, st]: number[]) => s / Math.sqrt(st));
  const box = indicatorBox(indicator, slot, m.pad);
  const capsuleX = useTransform(x, (v) => v + box.dx);
  const showCapsule = !wide && !toolbar && indicator !== 'lift';
  // The magnet only makes sense while every slot is where the arithmetic says.
  const magnet = showCapsule && !minimized && !reduceMotion;

  // The glyph that has just become the selection lands with a small bounce.
  // Imperative, so the first paint does not pop and a re-render never replays it.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (reduceMotion) return;
    const glyph = trackRef.current?.querySelector<HTMLElement>('[data-active] .anav__glyph');
    glyph?.animate?.(POP[indicator === 'lift' ? 'lift' : 'rest'], { duration: 380, easing: POP_EASE });
  }, [activeId, indicator, reduceMotion]);

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

  const endPress = useCallback(() => {
    press.current = null;
    setPressed(false);
    setScrubbing(false);
    setPreview(null);
  }, []);

  // On a pushed screen every section is a way out, the current one included.
  const commit = (id: string) => {
    if (minimized) onExpand?.();
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
    if (p?.scrub && commitScrub) {
      const velocity = trailVelocity(p.trail);
      const held = p.trail[p.trail.length - 1]?.x ?? x.get();
      const rest = held + project(velocity);
      const idx = Math.min(options.length - 1, Math.max(0, Math.round(rest / slot)));
      const id = options[idx].id;
      released.current = true;
      // A scrub is a selection, not a tap: landing on the current tab changes nothing.
      if (id !== value) onChange(id);
      // The spring leaves at the finger's speed, so there is no seam between drag and settle.
      animate(
        x,
        idx * slot,
        reduceMotion ? REDUCED_SPRING : { ...RELEASE_SPRING, velocity, onComplete: ripple },
      );
    }
    endPress();
  };
  const releaseRef = useRef(release);
  releaseRef.current = release;

  // If the button never sees an up — capture stolen, gesture handed to the
  // browser, window blurred — the press would stay stuck on.
  useEffect(() => {
    if (!press.current && !pressed) return;
    const up = () => {
      if (press.current) releaseRef.current(true);
    };
    const drop = () => {
      if (press.current) releaseRef.current(false);
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

  const canScrub = !minimized && !wide && !toolbar && !hidden && options.length > 1;

  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>, id: string) => {
    if (!e.isPrimary) return;
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
      over: id,
      trail: [],
    };
    cancelled.current = false;
    setPressed(true);
    if (!minimized) setPreview(id);
  };

  /** The capsule under the finger: 1:1 along the track, rubber-banded past the ends. */
  const track = (clientX: number) => {
    const p = press.current;
    if (!p) return;
    const n = options.length;
    const local = clientX - p.trackLeft - m.pad;
    const max = (n - 1) * slot;
    let target = local - slot / 2;
    if (target < 0) target = rubberband(target, slot);
    else if (target > max) target = max + rubberband(target - max, slot);
    animate(x, target, reduceMotion ? REDUCED_SPRING : FOLLOW_SPRING);
    const now = performance.now();
    p.trail.push({ x: target, t: now });
    while (p.trail.length > 1 && now - p.trail[0].t > TRAIL_MS) p.trail.shift();
    const idx = Math.min(n - 1, Math.max(0, Math.floor(local / slot)));
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
      setScrubbing(true);
      track(e.clientX);
    } else {
      endPress();
    }
  };

  const onPointerCancel = () => {
    cancelled.current = true;
    release(false);
  };

  // Feedback ends here; a tap's commit waits for the click that follows, so a
  // tap and a keyboard activation share one path and nothing fires twice. A
  // scrub commits now — there is no click coming that means anything.
  const onPointerUp = () => release(true);

  const onClick = (e: ReactMouseEvent<HTMLButtonElement>, id: string) => {
    // Keyboard and assistive-tech activation arrive with detail 0 and no
    // pointer sequence; a pointer click is only a tap if it was never cancelled.
    if (e.detail === 0 || !cancelled.current) commit(id);
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (minimized) {
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

  const shape: Transition = reduceMotion ? { duration: 0 } : SHAPE_SPRING;
  const glyph = reduceMotion ? { duration: 0 } : GLYPH;
  // A wide pill reserves both satellite slots. When no circle hangs off the
  // trailing end, the field takes that width instead of leaving it empty, and
  // the pill shifts by half so its leading edge stays beside Back.
  const freed = wide && !action ? sat + m.gap : 0;
  const width = pillWidth(mode, shown, slot, sat, vw, m) + freed;
  const masks = useFrostMasks({ width, height: sat, circle: sat, refraction: g.refraction });

  // Which way the bar faces. Over dark content the material itself flips to
  // its dark base; a bar with its own `glass` writes the tokens inline, so the
  // flip has to happen here rather than in the stylesheet's tone rule.
  const tone = useBackdropTone(rootRef, toneSetting, `${mode}:${width}:${vw}`);
  const material = tone === 'dark' ? { ...g, base: g.baseDark } : g;

  const badgeText = (count?: number) => (count ? <span className="anav__sr">{L.badge(count)}</span> : null);

  return (
    <div
      ref={rootRef}
      className={className ? `anav ${className}` : 'anav'}
      data-mode={mode}
      data-tone={tone}
      data-labelled={labelled || undefined}
      data-minimized={minimized || undefined}
      data-hidden={hidden || undefined}
      data-indicator={indicator}
      data-pressed={pressed || undefined}
      data-scrub={scrubbing || undefined}
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
        ['--anav-keyboard' as string]: `${keyboard}px`,
        ['--anav-refract-pill' as string]: pillLens ? `url(#${filterId}-pill)` : 'none',
        ['--anav-refract-circle' as string]: circleLens ? `url(#${filterId}-circle)` : 'none',
        ['--anav-refract-capsule' as string]: bubbleLens ? `url(#${filterId}-capsule)` : 'none',
        ['--anav-frost-mask-pill' as string]: masks.pill ? `url(${masks.pill})` : 'none',
        ['--anav-frost-mask-circle' as string]: masks.circle ? `url(${masks.circle})` : 'none',
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

      <motion.div
        className="anav__pill"
        initial={false}
        // Hidden slides the whole cluster below the screen edge, shadow
        // included, shrinking a little as it goes so it reads as leaving.
        animate={{ width, x: freed / 2, y: hidden ? sat + 96 : 0, scale: hidden ? 0.9 : 1 }}
        transition={shape}
        style={{ transformOrigin: '50% 100%' }}
      >
        {pillLens && <span className="anav__refract" aria-hidden />}
        <span className="anav__frost anav__frost--pill" aria-hidden />
        <span className="anav__surface" aria-hidden />
        <span className="anav__edge anav__edge--pill" aria-hidden />
        <span className="anav__shine" aria-hidden />

        <AnimatePresence initial={false}>
          {pushed && (
            <Satellite key="back" side="leading" tuck={sat + m.gap} reduce={reduceMotion} lens={circleLens}>
              <button
                type="button"
                className="anav__circle"
                aria-label={closing ? L.close : L.back}
                onClick={onBack}
              >
                {backIcon ?? (closing ? <IconClear /> : <IconBack />)}
              </button>
            </Satellite>
          )}
        </AnimatePresence>

        <nav
          ref={trackRef}
          className="anav__track"
          aria-label={toolbar ? L.tools : L.sections}
          role={toolbar ? 'toolbar' : wide ? undefined : 'tablist'}
        >
          <motion.span
            className="anav__capsule"
            aria-hidden
            style={{ x: capsuleX, scaleX, scaleY, width: box.w, height: box.h, top: box.top }}
            initial={false}
            animate={{ opacity: showCapsule ? 1 : 0 }}
            transition={glyph}
          >
            {bubbleLens && <span className="anav__refract--capsule" />}
            <span ref={rippleRef} className="anav__ripple" />
          </motion.span>
          {options.map((tab, i) => {
            const isValue = tab.id === value;
            return (
              <Tab
                key={tab.id}
                tab={tab}
                index={i}
                slot={slot}
                x={x}
                magnet={magnet}
                hidden={!visible[i]}
                isValue={isValue}
                active={tab.id === activeId}
                label={minimized && isValue ? L.expandHint(tab.label) : tab.label}
                labelled={labelled}
                shape={shape}
                reduce={reduceMotion}
                badgeText={badgeText(tab.badge)}
                handlers={handlers}
              />
            );
          })}

          {/* Toolbar only: the screen's actions take the slots the tabs left. */}
          {tools?.map((tool) => (
            <motion.button
              key={tool.id}
              type="button"
              className="anav__btn anav__tool"
              aria-label={tool.label}
              aria-pressed={tool.active}
              aria-hidden={!toolbar || undefined}
              tabIndex={toolbar ? 0 : -1}
              data-on={tool.active || undefined}
              initial={false}
              animate={{ width: toolbar ? slot : 0, opacity: toolbar ? 1 : 0, scale: toolbar ? 1 : 0.6 }}
              transition={shape}
              style={{ height: slot, pointerEvents: toolbar ? 'auto' : 'none' }}
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
        </nav>

        <AnimatePresence initial={false}>
          {action && (
            <Satellite
              key={action.id}
              side="trailing"
              tuck={sat + m.gap}
              reduce={reduceMotion}
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
      </motion.div>
    </div>
  );
}
