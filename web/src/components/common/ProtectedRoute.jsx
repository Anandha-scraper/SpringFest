"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/auth/AuthContext.jsx";
import { homeForRole } from "@/content/roles.js";
import SignInModal from "@/components/common/SignInModal.jsx";
import Loader from "@/components/common/Loader.jsx";

/**
 * `adminOnly` is the original guard and is unchanged. `roles` is the newer,
 * finer-grained one: an array of role names allowed through. Admins pass any
 * `roles` check. Someone with the wrong role is sent to their own dashboard
 * rather than the landing page.
 *
 * A signed-out visitor gets the Google sign-in modal in place — there is no
 * separate /login page. Signing in re-renders this guard on the same URL;
 * dismissing it sends them home.
 *
 * The redirects were `<Navigate replace />` under react-router. next/navigation
 * has no such element, and calling router.replace() during render is illegal,
 * so they move into an effect and the component renders the loader in the
 * meantime — the same thing the user saw before, since a redirect never
 * painted anything either.
 */
export default function ProtectedRoute({ children, adminOnly = false, roles }) {
  const { user, isAdmin, role, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(false);

  // A signed-in user whose role hasn't arrived yet is still LOADING, not
  // denied. `role` is null in that window, matches no `roles` array, and
  // previously computed denied=true — which redirected a user who had just
  // signed in successfully. AuthContext holds `loading` across the role fetch
  // too; this is the second guard, so the race cannot come back by way of some
  // other path that leaves the two out of step.
  const resolving = Boolean(user) && role === null;
  const denied =
    Boolean(user) &&
    !resolving &&
    ((adminOnly && !isAdmin) || (roles && !isAdmin && !roles.includes(role)));
  // Never redirect a page to itself, or a role whose own home is guarded
  // against it would ping-pong forever.
  const home = homeForRole(role);
  const target = home === pathname ? "/" : home;

  useEffect(() => {
    if (loading || resolving) return;
    if (!user && dismissed) router.replace("/");
    else if (denied) router.replace(target);
  }, [loading, resolving, user, dismissed, denied, target, router]);

  if (loading || resolving) return <Loader />;

  if (!user) {
    if (dismissed) return <Loader />;
    return <SignInModal open redirectOnSignIn={false} onClose={() => setDismissed(true)} />;
  }

  if (denied) return <Loader />;

  return children;
}
