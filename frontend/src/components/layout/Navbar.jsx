import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import PillNav from "../reactbits/PillNav.jsx";
import StaggeredMenu from "../reactbits/StaggeredMenu.jsx";
import AccountControl from "./AccountControl.jsx";
import { navLinks, fest } from "../../content/fest.js";

// StaggeredMenu takes { label, ariaLabel, link }; navLinks are { label, href }.
const staggeredItems = navLinks.map((l) => ({
  label: l.label,
  ariaLabel: l.label,
  link: l.href,
}));

const staggeredSocials = [
  { label: "Instagram", link: fest.social.instagram },
  { label: "LinkedIn", link: fest.social.linkedin },
  { label: "X", link: fest.social.twitter },
];

const SECTION_IDS = ["events", "schedule", "faq"];

export default function Navbar() {
  const { pathname } = useLocation();
  const [activeSection, setActiveSection] = useState("");

  // Highlight the pill for whichever section is actually on screen, rather
  // than whatever hash happens to be in the URL.
  useEffect(() => {
    if (pathname !== "/") {
      setActiveSection("");
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const onScreen = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (onScreen) setActiveSection(`#${onScreen.target.id}`);
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: [0, 0.2, 0.5, 1] }
    );

    SECTION_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    // Near the top nothing is "current" — Home is.
    const onScroll = () => {
      if (window.scrollY < 240) setActiveSection("");
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, [pathname]);

  const activeHref =
    pathname === "/" ? (activeSection ? `/${activeSection}` : "/") : pathname;

  return (
    <>
      {/* Desktop: pill bar */}
      <div className="nav-desktop">
        <PillNav
          items={navLinks}
          activeHref={activeHref}
          className="site-pillnav"
          baseColor="#11224e"
          pillColor="#eeeeee"
          hoveredPillTextColor="#eeeeee"
          pillTextColor="#11224e"
          ease="power3.easeOut"
          initialLoadAnimation={false}
          trailing={<AccountControl />}
        />
      </div>

      {/* Mobile: staggered slide-in panel */}
      <div className="nav-mobile">
        <StaggeredMenu
          position="right"
          items={staggeredItems}
          socialItems={staggeredSocials}
          displaySocials
          displayItemNumbering
          isFixed
          logoUrl="/logo.png"
          menuButtonColor="#11224e"
          openMenuButtonColor="#11224e"
          accentColor="#f87b1b"
          colors={["#cbd99b", "#11224e"]}
          trailing={<AccountControl />}
        />
      </div>
    </>
  );
}
