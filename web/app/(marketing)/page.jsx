"use client";

import Landing from "@/views/Landing.jsx";

/**
 * The landing page is the one route that would genuinely benefit from being
 * server-rendered — it is public marketing copy. It stays a client component
 * anyway, because everything it renders is: the GSAP navbar animations, the
 * rAF-driven logo loop and split-flap headings, and the sign-in modal all need
 * the browser. (There used to be a WebGL backdrop here too; it was invisible
 * under the hero veil and has been removed.) What it does gain
 * from Next is being served as pre-rendered HTML shell + a route-level chunk,
 * which is what the Vite build's React.lazy was hand-rolling.
 */
export default function Page() {
  return <Landing />;
}
