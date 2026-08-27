import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import PillNav from "../reactbits/PillNav.jsx";
import GoogleIcon from "../GoogleIcon.jsx";
import { useAuth } from "../../auth/AuthContext.jsx";
import { navLinks } from "../../content/fest.js";

// Files in public/ are served from the site root — reference by URL, never import.
const LOGO_URL = "/logo.png";

export default function Navbar() {
  const { user, isAdmin, loginWithGoogle, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();
  const { pathname, hash } = useLocation();

  useEffect(() => {
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => setMenuOpen(false), [pathname, hash]);

  const activeHref = pathname === "/" ? (hash ? `/${hash}` : "/") : pathname;

  const handleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch {
      navigate("/login");
    }
  };

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    navigate("/");
  };

  return (
    <>
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
      />

      <div className="nav-account">
        {user ? (
          <div className="nav-user" ref={menuRef}>
            <button
              className="nav-avatar-btn"
              onClick={() => setMenuOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              {user.photoURL ? (
                <img src={user.photoURL} alt="" className="nav-avatar" referrerPolicy="no-referrer" />
              ) : (
                <span className="nav-avatar nav-avatar-fallback">
                  {(user.displayName || user.email || "?")[0].toUpperCase()}
                </span>
              )}
              <span className="nav-username">{user.displayName?.split(" ")[0] || "Account"}</span>
              <span className="nav-caret" aria-hidden="true">▾</span>
            </button>

            {menuOpen && (
              <div className="nav-menu" role="menu">
                <div className="nav-menu-head">
                  <strong>{user.displayName || "Signed in"}</strong>
                  <span>{user.email}</span>
                </div>
                <Link to="/my-registrations" role="menuitem">My Registrations</Link>
                {isAdmin && (
                  <Link to="/admin" role="menuitem" className="nav-menu-admin">
                    Admin Dashboard
                  </Link>
                )}
                <button onClick={handleLogout} role="menuitem">Log out</button>
              </div>
            )}
          </div>
        ) : (
          <button className="btn btn-sm nav-signin" onClick={handleLogin}>
            <GoogleIcon size={16} />
            <span className="nav-signin-label">Sign in</span>
          </button>
        )}
      </div>
    </>
  );
}
