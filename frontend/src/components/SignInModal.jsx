import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import { homeForRole } from "../content/roles.js";

/**
 * Sign-in card shown when "Register Now" is clicked. Google is the only
 * provider the backend verifies tokens for, so the supplied card's GitHub
 * button, email field and separator are dropped.
 */
export default function SignInModal({ open, onClose, onSignedIn, redirectOnSignIn = true }) {
  const { loginWithGoogle, refreshRole, isFirebaseConfigured, firebaseConfigError } = useAuth();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    // Don't let the page scroll behind the card.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const signIn = async () => {
    setError("");
    setBusy(true);
    try {
      await loginWithGoogle();
      // The role lives on the server, so this is a round-trip. Keep the busy
      // state up across it rather than flashing the page in between.
      const role = await refreshRole();
      onClose();
      onSignedIn?.(role);
      // In-place guards (ProtectedRoute) re-render on the same URL once signed
      // in; the landing-page triggers want to move you to your dashboard.
      if (redirectOnSignIn) navigate(homeForRole(role));
    } catch (err) {
      if (err.code === "auth/popup-closed-by-user") setError("Sign-in was cancelled.");
      else if (err.code === "auth/popup-blocked")
        setError("Your browser blocked the popup. Allow popups and try again.");
      else setError(err.message || "Could not sign in. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="signin-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Sign in"
    >
      <div className="form" onClick={(e) => e.stopPropagation()}>
        <button className="closeButton" type="button" onClick={onClose} aria-label="Close">
          ×
        </button>

        <p>
          Welcome,<span>sign in to continue</span>
        </p>

        {!isFirebaseConfigured && <p className="formError">{firebaseConfigError}</p>}
        {error && <p className="formError">{error}</p>}

        <button
          className="oauthButton"
          type="button"
          onClick={signIn}
          disabled={busy || !isFirebaseConfigured}
        >
          <svg className="icon" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            <path d="M1 1h22v22H1z" fill="none" />
          </svg>
          {busy ? "Signing in…" : "Continue with Google"}
        </button>

        <span className="formNote">
          We only read your name, email and profile photo.
        </span>
      </div>
    </div>
  );
}
