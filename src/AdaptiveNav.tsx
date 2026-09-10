import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { AnimatePresence, motion, useReducedMotion, useSpring } from 'motion/react';
import { Satellite } from './Satellite';
import { IconBack } from './icons';
import {
  DEFAULT_METRICS,
  capsuleRadii,
  indicatorOffset,
  pillWidth,
  solveSlot,
  visibleSlots,
  type NavMetrics,
} from './geometry';
import {
  FADE_IN,
  FADE_OUT,
  GLYPH,
  PRESS_SPRING,
  REDUCED_SPRING,
  SELECTION_SPRING,
  SHAPE_SPRING,
} from './springs';
import type { BuyAction, NavAction, NavLabels, NavMode, TabOption } from './types';

export type AdaptiveNavProps = {
  mode: NavMode;
  options: TabOption[];
  /** The id of the selected tab. */
  value: string;
  onChange: (id: string) => void;
  /** Back circle press; only rendered in `context` and `buy` modes. */
  onBack?: () => void;
  /** The right-hand circle, chosen by the screen. Omit for Back alone. */
  action?: NavAction;
  /** The call to action the pill becomes in `buy` mode. */
  buy?: BuyAction;
  /** Collapsed to the active section only, the way a tab bar folds away on scroll. */
  minimized?: boolean;
  /** Any tap or arrow key on the minimized bar asks to unfold rather than switching. */
  onExpand?: () => void;
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
  badge: (n) => `${n} items`,
  expandHint: (label) => `${label}, tap to show all sections`,
};

/** How far a pointer may travel before it stops being a tap. */
const DRAG_CANCEL = 12;
/** How long the buy confirmation stays before the label returns. */
const CONFIRM_MS = 1400;
/** A phone-sized guess for the server render; the client measures on mount. */
const SSR_VIEWPORT = 393;

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

export function AdaptiveNav({
  mode,
  options,
  value,
  onChange,
  onBack,
  action,
  buy,
  minimized = false,
  onExpand,
  labels,
  backIcon,
  metrics,
  className,
}: AdaptiveNavProps) {
  const m: NavMetrics = { ...DEFAULT_METRICS, ...metrics };
  const L: NavLabels = { ...DEFAULT_LABELS, ...labels };

  const [preview, setPreview] = useState<string | null>(null);
  const press = useRef<{ id: number; x: number; y: number } | null>(null);
  // A drag or a browser-claimed gesture must not count as a tap; the click
  // that may still follow reads this.
  const cancelled = useRef(false);
  const [pressed, setPressed] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const reduceMotion = useReducedMotion() ?? false;
  const pushed = mode !== 'tabs';

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

  // Where the indicator is headed while a finger is down; not a commitment yet.
  const activeId = preview ?? value;
  const activeIndex = Math.max(0, options.findIndex((o) => o.id === activeId));

  const visible = visibleSlots(options.length, mode, minimized, activeIndex);
  const visibleCount = visible.filter(Boolean).length;

  const capsuleTarget = indicatorOffset(visible, activeIndex, slot);
  const x = useSpring(capsuleTarget, reduceMotion ? REDUCED_SPRING : SELECTION_SPRING);
  const settled = useRef(false);
  useEffect(() => {
    if (settled.current) x.set(capsuleTarget);
    else {
      x.jump(capsuleTarget);
      settled.current = true;
    }
  }, [capsuleTarget, x]);

  const scale = useSpring(1, PRESS_SPRING);
  useEffect(() => {
    scale.set(pressed ? 0.9 : 1);
  }, [pressed, scale]);

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
    setPreview(null);
  }, []);

  // If the button never sees an up — capture stolen, gesture handed to the
  // browser, window blurred — the press would stay stuck on.
  useEffect(() => {
    if (!press.current && !pressed) return;
    const release = () => {
      if (press.current) endPress();
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    window.addEventListener('blur', release);
    return () => {
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
      window.removeEventListener('blur', release);
    };
  }, [pressed, endPress]);

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
    press.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    cancelled.current = false;
    setPressed(true);
    if (!minimized) setPreview(id);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > DRAG_CANCEL) {
      cancelled.current = true;
      endPress();
    }
  };

  const onPointerCancel = () => {
    cancelled.current = true;
    endPress();
  };

  // On a pushed screen every section is a way out, the current one included.
  const commit = (id: string) => {
    if (minimized) onExpand?.();
    else if (pushed || id !== value) onChange(id);
  };

  // Feedback ends here; the commit waits for the click that follows, so a tap
  // and a keyboard activation share one path and nothing fires twice.
  const onPointerUp = () => endPress();

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

  const shape = reduceMotion ? { duration: 0 } : SHAPE_SPRING;
  const glyph = reduceMotion ? { duration: 0 } : GLYPH;
  const width = pillWidth(mode, visibleCount, slot, sat, vw, m);

  const badge = (count?: number) =>
    count ? (
      <span className="anav__badge">
        <span aria-hidden>{count}</span>
        <span className="anav__sr">{L.badge(count)}</span>
      </span>
    ) : null;

  return (
    <div
      className={className ? `anav ${className}` : 'anav'}
      data-mode={mode}
      data-minimized={minimized || undefined}
      style={{
        ['--anav-slot' as string]: `${slot}px`,
        ['--anav-sat' as string]: `${sat}px`,
        ['--anav-pad' as string]: `${m.pad}px`,
        ['--anav-gap' as string]: `${m.gap}px`,
        ['--anav-r-outer' as string]: `${outerRadius}px`,
        ['--anav-r-inner' as string]: `${innerRadius}px`,
      }}
    >
      <motion.div className="anav__pill" initial={false} animate={{ width }} transition={shape}>
        <span className="anav__surface" aria-hidden />

        <AnimatePresence initial={false}>
          {pushed && (
            <Satellite key="back" side="leading" tuck={sat + m.gap} reduce={reduceMotion}>
              <button type="button" className="anav__circle" aria-label={L.back} onClick={onBack}>
                {backIcon ?? <IconBack />}
              </button>
            </Satellite>
          )}
        </AnimatePresence>

        <nav
          className="anav__track"
          aria-label={L.sections}
          role={mode === 'buy' ? undefined : 'tablist'}
        >
          <motion.span
            className="anav__capsule"
            aria-hidden
            style={{ x, scale, width: slot, height: slot }}
            initial={false}
            animate={{ opacity: mode === 'buy' ? 0 : 1 }}
            transition={glyph}
          />
          {options.map((tab, i) => {
            const hidden = !visible[i];
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
                {badge(tab.badge)}
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
        </nav>

        <AnimatePresence initial={false}>
          {action && (
            <Satellite key={action.id} side="trailing" tuck={sat + m.gap} reduce={reduceMotion}>
              <button
                type="button"
                className="anav__circle"
                aria-label={action.label}
                aria-pressed={action.active}
                data-on={action.active || undefined}
                onClick={action.onPress}
              >
                <action.Icon />
                {badge(action.badge)}
              </button>
            </Satellite>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
