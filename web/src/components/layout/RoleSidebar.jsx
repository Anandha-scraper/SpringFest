"use client";

import { useState } from "react";
import "@/styles/components/role-sidebar.css";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, PanelLeft } from "lucide-react";
import { useAuth } from "@/auth/AuthContext.jsx";
import { ROLE_NAV, ROLE_TITLE } from "@/content/roles.js";

/**
 * The role-dashboard rail. Collapsed to an icon strip by default; on desktop it
 * expands on hover, on mobile a button toggles it open over a scrim. All of that
 * behaviour lives in styles/role-sidebar.css — this component only tracks the
 * mobile open flag and renders semantic markup.
 */
export default function RoleSidebar({ role }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const nav = ROLE_NAV[role] || [];
  const title = ROLE_TITLE[role] || "Dashboard";
  const close = () => setOpen(false);

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  const initial = (user?.displayName || user?.email || "?")[0].toUpperCase();

  return (
    <>
      <aside className="role-sidebar" data-open={open || undefined}>
        <div className="role-sidebar__head">
          <button
            type="button"
            className="role-sidebar__toggle"
            aria-label={open ? "Collapse menu" : "Expand menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <PanelLeft size={18} aria-hidden="true" />
          </button>
          <Link href="/" className="role-sidebar__brand" onClick={close}>
            <img src="/logo.png" alt="" className="role-sidebar__logo" />
            <span className="role-sidebar__brand-text">
              <strong>Spring Fest</strong>
              <small>{title}</small>
            </span>
          </Link>
        </div>

        <nav className="role-sidebar__nav" aria-label={`${title} sections`}>
          {nav.map((item) => {
            const active = item.end
              ? pathname === item.to
              : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                href={item.to}
                className="role-sidebar__link"
                data-active={active || undefined}
                title={item.label}
                onClick={close}
              >
                {Icon && <Icon size={18} aria-hidden="true" />}
                <span className="role-sidebar__label">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="role-sidebar__foot">
          <div className="role-sidebar__user">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt=""
                className="role-sidebar__avatar"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="role-sidebar__avatar role-sidebar__avatar--initial">
                {initial}
              </span>
            )}
            <span className="role-sidebar__user-text">
              <strong>{user?.displayName || "Signed in"}</strong>
              <small>{user?.email}</small>
            </span>
          </div>
          {/* No "back to site" link — leaving a role dashboard means signing
              out. Getting back in goes through the hero's Register button. */}
          <button type="button" className="role-sidebar__logout" onClick={handleLogout}>
            <LogOut size={18} aria-hidden="true" />
            <span className="role-sidebar__label">Log out</span>
          </button>
        </div>
      </aside>

      <button
        type="button"
        className="role-sidebar__scrim"
        aria-hidden="true"
        tabIndex={-1}
        onClick={close}
      />
    </>
  );
}
