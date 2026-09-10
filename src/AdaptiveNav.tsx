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
import type { BuyAction, NavAction, NavLabels, NavMode, SearchField, TabOption } from './types';

export type AdaptiveNavProps = {
  mode: NavMode;
  options: TabOption[];
  /** The id of the selected tab. */
  value: string;
  onChange: (id: string) => void;
  /** Back circle press; rendered in `context`, `buy` and `search` modes. */
  onBack?: () => void;
  /** The right-hand circle, chosen by the screen. Omit for Back alone. */
  action?: NavAction;
  /** The call to action the pill becomes in `buy` mode. */
  buy?: BuyAction;
  /** The field the pill becomes in `search` mode. */
  search?: SearchField;
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
  /** Override the strings assistive tech reads; defaults are English. */
  labels?: Partial<NavLabels>;
  /** Replaces the built-in chevron inside the Back circle. */
  backIcon?: ReactNode;
  /** Override slot size, paddings and the buy pill's cap; see `DEFAULT_METRICS`. */
  metrics?: Partial<NavMetrics>;
  className?: string;
};

const DEFAULT_LABELS: NavLabels = {
  back: 'Back',
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

const POP_EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
const POP: Record<'rest' | 'lift', Keyframe[]> = {
  rest: [{ transform: 'scale(0.84)' }, { transform: 'scale(1.07)', offset: 0.6 }, { transform: 'scale(1)' }],
  lift: [
    { transform: 'translateY(1px) scale(0.84)' },
    { transform: 'translateY(-2.5px) scale(1.18)', offset: 0.6 },
    { transform: 'translateY(-1.5px) scale(1.12)' },
  ],
};

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

export function AdaptiveNav({
  mode,
  options,
  value,
  onChange,
  onBack,
  action,
  buy,
  search,
  minimized = false,
  onExpand,
  glass,
  indicator = 'capsule',
  labels,
  backIcon,
  metrics,
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
  /** Back is out whenever the bar is not at the home level. */
  const pushed = mode === 'context' || wide;
  const trackRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const g = useGlass(glass);
  const lens = g.refraction > 0;
  // url(#…) cannot carry the punctuation React puts around its ids.
  const filterId = 'anav-' + useId().replace(/[^\w-]/g, '');

  // The pill spans the screen in buy mode and the slot tightens on narrow
  // phones; both need the viewport width.
  const vw = useViewportWidth();
  const slot = solveSlot(vw, options.length, m);
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
    animate(x, capsuleTarget, spring);
  }, [capsuleTarget, x, reduceMotion]);

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
  const showCapsule = !wide && indicator !== 'lift';

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
      animate(x, idx * slot, reduceMotion ? REDUCED_SPRING : { ...RELEASE_SPRING, velocity });
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

  const canScrub = !minimized && !wide && !hidden && options.length > 1;

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

  const shape = reduceMotion ? { duration: 0 } : SHAPE_SPRING;
  const glyph = reduceMotion ? { duration: 0 } : GLYPH;
  const width = pillWidth(mode, visibleCount, slot, sat, vw, m);
  const masks = useFrostMasks({ width, height: sat, circle: sat, refraction: g.refraction });
  /** Only the travelling capsule is a bubble; a dot or a glow has no lip to bend at. */
  const capsuleLens = lens && indicator === 'capsule' ? box.w : 0;

  const badgeCount = (count?: number) =>
    count ? (
      <span className="anav__badge" aria-hidden>
        {count}
      </span>
    ) : null;
  const badgeText = (count?: number) => (count ? <span className="anav__sr">{L.badge(count)}</span> : null);

  return (
    <div
      className={className ? `anav ${className}` : 'anav'}
      data-mode={mode}
      data-minimized={minimized || undefined}
      data-hidden={hidden || undefined}
      data-indicator={indicator}
      data-pressed={pressed || undefined}
      data-scrub={scrubbing || undefined}
      aria-hidden={hidden || undefined}
      inert={hidden || undefined}
      style={{
        // A bar with its own material writes every token here, where the
        // composites are read, so the override stays scoped to this bar.
        ...(glass !== undefined ? glassVars(g) : null),
        ['--anav-slot' as string]: `${slot}px`,
        ['--anav-sat' as string]: `${sat}px`,
        ['--anav-pad' as string]: `${m.pad}px`,
        ['--anav-gap' as string]: `${m.gap}px`,
        ['--anav-r-outer' as string]: `${outerRadius}px`,
        ['--anav-r-inner' as string]: `${innerRadius}px`,
        ['--anav-keyboard' as string]: `${keyboard}px`,
        ['--anav-refract-pill' as string]: lens ? `url(#${filterId}-pill)` : 'none',
        ['--anav-refract-circle' as string]: lens ? `url(#${filterId}-circle)` : 'none',
        ['--anav-refract-capsule' as string]: capsuleLens ? `url(#${filterId}-capsule)` : 'none',
        ['--anav-frost-mask-pill' as string]: masks.pill ? `url(${masks.pill})` : 'none',
        ['--anav-frost-mask-circle' as string]: masks.circle ? `url(${masks.circle})` : 'none',
      }}
    >
      {lens && (
        <GlassFilters
          id={filterId}
          width={width}
          height={sat}
          circle={sat}
          capsule={capsuleLens}
          refraction={g.refraction}
          dispersion={g.dispersion}
        />
      )}

      <motion.div
        className="anav__pill"
        initial={false}
        // Hidden slides the whole cluster below the screen edge, shadow included.
        animate={{ width, y: hidden ? sat + 96 : 0 }}
        transition={shape}
      >
        {lens && <span className="anav__refract" aria-hidden />}
        <span className="anav__frost" aria-hidden />
        <span className="anav__surface" aria-hidden />
        <span className="anav__shine" aria-hidden />

        <AnimatePresence initial={false}>
          {pushed && (
            <Satellite key="back" side="leading" tuck={sat + m.gap} reduce={reduceMotion} lens={lens}>
              <button type="button" className="anav__circle" aria-label={L.back} onClick={onBack}>
                {backIcon ?? <IconBack />}
              </button>
            </Satellite>
          )}
        </AnimatePresence>

        <nav
          ref={trackRef}
          className="anav__track"
          aria-label={L.sections}
          role={wide ? undefined : 'tablist'}
        >
          <motion.span
            className="anav__capsule"
            aria-hidden
            style={{ x: capsuleX, scaleX, scaleY, width: box.w, height: box.h, top: box.top }}
            initial={false}
            animate={{ opacity: showCapsule ? 1 : 0 }}
            transition={glyph}
          >
            {capsuleLens > 0 && <span className="anav__refract--capsule" />}
          </motion.span>
          {options.map((tab, i) => {
            const isHidden = !visible[i];
            const isValue = tab.id === value;
            const active = tab.id === activeId;
            const label = minimized && isValue ? L.expandHint(tab.label) : tab.label;
            return (
              <motion.button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isValue}
                aria-label={label}
                aria-hidden={isHidden || undefined}
                tabIndex={isHidden ? -1 : isValue ? 0 : -1}
                data-active={active || undefined}
                className="anav__btn"
                initial={false}
                animate={{
                  width: isHidden ? 0 : slot,
                  opacity: isHidden ? 0 : 1,
                  scale: isHidden ? 0.6 : 1,
                }}
                transition={shape}
                style={{ height: slot, pointerEvents: isHidden ? 'none' : 'auto' }}
                onPointerDown={(e) => onPointerDown(e, tab.id)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerCancel}
                onKeyDown={onKeyDown}
                onClick={(e) => onClick(e, tab.id)}
              >
                <span className="anav__glyph">
                  <tab.Icon />
                </span>
                {badgeCount(tab.badge)}
                {badgeText(tab.badge)}
              </motion.button>
            );
          })}

          {/* Buy mode only: grows from nothing as the pill widens. */}
          <motion.button
            type="button"
            className="anav__cta"
            aria-hidden={mode !== 'buy' || undefined}
            tabIndex={mode === 'buy' ? 0 : -1}
            initial={false}
            animate={{ opacity: mode === 'buy' ? 1 : 0, scale: mode === 'buy' ? 1 : 0.92 }}
            // The shape spring's tail is right for width, wrong for opacity —
            // it would leave the label translucent long after it arrived.
            transition={{ scale: shape, opacity: mode === 'buy' ? FADE_IN : FADE_OUT }}
            style={{ height: slot, pointerEvents: mode === 'buy' ? 'auto' : 'none' }}
            onClick={() => {
              if (mode !== 'buy' || !buy) return;
              buy.onPress();
              setConfirmed(true);
            }}
          >
            <span className="anav__ctaInner">
              <span className="anav__ctaLabel" data-confirmed={showConfirmed || undefined}>
                <span>{buy?.label ?? ''}</span>
                {/* Visual only; the live region below is what gets announced. */}
                <span aria-hidden>{buy?.done ?? L.done}</span>
              </span>
              <span className="anav__ctaPrice">{buy?.price ?? ''}</span>
            </span>
            <span className="anav__sr" aria-live="polite">
              {showConfirmed ? (buy?.done ?? L.done) : ''}
            </span>
          </motion.button>

          {/* Search mode only: the same growth, with a field inside. */}
          <motion.div
            className="anav__field"
            aria-hidden={!searching || undefined}
            initial={false}
            animate={{ opacity: searching ? 1 : 0, scale: searching ? 1 : 0.92 }}
            transition={{ scale: shape, opacity: searching ? FADE_IN : FADE_OUT }}
            style={{ height: slot, pointerEvents: searching ? 'auto' : 'none' }}
          >
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
              tabIndex={searching ? 0 : -1}
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
          </motion.div>
        </nav>

        <AnimatePresence initial={false}>
          {action && (
            <Satellite
              key={action.id}
              side="trailing"
              tuck={sat + m.gap}
              reduce={reduceMotion}
              lens={lens}
              badge={badgeCount(action.badge)}
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
