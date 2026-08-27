import { useAuth } from "../auth/AuthContext.jsx";

// Dev-time nudge: the public site renders fine without Firebase, but nothing
// that needs sign-in will work until VITE_FIREBASE_* is filled in.
export default function ConfigNotice() {
  const { isFirebaseConfigured } = useAuth();
  if (isFirebaseConfigured) return null;

  return (
    <div className="config-notice">
      <strong>Setup needed:</strong> Firebase isn't configured, so sign-in and
      registration are disabled. Fill <code>VITE_FIREBASE_*</code> in{" "}
      <code>frontend/.env</code>, then restart <code>npm run dev</code>.
    </div>
  );
}
