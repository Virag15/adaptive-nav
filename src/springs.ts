// Apple-style response ~0.3s, damping ratio 1: ordinary selection and
// geometry changes settle without overshoot while remaining interruptible.
export const SELECTION_SPRING = { type: 'spring', stiffness: 440, damping: 42, mass: 1 } as const;
// Only a released gesture carries momentum; ratio ~0.8 keeps its handoff soft.
export const RELEASE_SPRING = { type: 'spring', stiffness: 440, damping: 34, mass: 1 } as const;
// A restrained press and velocity deformation, both critically damped.
export const PRESS_SPRING = { stiffness: 600, damping: 38, mass: 0.6 } as const;
export const STRETCH_SPRING = { stiffness: 700, damping: 53, mass: 1 } as const;
/**
 * The pill changing shape: its width between modes, and the tabs riding along.
 * Stiffer than a selection because it is not following a finger and nothing
 * hands it velocity — it is a state change, and its tail was the last thing
 * still moving half a second after the rest of the band had settled. Damping
 * ratio is still 1, so it gains speed without gaining a wobble.
 */
export const SHAPE_SPRING = { type: 'spring', stiffness: 700, damping: 53, mass: 1 } as const;
// Satellites share the same calm settle instead of adding another bounce.
export const EMERGE_SPRING = { type: 'spring', stiffness: 400, damping: 40, mass: 1 } as const;
export const RETREAT_SPRING = { type: 'spring', stiffness: 600, damping: 49, mass: 1 } as const;
export const EASE_OUT = [0.23, 1, 0.32, 1] as const;
/** The same curve for the Web Animations API, which takes CSS rather than points. */
export const EASE_OUT_CSS = 'cubic-bezier(0.23, 1, 0.32, 1)';
/**
 * A section arriving at or leaving an edge of the band. A spring's tail is
 * invisible on one body and reads as drift across seven, and none of this is
 * gesture-driven, so these are short tweens on a strong ease-out instead. The
 * exit is quicker than the entrance: a section that is leaving should be out
 * of the way before the rest of the move finishes, or its removal reflows the
 * row after the eye has decided the move is over.
 */
export const SECTION_IN = { duration: 0.18, ease: EASE_OUT } as const;
export const SECTION_OUT = { duration: 0.12, ease: EASE_OUT } as const;
/** How long a section takes to slide to a place a sibling's arrival opened up. */
export const SECTION_SLIDE_MS = 180;
/** At most this much delay between entering sections, so they read as one movement. */
export const SECTION_STAGGER = 0.03;
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
