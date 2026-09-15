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

/**
 * A spring's path from rest to rest as a CSS `linear()` easing, and how long it
 * takes to come within 0.1% of the end. The bar moves on Motion's springs; a
 * page that has to move with it can hand the same curve to the Web Animations
 * API, which runs it on the compositor, where a busy main thread cannot stall
 * it. Two clocks on one curve start and land together; two curves never do.
 *
 * Input: (SHAPE_SPRING)
 * Output: { duration: 351, easing: 'linear(0, 0.0231, 0.0796, 0.1545, …, 1)' }
 */
export function springCurve(spring: { stiffness: number; damping: number; mass: number }, stops = 40) {
  const w0 = Math.sqrt(spring.stiffness / spring.mass);
  const zeta = spring.damping / (2 * Math.sqrt(spring.stiffness * spring.mass));
  // Zero initial velocity, from 0 to 1: the three closed forms of a damped oscillator.
  const at = (t: number): number => {
    if (Math.abs(zeta - 1) < 1e-6) return 1 - (1 + w0 * t) * Math.exp(-w0 * t);
    if (zeta < 1) {
      const wd = w0 * Math.sqrt(1 - zeta * zeta);
      return 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t));
    }
    const s = Math.sqrt(zeta * zeta - 1);
    const r1 = -w0 * (zeta - s);
    const r2 = -w0 * (zeta + s);
    return 1 - (r2 * Math.exp(r1 * t) - r1 * Math.exp(r2 * t)) / (r2 - r1);
  };
  // Walk back from two seconds to the last moment it was still visibly short of rest.
  let settle = 0;
  for (let t = 2; t > 0; t -= 0.001) {
    if (Math.abs(1 - at(t)) > 0.001) {
      settle = t + 0.001;
      break;
    }
  }
  const points = Array.from({ length: stops + 1 }, (_, i) => (i === stops ? 1 : Number(at((settle * i) / stops).toFixed(4))));
  return { duration: Math.round(settle * 1000), easing: `linear(${points.join(', ')})` };
}

/**
 * A change of screen: the pill's new shape, the capsule's new section and the
 * page arriving under them. One spring for all three, so what the eye reads as
 * one movement is one — the page used to take 420ms on its own tween while the
 * capsule took ~430ms on a softer spring and the pill ~280ms, three landings.
 */
export const ROUTE_SPRING = SHAPE_SPRING;
export const ROUTE_CURVE = springCurve(ROUTE_SPRING);
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
