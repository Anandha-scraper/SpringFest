import { useEffect, useRef, useState } from "react";

/** The minimum time the loader stays on screen once it appears — long enough to
 *  read as a deliberate state rather than a flash, and consistent everywhere. */
export const MIN_LOADER_MS = 2000;

/**
 * Returns `true` while `active` is true, and keeps returning `true` for at least
 * `ms` after `active` first flipped true. So a request that resolves in 100ms
 * still shows its loader for the full `ms`; one that takes longer shows it until
 * it actually finishes.
 *
 * Used for data fetches (`useApi`) and any hand-rolled `!data` loading check.
 */
export function useHeldLoading(active, ms = MIN_LOADER_MS) {
  const [held, setHeld] = useState(active);
  const startedAt = useRef(active ? Date.now() : 0);

  useEffect(() => {
    if (active) {
      if (!held) {
        startedAt.current = Date.now();
        setHeld(true);
      }
      return undefined;
    }
    // active just went false — release once `ms` has elapsed since it went true.
    const elapsed = Date.now() - startedAt.current;
    if (elapsed >= ms) {
      setHeld(false);
      return undefined;
    }
    const t = setTimeout(() => setHeld(false), ms - elapsed);
    return () => clearTimeout(t);
  }, [active, held, ms]);

  return held;
}
