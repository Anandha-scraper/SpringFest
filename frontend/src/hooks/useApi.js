import { useCallback, useEffect, useState } from "react";

import { useHeldLoading } from "@/hooks/useHeldLoading.js";

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
  // Every appearance of the loader is held for a minimum time so it never just
  // flashes — on the first load and on every reload() after a write.
  const loading = useHeldLoading(rawLoading);

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
