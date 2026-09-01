"use client";

import { useEffect } from "react";
import "@/styles/pages/landing.css";
import Hero from "@/components/sections/Hero.jsx";
import EventsPreview from "@/components/sections/EventsPreview.jsx";
import Schedule from "@/components/sections/Schedule.jsx";

export default function Landing() {
  // Scroll to /#schedule style targets.
  //
  // react-router exposed the hash (and a per-navigation `key`, so clicking the
  // same link twice scrolled again) through useLocation. next/navigation has
  // no hash at all — it's not part of a server-navigable URL — so this reads
  // window.location.hash directly and listens for hashchange, which also
  // covers the click-the-same-link-twice case the `key` was there for.
  useEffect(() => {
    const scrollToHash = () => {
      const hash = window.location.hash;
      if (!hash) {
        window.scrollTo({ top: 0, behavior: "smooth" });
        return undefined;
      }
      const id = hash.slice(1);
      // rAF lets the section mount first when arriving from another route.
      const raf = requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
      });
      return () => cancelAnimationFrame(raf);
    };

    let cancel = scrollToHash();
    const onHashChange = () => {
      cancel?.();
      cancel = scrollToHash();
    };
    window.addEventListener("hashchange", onHashChange);
    return () => {
      cancel?.();
      window.removeEventListener("hashchange", onHashChange);
    };
  }, []);

  return (
    <>
      <Hero />
      <EventsPreview />
      <Schedule />
    </>
  );
}
