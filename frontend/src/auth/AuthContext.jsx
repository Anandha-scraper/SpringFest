import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { auth, isFirebaseConfigured, firebaseConfigError } from "./firebase.js";
import { getMe } from "../api/client.js";
import { DEFAULT_ROLE, ROLES } from "../content/roles.js";

const AuthContext = createContext(null);

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

// A wedged API must not pin every ProtectedRoute on the spinner forever, so the
// role lookup is bounded. Past this we fall back to participant and say so.
const ROLE_TIMEOUT_MS = 8000;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // The backend is the sole authority on roles — resolved from ADMIN_EMAILS and
  // the Firestore `roles` collection, and delivered by GET /api/me.
  const [role, setRole] = useState(null);
  const [roleError, setRoleError] = useState("");
  const [loading, setLoading] = useState(isFirebaseConfigured);
  // How registrations are being paid for right now. Rides along on /api/me
  // because the registration form has to know which flow to render, and an
  // organiser can flip it mid-fest if the gateway goes down.
  const [payment, setPayment] = useState({ payment_mode: "", payment_instructions: "" });

  // Returns the role as well as storing it: the sign-in flows need the value
  // immediately and can't wait for a re-render to redirect.
  const refreshRole = useCallback(async () => {
    try {
      const me = await Promise.race([
        getMe(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timed out reaching the API")), ROLE_TIMEOUT_MS)
        ),
      ]);
      const resolved = me?.role || DEFAULT_ROLE;
      setRole(resolved);
      setPayment({
        payment_mode: me?.payment_mode || "",
        payment_instructions: me?.payment_instructions || "",
      });
      setRoleError("");
      return resolved;
    } catch (err) {
      // Fail closed: no confirmed role means the least privilege we have.
      setRole(DEFAULT_ROLE);
      setRoleError(err.message || "Could not confirm your role.");
      return DEFAULT_ROLE;
    }
  }, []);

  useEffect(() => {
    // Nothing to subscribe to without credentials — the public pages still work.
    if (!auth) return;

    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // `loading` has to cover this: ProtectedRoute reads `role`, and letting
        // it evaluate null would bounce an admin off their own dashboard.
        await refreshRole();
      } else {
        setRole(null);
        setRoleError("");
      }
      setLoading(false);
    });
  }, [refreshRole]);

  const requireAuth = () => {
    if (!auth) throw new Error(firebaseConfigError);
    return auth;
  };

  const value = {
    user,
    role,
    roleError,
    isAdmin: role === ROLES.ADMIN,
    paymentMode: payment.payment_mode,
    paymentInstructions: payment.payment_instructions,
    loading,
    isFirebaseConfigured,
    firebaseConfigError,
    refreshRole,
    loginWithGoogle: () => signInWithPopup(requireAuth(), provider),
    logout: () => signOut(requireAuth()),
    getToken: () => auth?.currentUser?.getIdToken(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
