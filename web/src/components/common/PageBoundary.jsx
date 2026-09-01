"use client";

import { Suspense } from "react";

import Loader from "@/components/common/Loader.jsx";

/**
 * Suspense boundary for the routed page, so a segment that is still loading
 * shows the loader centred in the content area with the surrounding shell
 * (navbar / dashboard sidebar) left in place.
 *
 * This used to also hold every navigation behind `setTimeout(MIN_LOADER_MS)` —
 * an unconditional two-second wait on *every* route change, whether or not
 * anything was actually loading. Clicking a sidebar link cost two seconds
 * before the page was even allowed to mount, and then the page's own fetch
 * spent another two behind the old `useHeldLoading` floor. Both are gone: the
 * only thing that should hold a page back is the page not being ready yet,
 * which is exactly what Suspense already reports.
 */
export default function PageBoundary({ children }) {
  return <Suspense fallback={<Loader />}>{children}</Suspense>;
}
