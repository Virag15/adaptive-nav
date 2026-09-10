import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { FADE_OUT, SECTION_IN, SECTION_OUT } from './springs';

/**
 * A glass body that lives just outside one end of the pill: a circle, or at
 * regular width the trailing section that holds several items. It starts
 * tucked underneath the glass and slides out, so it reads as coming out of
 * the bar rather than appearing beside it; leaving, it slides back under. It
 * comes out a little squashed along the pull, the way a drop leaves a body,
 * and rounds up as it settles.
 *
 * The glass is built in layers around the content (see the stylesheet): the
 * lens, the frost, the content carrying the tint, the edge light, the shine,
 * and the badge above them all so the lens never bends it.
 */
export function Satellite({
  side,
  tuck,
  reduce,
  lens,
  group = false,
  className,
  tag,
  slot,
  delay = 0,
  badge,
  children,
}: {
  side: 'leading' | 'trailing';
  /** How far under the pill the body starts: its own width plus the gap. */
  tuck: number;
  reduce: boolean;
  /** Render the refraction layer under the body. */
  lens: boolean;
  /** A section as wide as its items, rather than a circle. */
  group?: boolean;
  className?: string;
  /** What the body belongs to, so a measurement can tell a section on its way out from one that is staying. */
  tag?: string;
  /** A stable name for this body, so the bar can slide it when a sibling opens a gap beside it. */
  slot?: string;
  /** Held back this long, so a row of sections arrives as one movement rather than at once. */
  delay?: number;
  badge?: ReactNode;
  children: ReactNode;
}) {
  const out = 'translateX(0px) scaleX(1) scaleY(1)';
  const tucked = reduce
    ? out
    : `translateX(${side === 'leading' ? tuck : -tuck}px) scaleX(0.95) scaleY(0.8)`;
  return (
    <motion.div
      className={`anav__satellite anav__satellite--${side}${group ? ' anav__satellite--group' : ''}${className ? ` ${className}` : ''}`}
      data-for={tag}
      data-slot={slot}
      initial={{ opacity: 0, transform: tucked }}
      animate={{
        opacity: 1,
        transform: out,
        transition: reduce ? { duration: 0 } : { ...SECTION_IN, delay },
      }}
      exit={{
        opacity: 0,
        transform: tucked,
        transition: reduce ? { duration: 0 } : { transform: SECTION_OUT, opacity: FADE_OUT },
      }}
    >
      {/* Siblings of the content, not children: a backdrop filter only sees what
          is painted outside its own element's group, so the lens and the frost
          have to sit beside the tinted content rather than inside it. */}
      {lens && <span className="anav__refract anav__refract--circle" aria-hidden />}
      <span className="anav__frost anav__frost--circle" aria-hidden />
      {children}
      <span className="anav__edge anav__edge--circle" aria-hidden />
      <span className="anav__shine anav__shine--circle" aria-hidden />
      {badge}
    </motion.div>
  );
}
