import { useEffect, useState } from 'react';
import { isChromium, isLowEnd, type Environment } from './quality';

/** What the server assumes, and what the first client render must match. */
const UNKNOWN: Environment = { chromium: false, lowEnd: false, reducedTransparency: false, touch: true };

function detect(): Environment {
  const nav = navigator as Navigator & { deviceMemory?: number; userAgentData?: { brands?: { brand: string }[] } };
  return {
    chromium: isChromium(nav),
    lowEnd: isLowEnd(nav),
    reducedTransparency: window.matchMedia?.('(prefers-reduced-transparency: reduce)').matches ?? false,
    // A trackpad beside a touch screen still reads as touch; only a pointer alone does not.
    touch: window.matchMedia?.('(any-pointer: coarse)').matches ?? true,
  };
}

/**
 * The device, read after mount so the first render matches the server's and
 * hydration has nothing to argue about; the lens arrives one render later.
 */
export function useEnvironment(): Environment {
  const [env, setEnv] = useState(UNKNOWN);
  useEffect(() => {
    setEnv(detect());
  }, []);
  return env;
}
