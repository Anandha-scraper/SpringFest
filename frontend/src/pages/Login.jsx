import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import GoogleIcon from "../components/GoogleIcon.jsx";
import { fest } from "../content/fest.js";
import { homeForRole } from "../content/roles.js";

export default function Login() {
  const { user, role, loading, loginWithGoogle, refreshRole, isFirebaseConfigured, firebaseConfigError } = useAuth();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { state } = useLocation();

  if (loading) return <div className="spinner" />;
  if (user) return <Navigate to={state?.from || homeForRole(role)} replace />;

  const signIn = async () => {
    setError("");
    setBusy(true);
    try {
      await loginWithGoogle();
      // `state.from` is where ProtectedRoute bounced them from — honour it
      // first, otherwise send them to their role's dashboard.
      const resolved = await refreshRole();
      navigate(state?.from || homeForRole(resolved), { replace: true });
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
