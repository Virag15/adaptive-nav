import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { EMERGE_SPRING, FADE_IN, FADE_OUT, RETREAT_SPRING } from './springs';

/**
 * A circle that lives just outside one end of the pill. It starts tucked
 * underneath the glass and slides out, so it reads as coming out of the bar
 * rather than appearing beside it; leaving, it slides back under.
 */
export function Satellite({
  side,
  tuck,
  reduce,
  lens,
  children,
}: {
  side: 'leading' | 'trailing';
  /** How far under the pill the circle starts: its own width plus the gap. */
  tuck: number;
  reduce: boolean;
  /** Render the refraction layer under the circle. */
  lens: boolean;
  children: ReactNode;
}) {
  const tucked = reduce
    ? 'translateX(0px) scale(1)'
    : `translateX(${side === 'leading' ? tuck : -tuck}px) scale(0.86)`;
  return (
    <motion.div
      className={`anav__satellite anav__satellite--${side}`}
      initial={{ opacity: 0, transform: tucked }}
      animate={{
        opacity: 1,
        transform: 'translateX(0px) scale(1)',
        transition: { transform: reduce ? { duration: 0 } : EMERGE_SPRING, opacity: FADE_IN },
      }}
      exit={{
        opacity: 0,
        transform: tucked,
        transition: { transform: reduce ? { duration: 0 } : RETREAT_SPRING, opacity: FADE_OUT },
      }}
    >
      {/* A sibling of the circle, not a child: a backdrop filter only sees what
          lies outside its own element's filtered group, so the lens has to sit
          beside the frosted button rather than inside it. */}
      {lens && <span className="anav__refract anav__refract--circle" aria-hidden />}
      {children}
    </motion.div>
  );
}
