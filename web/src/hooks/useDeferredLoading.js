"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Show a loader only when there is genuinely something to wait for.
 *
 * This replaces `useHeldLoading`, which took the opposite approach: it forced
 * every loader to stay on screen for a flat 2000ms so it never "just flashed".
 * That made every fast page feel like a slow one — a 200ms fetch showed two
 * seconds of spinner, and a save stalled for two seconds before the list
 * updated. The flicker it was avoiding is real, but the cure was worse.
 *
 * The standard fix is a pair of thresholds rather than a single floor:
 *
 *   delayMs      — don't show the loader AT ALL until loading has lasted this
 *                  long. Anything that resolves quickly now renders no spinner
 *                  whatsoever, which is what "fast" is supposed to look like.
 *   minVisibleMs — once it HAS appeared, keep it for at least this long, so a
 *                  request that finishes just past the delay can't strobe.
 *
 * So: fast → nothing; slow → a loader that appears once and sits still.
 */
export const LOADER_DELAY_MS = 150;
export const LOADER_MIN_VISIBLE_MS = 300;

export function useDeferredLoading(
  active,
  { delayMs = LOADER_DELAY_MS, minVisibleMs = LOADER_MIN_VISIBLE_MS } = {}
) {
  const [visible, setVisible] = useState(false);
  // When the loader actually appeared — 0 while it is hidden. A ref, not state:
  // it is read inside the effect that would otherwise re-run because of it.
  const shownAt = useRef(0);

  useEffect(() => {
    if (active) {
      if (visible) return undefined;
      const t = setTimeout(() => {
        shownAt.current = Date.now();
        setVisible(true);
      }, delayMs);
      // Cleared if `active` goes false first — the whole point: a quick load
      // never gets as far as showing anything.
      return () => clearTimeout(t);
    }

    if (!visible) return undefined;
    const elapsed = Date.now() - shownAt.current;
    if (elapsed >= minVisibleMs) {
      setVisible(false);
      return undefined;
    }
    const t = setTimeout(() => setVisible(false), minVisibleMs - elapsed);
    return () => clearTimeout(t);
  }, [active, visible, delayMs, minVisibleMs]);

  return visible;
}
