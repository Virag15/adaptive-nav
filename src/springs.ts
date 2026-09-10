// Damping ratio ~0.8, response ~0.35s: settles rather than snaps, and stays
// grabbable if you tap again mid-flight.
export const SELECTION_SPRING = { type: 'spring', stiffness: 322, damping: 29, mass: 1 } as const;
// Landing after a scrub or a flick: the finger had momentum, so a hair more
// life (ratio ~0.72) reads as the capsule carrying it home.
export const RELEASE_SPRING = { type: 'spring', stiffness: 380, damping: 28, mass: 1 } as const;
// While the finger is down the capsule tracks it: response ~0.1s, so it feels
// attached, with just enough lag to read as weight rather than a cursor.
export const FOLLOW_SPRING = { type: 'spring', stiffness: 1600, damping: 80, mass: 1 } as const;
export const REDUCED_SPRING = { type: 'spring', stiffness: 2200, damping: 120, mass: 1 } as const;
export const PRESS_SPRING = { stiffness: 700, damping: 32, mass: 0.6 } as const;
// Smooths the velocity read before it becomes a stretch, so a jittery finger
// does not make the capsule shiver.
export const STRETCH_SPRING = { stiffness: 900, damping: 60, mass: 1 } as const;
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
 * happened to be over. 0.99 is the snappier of the two rates iOS uses.
 *
 * Input: (600)   Output: ≈ 59.4  (px, at the default rate)
 * Input: (-300)  Output: ≈ -29.7
 */
export function project(velocity: number, decelerationRate = 0.99): number {
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
