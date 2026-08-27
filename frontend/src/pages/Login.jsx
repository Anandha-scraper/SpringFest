import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import GoogleIcon from "../components/GoogleIcon.jsx";
import { fest } from "../content/fest.js";

export default function Login() {
  const { user, loading, loginWithGoogle, isFirebaseConfigured, firebaseConfigError } = useAuth();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { state } = useLocation();

  if (loading) return <div className="spinner" />;
  if (user) return <Navigate to={state?.from || "/"} replace />;

  const signIn = async () => {
    setError("");
    setBusy(true);
    try {
      await loginWithGoogle();
      navigate(state?.from || "/", { replace: true });
    } catch (err) {
      if (err.code === "auth/popup-closed-by-user") setError("Sign-in was cancelled.");
      else if (err.code === "auth/popup-blocked") setError("Your browser blocked the popup. Allow popups and try again.");
      else setError(err.message || "Could not sign in. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-blobs" aria-hidden="true">
        <span className="blob blob-pink" />
        <span className="blob blob-mint" />
      </div>

      <div className="auth-card">
        <span className="auth-mark">🌸</span>
        <h1>
          {fest.name} <em>{fest.year}</em>
        </h1>
        <p className="muted">
          Sign in to register for events and track your participation.
        </p>

        {!isFirebaseConfigured && <p className="error">{firebaseConfigError}</p>}
        {error && <p className="error">{error}</p>}

        <button className="google-btn" onClick={signIn} disabled={busy || !isFirebaseConfigured}>
          <GoogleIcon size={20} />
          {busy ? "Signing in…" : "Continue with Google"}
        </button>

        <p className="auth-note">
          We only read your name, email and profile photo — nothing else.
        </p>
      </div>
    </div>
  );
}
