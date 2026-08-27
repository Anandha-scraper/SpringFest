import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import Hero from "../components/sections/Hero.jsx";
import Stats from "../components/sections/Stats.jsx";
import About from "../components/sections/About.jsx";
import EventsPreview from "../components/sections/EventsPreview.jsx";
import Schedule from "../components/sections/Schedule.jsx";
import Sponsors from "../components/sections/Sponsors.jsx";
import FAQ from "../components/sections/FAQ.jsx";
import CTA from "../components/sections/CTA.jsx";

export default function Landing() {
  const { hash } = useLocation();

  // Support /#schedule style links arriving from another route
  useEffect(() => {
    if (!hash) return;
    const el = document.querySelector(hash);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  }, [hash]);

  return (
    <>
      <Hero />
      <Stats />
      <About />
      <EventsPreview />
      <Schedule />
      <Sponsors />
      <FAQ />
      <CTA />
    </>
  );
}
