import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext.jsx";
import GoogleIcon from "../GoogleIcon.jsx";

/**
 * Sign-in / account control that lives INSIDE the PillNav bar.
 *   variant="bar"  → desktop: a pill button (Sign in) or avatar + dropdown
 *   variant="menu" → mobile popover: full-width button / stacked links
 */
export default function AccountControl({ variant = "bar" }) {
  const { user, isAdmin, loginWithGoogle, logout, isFirebaseConfigured } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  const { pathname, hash } = useLocation();

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => setMenuOpen(false), [pathname, hash]);

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

  // ── Mobile popover ──────────────────────────────────────────
  if (variant === "menu") {
    if (!user) {
      return (
        <button
          className="account-pill account-pill--block"
          onClick={handleLogin}
          disabled={!isFirebaseConfigured}
        >
          <GoogleIcon size={16} />
          Sign in with Google
        </button>
      );
    }
    return (
      <>
        <Link to="/my-registrations" className="mobile-menu-link">My Registrations</Link>
        {isAdmin && (
          <Link to="/admin" className="mobile-menu-link">Admin Dashboard</Link>
        )}
        <button className="mobile-menu-link" onClick={handleLogout}>Log out</button>
      </>
    );
  }

  // ── Desktop, inside the pill bar ────────────────────────────
  if (!user) {
    return (
      <button
        className="account-pill"
        onClick={handleLogin}
        disabled={!isFirebaseConfigured}
        title={isFirebaseConfigured ? undefined : "Sign-in is disabled until Firebase is configured"}
      >
        <GoogleIcon size={15} />
        <span className="account-pill-label">Sign in</span>
      </button>
    );
  }

  return (
    <div className="nav-user" ref={ref}>
      <button
        className="account-pill account-pill--user"
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
        <span className="account-pill-label nav-username">
          {user.displayName?.split(" ")[0] || "Account"}
        </span>
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
  );
}
