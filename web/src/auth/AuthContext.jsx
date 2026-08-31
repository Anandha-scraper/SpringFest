"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { auth, isFirebaseConfigured, firebaseConfigError } from "@/auth/firebase.js";
import { createSession, destroySession, getMe } from "@/api/client.js";
import { DEFAULT_ROLE, ROLES } from "@/content/roles.js";

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
  // How registrations are being paid for right now, and whether new ones are
  // even being accepted. Both ride along on /api/me because the registration
  // form has to know before rendering, and an organiser can flip either mid-fest.
  // `registration_open` defaults true so the form doesn't flash "closed"
  // while this is still loading.
  const [payment, setPayment] = useState({
    payment_mode: "",
    payment_upi_id: "",
    has_payment_qr: false,
    registration_open: true,
  });

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
        payment_upi_id: me?.payment_upi_id || "",
        has_payment_qr: Boolean(me?.has_payment_qr),
        registration_open: me?.registration_open !== false,
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
    paymentUpiId: payment.payment_upi_id,
    hasPaymentQr: payment.has_payment_qr,
    registrationOpen: payment.registration_open,
    loading,
    isFirebaseConfigured,
    firebaseConfigError,
    refreshRole,
    loginWithGoogle: async () => {
      const credential = await signInWithPopup(requireAuth(), provider);
      // Mint the server-readable cookie straight after the popup, while the
      // sign-in is still "fresh" — auth/session.js rejects an ID token from a
      // sign-in older than five minutes. Failing here must NOT fail the login:
      // the bearer-token path still works, so the user is signed in either way
      // and only loses server-side rendering until their next sign-in.
      try {
        await createSession(await credential.user.getIdToken());
      } catch (err) {
        console.warn("Session cookie not created; falling back to bearer auth.", err?.message);
      }
      return credential;
    },
    logout: async () => {
      // Cookie first: once signOut() runs there is no token left to authorise
      // the request that clears it, and a cookie outliving the sign-out is the
      // one failure here that actually matters.
      try {
        await destroySession();
      } catch {
        // Already expired or revoked — signing out locally is still correct.
      }
      return signOut(requireAuth());
    },
    getToken: () => auth?.currentUser?.getIdToken(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
