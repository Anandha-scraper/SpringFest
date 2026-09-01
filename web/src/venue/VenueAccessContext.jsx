"use client";

import { createContext, useCallback, useContext, useState } from "react";

/**
 * Holds the resolved venue view in memory only — never in a URL, never in
 * `sessionStorage`/`localStorage`. The code is a credential; a URL ends up in
 * server logs, browser history and a shared screen's address bar, and any of
 * those outlives the moment someone meant it to be visible.
 *
 * The consequence: reloading `/venue`, or opening it in a second tab, has
 * nothing to read and bounces back to `/` — see `web/app/venue/page.jsx`.
 * That is the intended trade for keeping the code off every persistence
 * layer the browser has, not an oversight.
 */
const VenueAccessContext = createContext({ view: null, setView: () => {}, clear: () => {} });

export function VenueAccessProvider({ children }) {
  const [view, setView] = useState(null);
  const clear = useCallback(() => setView(null), []);

  return (
    <VenueAccessContext.Provider value={{ view, setView, clear }}>
      {children}
    </VenueAccessContext.Provider>
  );
}

export const useVenueAccess = () => useContext(VenueAccessContext);
