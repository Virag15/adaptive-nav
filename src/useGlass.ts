import { useMemo, useSyncExternalStore } from 'react';
import { DEFAULT_GLASS, glassVars, resolveGlass, type GlassConfig, type GlassInput } from './glass';

/**
 * One material for every bar on the page. The tokens go on `:root`, so CSS
 * that reads `--anav-*` follows along; the store exists because the refraction
 * filter's strength is an SVG attribute, which no CSS token can drive, so the
 * component has to be told the number as well.
 */
let current: GlassConfig = DEFAULT_GLASS;
const listeners = new Set<() => void>();

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
const getSnapshot = () => current;
const getServerSnapshot = () => DEFAULT_GLASS;

/** Set the global material: a preset name, or a patch on top of what is there. */
export function setGlobalGlass(input: GlassInput): GlassConfig {
  current = resolveGlass(input, current);
  if (typeof document !== 'undefined') {
    const style = document.documentElement.style;
    for (const [token, value] of Object.entries(glassVars(current))) style.setProperty(token, value);
  }
  listeners.forEach((fn) => fn());
  return current;
}

export function getGlobalGlass(): GlassConfig {
  return current;
}

/** The material one bar renders with: its own `glass` prop laid over the global one. */
export function useGlass(local?: GlassInput): GlassConfig {
  const global = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return useMemo(() => resolveGlass(local, global), [global, local]);
}
