// A tap carries no momentum, so the capsule travels to it almost critically
// damped (ratio ~0.92, response ~0.35s): it settles, it does not wobble, and
// it stays grabbable if you tap again mid-flight.
export const SELECTION_SPRING = { type: 'spring', stiffness: 300, damping: 32, mass: 1 } as const;
// Landing after a scrub or a flick: the finger had momentum, so a little life
// (ratio ~0.68) reads as the capsule carrying it home.
export const RELEASE_SPRING = { type: 'spring', stiffness: 360, damping: 26, mass: 1 } as const;
// While the finger is down the capsule tracks it: response ~0.13s, critically
// damped, so it feels attached with just enough lag to read as weight.
export const FOLLOW_SPRING = { type: 'spring', stiffness: 1200, damping: 70, mass: 1 } as const;
export const REDUCED_SPRING = { type: 'spring', stiffness: 2200, damping: 120, mass: 1 } as const;
// The swell on press: quick, with a hint of bounce, like pressing a bubble.
export const PRESS_SPRING = { stiffness: 600, damping: 26, mass: 0.6 } as const;
// Speed becomes stretch through this; a ratio of ~0.72 lets the capsule wobble
// once as it lands, the way jelly settles.
export const STRETCH_SPRING = { stiffness: 700, damping: 38, mass: 1 } as const;
// Pill and slot widths: critically damped, slightly quicker — a container
// that overshoots reads as wobbly rather than alive.
export const SHAPE_SPRING = { type: 'spring', stiffness: 420, damping: 38, mass: 1 } as const;
// A circle leaving the pill: a hair under critical damping (ratio 0.85) so it
// lands with a hint of life. Going back under is stiffer, so a quick
// back-and-forth never trails behind the finger.
export const EMERGE_SPRING = { type: 'spring', stiffness: 400, damping: 34, mass: 1 } as const;
export const RETREAT_SPRING = { type: 'spring', stiffness: 600, damping: 48, mass: 1 } as const;
export const EASE_OUT = [0.23, 1, 0.32, 1] as const;
export const FADE_IN = { duration: 0.2, ease: EASE_OUT } as const;
export const FADE_OUT = { duration: 0.14, ease: EASE_OUT } as const;
export const GLYPH = { duration: 0.18, ease: EASE_OUT } as const;

/**
 * Where a flick would come to rest on its own: Apple's scroll deceleration,
 * so a throw lands on the tab the finger was headed for rather than the one it
 * happened to be over. The rate is well below a scroll view's 0.99: a capsule
 * snapping between slots should stay under a finger that was merely moving
 * (~500 px/s stays on its slot) and only jump for a real flick (~900 px/s
 * clears half a slot).
 *
 * Input: (600)   Output: ≈ 23.4  (px, at the default rate)
 * Input: (-900)  Output: ≈ -35.1
 */
export function project(velocity: number, decelerationRate = 0.975): number {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/**
 * Progressive resistance past a boundary: the further over, the less of the
 * finger's travel the capsule takes, so the ends feel like ends rather than walls.
 *
 * Input: (0, 56)    Output: 0
 * Input: (20, 56)   Output: ≈ 9.2
 * Input: (200, 56)  Output: ≈ 37.1  (tends toward one slot, 56, but never reaches it)
 */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}
