"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "@/auth/AuthContext.jsx";

/**
 * One EventSource for the whole tab, fanned out to every hook that wants it.
 *
 * Deliberately not one connection per `useApi` call: an admin with the
 * dashboard open holds several hooks at once, and each opening its own stream
 * would multiply against the API's per-instance concurrency for no benefit —
 * they all want the same handful of resource names.
 *
 * EventSource cannot set an Authorization header, which is the whole reason
 * session cookies exist (backend/auth/session.js). The cookie rides along
 * automatically because the browser is talking to its own origin: the request
 * goes to Next, which proxies it to the API. A signed-in user with no cookie —
 * someone who signed in before that shipped, or whose cookie mint failed —
 * simply gets no live updates, and every screen behaves exactly as it did
 * before this existed.
 */
const LiveContext = createContext({ subscribe: () => () => {}, connected: false });

/** Resource names the server sends. A subscriber names the one it cares about;
 * "*" means everything. */
export function LiveUpdatesProvider({ children }) {
  const { user } = useAuth();
  const [connected, setConnected] = useState(false);
  // Subscribers are held in a ref so adding one never re-renders the tree.
  const handlers = useRef(new Set());

  useEffect(() => {
    // Nothing to listen to while signed out, and the endpoint would 401 in a
    // reconnect loop if we tried.
    if (!user) return undefined;
    if (typeof window === "undefined" || !("EventSource" in window)) return undefined;

    const source = new EventSource("/api/stream");

    source.addEventListener("open", () => {
      setConnected(true);
      // Also fired on every *re*connect, which is the normal case: the stream
      // is cut roughly every five minutes (see the error handler below). A
      // wildcard here is what closes the gap — anything that changed while the
      // connection was down is picked up by one refetch per subscriber.
      for (const handler of handlers.current) handler("*");
    });

    source.addEventListener("change", (event) => {
      let resource = "*";
      try {
        resource = JSON.parse(event.data)?.resource || "*";
      } catch {
        // A frame we can't parse still means *something* moved; treat it as a
        // wildcard rather than dropping it.
      }
      for (const handler of handlers.current) handler(resource);
    });

    source.addEventListener("error", () => {
      // Fires on every disconnect, including the routine one: App Hosting has
      // no timeout setting, so this runs under Cloud Run's ~5 minute request
      // cap and the connection is cut regularly by design. EventSource
      // reconnects on its own using the server's `retry:` hint — there is
      // nothing to do here but stop claiming to be connected. The "open"
      // handler above then closes the gap.
      setConnected(false);
    });

    return () => {
      source.close();
      setConnected(false);
    };
  }, [user]);

  // `subscribe` is built once and never changes identity. It reads the handler
  // set through a ref, so it does not depend on `connected` — if it did, every
  // connect and disconnect would change the context value and make every
  // subscriber tear down and re-register its effect for nothing.
  const subscribe = useCallback((handler) => {
    handlers.current.add(handler);
    return () => handlers.current.delete(handler);
  }, []);

  const value = useMemo(() => ({ connected, subscribe }), [connected, subscribe]);

  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

export const useLiveUpdates = () => useContext(LiveContext);

/** Run `onChange` when the named resource changes (or on any change, for "*").
 *
 * Debounced, because a burst — a volunteer checking in six teammates in a row —
 * would otherwise fire six refetches for one visible outcome. */
export function useLiveResource(resource, onChange, { debounceMs = 300 } = {}) {
  const { subscribe } = useLiveUpdates();
  // Kept in a ref so a caller passing an inline arrow doesn't resubscribe on
  // every render.
  const latest = useRef(onChange);
  latest.current = onChange;

  useEffect(() => {
    if (!resource) return undefined;
    let timer = null;
    const unsubscribe = subscribe((changed) => {
      if (changed !== resource && changed !== "*" && resource !== "*") return;
      clearTimeout(timer);
      timer = setTimeout(() => latest.current?.(), debounceMs);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [resource, subscribe, debounceMs]);
}
