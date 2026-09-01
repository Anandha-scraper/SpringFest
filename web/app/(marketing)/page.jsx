"use client";

import Landing from "@/views/Landing.jsx";

/**
 * The landing page is the one route that would genuinely benefit from being
 * server-rendered — it is public marketing copy. It stays a client component
 * anyway, because everything it renders is: the GSAP/ogl hero animations, the
 * WebGL backdrop and the sign-in modal all need the browser. What it does gain
 * from Next is being served as pre-rendered HTML shell + a route-level chunk,
 * which is what the Vite build's React.lazy was hand-rolling.
 */
export default function Page() {
  return <Landing />;
}
