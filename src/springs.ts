// Damping ratio ~0.8, response ~0.35s: settles rather than snaps, and stays
// grabbable if you tap again mid-flight.
export const SELECTION_SPRING = { stiffness: 322, damping: 29, mass: 1 } as const;
export const REDUCED_SPRING = { stiffness: 2200, damping: 120, mass: 1 } as const;
export const PRESS_SPRING = { stiffness: 700, damping: 32, mass: 0.6 } as const;
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
