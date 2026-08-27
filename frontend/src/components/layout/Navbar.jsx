import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { fest, navLinks } from "../../content/fest.js";
import { useAuth } from "../../auth/AuthContext.jsx";
import GoogleIcon from "../GoogleIcon.jsx";

export default function Navbar() {
  const { user, isAdmin, loginWithGoogle, logout } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the avatar dropdown on any outside click
  useEffect(() => {
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    setNavOpen(false);
    setMenuOpen(false);
  }, [pathname]);

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
    <header className={`nav ${scrolled ? "nav-scrolled" : ""}`}>
      <div className="nav-inner container">
        <Link to="/" className="nav-brand">
          <span className="nav-mark">🌸</span>
          <span>
            {fest.name} <em>{fest.year}</em>
          </span>
        </Link>

        <nav className={`nav-links ${navOpen ? "open" : ""}`}>
          {navLinks.map((l) => (
            <a key={l.label} href={l.href} onClick={() => setNavOpen(false)}>
              {l.label}
            </a>
          ))}
        </nav>

        <div className="nav-right">
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
              Sign in
            </button>
          )}

          <button
            className="nav-burger"
            onClick={() => setNavOpen((o) => !o)}
            aria-label="Toggle navigation"
          >
            <span /><span /><span />
          </button>
        </div>
      </div>
    </header>
  );
}
