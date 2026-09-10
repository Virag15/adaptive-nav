import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { EMERGE_SPRING, FADE_IN, FADE_OUT, RETREAT_SPRING } from './springs';

/**
 * A circle that lives just outside one end of the pill. It starts tucked
 * underneath the glass and slides out, so it reads as coming out of the bar
 * rather than appearing beside it; leaving, it slides back under. It comes out
 * a little squashed along the pull, the way a drop leaves a body, and rounds
 * up as it settles.
 *
 * The glass is built in layers around the button (see the stylesheet): the
 * lens, the frost, the button itself carrying the tint, the shine, and the
 * badge above them all so the lens never bends it.
 */
export function Satellite({
  side,
  tuck,
  reduce,
  lens,
  badge,
  children,
}: {
  side: 'leading' | 'trailing';
  /** How far under the pill the circle starts: its own width plus the gap. */
  tuck: number;
  reduce: boolean;
  /** Render the refraction layer under the circle. */
  lens: boolean;
  badge?: ReactNode;
  children: ReactNode;
}) {
  const out = 'translateX(0px) scaleX(1) scaleY(1)';
  const tucked = reduce
    ? out
    : `translateX(${side === 'leading' ? tuck : -tuck}px) scaleX(0.95) scaleY(0.8)`;
  return (
    <motion.div
      className={`anav__satellite anav__satellite--${side}`}
      initial={{ opacity: 0, transform: tucked }}
      animate={{
        opacity: 1,
        transform: out,
        transition: { transform: reduce ? { duration: 0 } : EMERGE_SPRING, opacity: FADE_IN },
      }}
      exit={{
        opacity: 0,
        transform: tucked,
        transition: { transform: reduce ? { duration: 0 } : RETREAT_SPRING, opacity: FADE_OUT },
      }}
    >
      {/* Siblings of the button, not children: a backdrop filter only sees what
          is painted outside its own element's group, so the lens and the frost
          have to sit beside the tinted button rather than inside it. */}
      {lens && <span className="anav__refract anav__refract--circle" aria-hidden />}
      <span className="anav__frost anav__frost--circle" aria-hidden />
      {children}
      <span className="anav__shine anav__shine--circle" aria-hidden />
      {badge}
    </motion.div>
  );
}
