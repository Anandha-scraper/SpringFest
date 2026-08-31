"use client";

import { useCallback, useEffect, useState } from "react";

import { useDeferredLoading } from "@/hooks/useDeferredLoading.js";

/**
 * Run an API call on mount and expose { data, error, loading, reload }.
 *
 * Every admin page needs the same three states and a way to refetch after a
 * write, so they share one implementation rather than six near-identical
 * useEffects. Pass a stable `fetcher` (module-scope function or useCallback);
 * it is the dependency that re-triggers the call.
 */
export function useApi(fetcher, { immediate = true } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [rawLoading, setLoading] = useState(immediate);
  const deferred = useDeferredLoading(rawLoading);

  // Two different situations, two different answers.
  //
  // FIRST load — there is no data yet, so the page has nothing to render and
  // callers legitimately write `if (loading) return <Loader/>` and then reach
  // straight into `data`. Deferring here would hand them a null for the first
  // 150ms: at best an empty state flashing before the real one, at worst a
  // crash where a caller destructures the result. So it reports immediately.
  //
  // RELOAD — `data` is already on screen. A spinner over content that is
  // about to be replaced by near-identical content is exactly the flicker
  // worth suppressing, so this one defers and a quick refresh shows nothing.
  const loading = data === null ? rawLoading : deferred;

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetcher();
      setData(result);
      setError("");
      return result;
    } catch (err) {
      setError(err.message || "Something went wrong");
      return null;
    } finally {
      setLoading(false);
    }
  }, [fetcher]);

  useEffect(() => {
    if (immediate) reload();
  }, [immediate, reload]);

  return { data, error, loading, reload, setError };
}
