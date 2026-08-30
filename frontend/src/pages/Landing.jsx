import { useEffect } from "react";
import "@/styles/pages/landing.css";
import { useLocation } from "react-router-dom";
import Hero from "@/components/sections/Hero.jsx";
import EventsPreview from "@/components/sections/EventsPreview.jsx";
import Schedule from "@/components/sections/Schedule.jsx";

export default function Landing() {
  const { hash, key } = useLocation();

  // Scroll to /#schedule style targets. Keyed on `key` as well as `hash` so
  // clicking the same nav link twice scrolls again (the hash alone wouldn't
  // change, so the effect would never re-run). rAF lets the section mount
  // first when arriving from another route.
  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const id = hash.slice(1);
    const raf = requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    });
    return () => cancelAnimationFrame(raf);
  }, [hash, key]);

  return (
    <>
      <Hero />
      <EventsPreview />
      <Schedule />
    </>
  );
}
