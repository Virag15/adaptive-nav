import { useEffect, useState } from 'react';
import { REGULAR_MIN, resolvePlacement, type Placement, type PlacementSetting } from './placement';

/**
 * Bottom on a phone, top at regular width, or whatever the host pins. The
 * server and the first client render both say bottom; the media query is
 * read after mount, so hydration has nothing to argue about.
 */
export function usePlacement(setting: PlacementSetting): Placement {
  const [regular, setRegular] = useState(false);
  useEffect(() => {
    const query = window.matchMedia(`(min-width: ${REGULAR_MIN}px)`);
    const sync = () => setRegular(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);
  return resolvePlacement(setting, regular);
}
