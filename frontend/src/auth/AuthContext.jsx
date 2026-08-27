import { createContext, useContext, useEffect, useState } from "react";
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { auth } from "./firebase.js";
import { getMe } from "../api/client.js";

const AuthContext = createContext(null);

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // The backend is the authority on who is an admin; the flag only
        // decides whether to render the link, never whether data is served.
        try {
          const me = await getMe();
          setIsAdmin(Boolean(me.is_admin));
        } catch {
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });
  }, []);

  const value = {
    user,
    isAdmin,
    loading,
    loginWithGoogle: () => signInWithPopup(auth, provider),
    logout: () => signOut(auth),
    getToken: () => auth.currentUser?.getIdToken(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
