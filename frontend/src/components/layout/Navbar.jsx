import { useLocation } from "react-router-dom";
import PillNav from "../reactbits/PillNav.jsx";
import AccountControl from "./AccountControl.jsx";
import { navLinks } from "../../content/fest.js";

// Files in public/ are served from the site root — reference by URL, never import.
const LOGO_URL = "/logo.png";

export default function Navbar() {
  const { pathname, hash } = useLocation();
  const activeHref = pathname === "/" ? (hash ? `/${hash}` : "/") : pathname;

  return (
    <PillNav
      logo={LOGO_URL}
      logoAlt="Spring Fest"
      items={navLinks}
      activeHref={activeHref}
      className="site-pillnav"
      baseColor="#2b2440"
      pillColor="#fffaf5"
      hoveredPillTextColor="#fffaf5"
      pillTextColor="#2b2440"
      ease="power3.easeOut"
      initialLoadAnimation={false}
      trailing={<AccountControl variant="bar" />}
      mobileTrailing={<AccountControl variant="menu" />}
    />
  );
}
