"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { auth, isFirebaseConfigured, firebaseConfigError } from "@/auth/firebase.js";
import { createSession, destroySession, getMe } from "@/api/client.js";
import { DEFAULT_ROLE, ROLES } from "@/content/roles.js";

const AuthContext = createContext(null);

/** Google provider.
 *
 * No `prompt: "select_account"` by default. Forcing the account chooser on
 * every sign-in was the single largest piece of wall-clock time in the whole
 * flow, because it is a *human* step: a returning participant who could have
 * been signed in silently had to pick their account every time. Google still
 * shows the chooser on its own whenever the browser has more than one session
 * or none at all, so the common shared-laptop case is not silently wrong —
 * and `loginWithGoogle({ chooseAccount: true })` forces it back for the one
 * attempt behind the modal's "Use a different account". */
const provider = new GoogleAuthProvider();

/** A separate instance for the deliberate "switch account" path. Custom
 * parameters are set on the provider object, so mutating the shared one would
 * leak the prompt into every later sign-in. */
const chooserProvider = new GoogleAuthProvider();
chooserProvider.setCustomParameters({ prompt: "select_account" });

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
    // Empty means "no caps", which is also what the server defaults to — so a
    // slow /api/me never briefly tells someone they're at a limit.
    category_limits: {},
    registration_open: true,
    whatsapp_group_url: "",
  });

  // One in-flight /api/me at a time. Both the auth listener and the sign-in
  // modal ask for the role the moment a user appears, and the response is
  // byte-identical — two double-hop round trips, two token verifications and
  // two Firestore reads for one answer. Whoever asks second joins the first
  // request instead of starting another.
  const inFlight = useRef(null);

  // Returns the role as well as storing it: the sign-in flows need the value
  // immediately and can't wait for a re-render to redirect.
  const refreshRole = useCallback(async () => {
    if (inFlight.current) return inFlight.current;
    const run = (async () => {
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
          category_limits: me?.category_limits || {},
          registration_open: me?.registration_open !== false,
          whatsapp_group_url: me?.whatsapp_group_url || "",
        });
        setRoleError("");
        return resolved;
      } catch (err) {
        // Fail closed: no confirmed role means the least privilege we have.
        setRole(DEFAULT_ROLE);
        setRoleError(err.message || "Could not confirm your role.");
        return DEFAULT_ROLE;
      } finally {
        // Cleared in `finally`, not after the await below, so a rejected
        // request can never wedge every later call on a dead promise.
        inFlight.current = null;
      }
    })();
    inFlight.current = run;
    return run;
  }, []);

  useEffect(() => {
    // Nothing to subscribe to without credentials — the public pages still work.
    if (!auth) return;

    return onAuthStateChanged(auth, async (u) => {
      // Raised again on every sign-in, not just the first. This listener also
      // fires part-way through a later sign-in, and `loading` had already been
      // set false by the initial signed-out pass — leaving a window where a
      // user existed but `role` was still null. ProtectedRoute reads exactly
      // that pair, found no matching role, and bounced a freshly signed-in
      // admin back to the landing page.
      if (u) setLoading(true);
      setUser(u);
      if (u) {
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
    categoryLimits: payment.category_limits,
    whatsappGroupUrl: payment.whatsapp_group_url,
    registrationOpen: payment.registration_open,
    loading,
    isFirebaseConfigured,
    firebaseConfigError,
    refreshRole,
    loginWithGoogle: async ({ chooseAccount = false } = {}) => {
      const credential = await signInWithPopup(
        requireAuth(),
        chooseAccount ? chooserProvider : provider
      );
      // Mint the server-readable cookie straight after the popup, while the
      // sign-in is still "fresh" — auth/session.js rejects an ID token from a
      // sign-in older than five minutes. Failing here must NOT fail the login:
      // the bearer-token path still works, so the user is signed in either way
      // and only loses server-side rendering until their next sign-in.
      //
      // Started but NOT awaited. It costs two Google round trips behind the
      // API proxy (verifyIdToken with checkRevoked, then createSessionCookie),
      // and nothing on the path to the dashboard needs the cookie — it exists
      // for SSR and for EventSource, which cannot send a bearer header. The
      // role fetch that follows this call runs against the bearer token, so
      // awaiting the cookie here only made the user wait for it.
      const session = credential.user
        .getIdToken()
        .then(createSession)
        .catch((err) => {
          console.warn("Session cookie not created; falling back to bearer auth.", err?.message);
        });
      return { credential, session };
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
