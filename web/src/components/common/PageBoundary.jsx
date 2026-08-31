"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import Loader from "@/components/common/Loader.jsx";
import { MIN_LOADER_MS } from "@/hooks/useHeldLoading.js";

/**
 * Wraps the routed page so every navigation shows the loader for at
 * least MIN_LOADER_MS, centered in the content area, with the surrounding shell
 * (navbar / dashboard sidebar) left in place.
 *
 * The page mounts only once the gate opens — a route chunk that's still loading
 * then keeps the *same* `<Loader />` on screen through Suspense, so there's no
 * flicker between the two. Mounting the page hidden during the gate was
 * rejected: it breaks the camera in the volunteer check-in screen and any
 * layout measurement, and the chunks are a kilobyte or two.
 */
export default function PageBoundary({ children }) {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    const t = setTimeout(() => setReady(true), MIN_LOADER_MS);
    return () => clearTimeout(t);
  }, [pathname]);

  return <Suspense fallback={<Loader />}>{ready ? children : <Loader />}</Suspense>;
}
