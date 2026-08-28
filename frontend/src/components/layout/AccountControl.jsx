import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext.jsx";
import { ROLE_TITLE, homeForRole } from "../../content/roles.js";

/**
 * Account control inside the PillNav bar.
 *
 * Renders NOTHING when signed out — the hero's Register button is the sign-in
 * entry point. When signed in it shows the avatar + dropdown so users can still
 * reach My Registrations / Admin / Log out.
 */
export default function AccountControl() {
  const { user, role, logout } = useAuth();
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

  if (!user) return null;

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    navigate("/");
  };

  return (
    <div className="nav-user" ref={ref}>
      <button
        className="nav-user-pill"
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
          {role && (
            <Link to={homeForRole(role)} role="menuitem" className="nav-menu-admin">
              {ROLE_TITLE[role]} Dashboard
            </Link>
          )}
          <button onClick={handleLogout} role="menuitem">Log out</button>
        </div>
      )}
    </div>
  );
}
