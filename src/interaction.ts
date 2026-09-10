import { project, rubberband } from './springs.ts';

export type PointerSample = { x: number; t: number };
export const TRAIL_MS = 80;

/** Velocity at release, including the time the finger spent resting. */
export function trailVelocity(trail: PointerSample[], now: number): number {
  const recent = trail.filter((sample) => now - sample.t <= TRAIL_MS);
  if (recent.length < 2) return 0;
  const first = recent[0];
  const last = recent[recent.length - 1];
  const elapsed = now - first.t;
  return elapsed > 0 ? ((last.x - first.x) / elapsed) * 1000 : 0;
}

/** Direct pointer travel, with progressive resistance beyond the end slots. */
export function scrubPosition(held: number, pitch: number, count: number): number {
  if (pitch <= 0 || count <= 1) return 0;
  const max = (count - 1) * pitch;
  if (held < 0) return rubberband(held, pitch);
  if (held > max) return max + rubberband(held - max, pitch);
  return held;
}

/** Cancellation always restores the controlled selection, even within its own cell. */
export function releaseTarget({ held, velocity, pitch, count, selected, cancelled }: {
  held: number;
  velocity: number;
  pitch: number;
  count: number;
  selected: number;
  cancelled: boolean;
}): number {
  if (cancelled || pitch <= 0 || count <= 1) return selected;
  return Math.min(count - 1, Math.max(0, Math.round((held + project(velocity)) / pitch)));
}

/**
 * Where an arrow, Home or End key moves the selection, wrapping at both ends.
 * `current` is -1 when no section is the current one — a pushed screen — and
 * from there Right lands on the first section and Left on the last, rather
 * than one short of it. Returns -1 for a key that means nothing here.
 *
 * Input: (-1, 'ArrowLeft', 4)   Output: 3
 * Input: (0, 'ArrowLeft', 4)    Output: 3
 * Input: (3, 'ArrowRight', 4)   Output: 0
 */
export function nextIndex(current: number, key: string, count: number): number {
  if (count < 1) return -1;
  const from = current < 0 ? (key === 'ArrowRight' ? -1 : count) : current;
  if (key === 'ArrowRight') return (from + 1) % count;
  if (key === 'ArrowLeft') return (from - 1 + count) % count;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return -1;
}
