// With the extension, so `node --test` can load this module as it stands.
import { ROUTE_CURVE } from './springs.ts'

/**
 * The page arriving under the bar, on the bar's own clock.
 *
 * The bar answers a change of screen by reshaping its pill and moving its
 * capsule, and the page arrives at the same moment. Left to itself the page
 * takes a different curve on a different clock, and the pair reads as two
 * movements: measured on a phone-class machine, a page tween of 300/420ms
 * landed up to 180ms away from the bar's springs, and the bar reached halfway
 * two or three frames ahead.
 *
 * Two things fix that, and both are here:
 *
 * - The same curve. `ROUTE_CURVE` is the bar's route spring sampled as a CSS
 *   `linear()` easing, so the Web Animations API can run exactly what Motion
 *   runs, on the compositor, where a busy main thread cannot stall it. The
 *   first frame of a new screen is the busiest the main thread gets.
 * - The same instant. Left to start itself, the animation begins on the next
 *   frame, as the bar's springs do. It used to be pinned to the moment of
 *   creation; measured in Chrome, that put the page a frame behind the pill
 *   at full speed, and under 4x CPU throttling drew the page at rest for one
 *   frame (its clock at -83ms, no fill) before it jumped back and arrived.
 *   Unpinned with `fill: backwards` it holds its first keyframe until the
 *   frame it starts, and tracks the pill to within half a frame either way.
 *
 * Call it in a layout effect keyed on the screen, with the element that just
 * arrived. Nothing else has to know about the bar.
 */

export type ScreenEnterOptions = {
  /**
   * 1 for a push, -1 for a pop, 0 for a change of section. A step comes in
   * from the side it is going; a change of place settles downward.
   */
  direction?: number
  /** How far a step travels, in pixels. */
  distance?: number
  /** How far a change of section falls, in pixels. */
  drop?: number
  /**
   * What it fades up from. Not zero by default: fading up from nothing shows
   * the page's ground for a frame, which reads as a flash rather than a move.
   */
  opacity?: number
  /** Reduced motion, or a keyboard that has just moved focus: no entrance at all. */
  skip?: boolean
}

/** The bar's route curve as an easing, or a strong ease-out of the same length where `linear()` is missing (before Chrome 113, Safari 17.2, Firefox 112). */
export function routeEasing(): string {
  return typeof CSS !== 'undefined' && CSS.supports('animation-timing-function', ROUTE_CURVE.easing)
    ? ROUTE_CURVE.easing
    : 'cubic-bezier(0.23, 1, 0.32, 1)'
}

/**
 * Animates `element` in as the screen it belongs to arrives. Returns the
 * animation, so a caller can cancel it when the screen changes again, or null
 * when there is nothing to animate.
 *
 * Input: (the new screen's element, { direction: 1 })
 * Output: an Animation sliding it from 56px to the right, fading up from 0.35
 */
export function enterScreen(element: HTMLElement | null | undefined, options: ScreenEnterOptions = {}): Animation | null {
  const { direction = 0, distance = 56, drop = 14, opacity = direction ? 0.35 : 0.4, skip = false } = options
  if (skip || !element?.animate) return null
  const from = direction ? `translate3d(${direction * distance}px, 0, 0)` : `translate3d(0, ${drop}px, 0)`
  const move = element.animate(
    [
      { transform: from, opacity },
      { transform: 'none', opacity: 1 },
    ],
    { duration: ROUTE_CURVE.duration, easing: routeEasing(), fill: 'backwards' },
  )
  // Left to start itself, a web animation begins on the next frame's time —
  // which is when Motion starts the bar's springs, on their first frame.
  // Pinning the start (to performance.now() at commit, or to the timeline's
  // current time) put the page a frame behind the pill or a frame ahead of
  // it; measured, unpinned it tracks the pill frame for frame. fill: backwards
  // holds the first keyframe until then, so the page never shows at rest
  // for a frame before it arrives.
  return move
}
