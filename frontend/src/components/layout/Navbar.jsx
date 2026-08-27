import { useLocation } from "react-router-dom";
import PillNav from "../reactbits/PillNav.jsx";
import BubbleMenu from "../reactbits/BubbleMenu.jsx";
import AccountControl from "./AccountControl.jsx";
import { navLinks, bubbleNavItems, fest } from "../../content/fest.js";

export default function Navbar() {
  const { pathname, hash } = useLocation();
  const activeHref = pathname === "/" ? (hash ? `/${hash}` : "/") : pathname;

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

      {/* Mobile: bubble menu */}
      <div className="nav-mobile">
        <BubbleMenu
          logo={<span className="bubble-wordmark">{fest.institution.shortName}</span>}
          items={bubbleNavItems}
          menuAriaLabel="Toggle navigation"
          menuBg="#ffffff"
          menuContentColor="#11224e"
          useFixedPosition
          animationEase="back.out(1.5)"
          animationDuration={0.5}
          staggerDelay={0.1}
        />
      </div>
    </>
  );
}
