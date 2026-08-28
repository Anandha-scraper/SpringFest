import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, LogOut } from "lucide-react";
import { useAuth } from "../../auth/AuthContext.jsx";
import { ROLE_NAV, ROLE_TITLE } from "../../content/roles.js";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar.jsx";
import { Separator } from "@/components/ui/separator.jsx";

/**
 * Standalone shell for every role dashboard: shadcn Sidebar + the child
 * route's outlet, with no PillNav or footer. One component driven by
 * ROLE_NAV rather than four near-identical layouts. Sidebar's own mobile
 * behavior (an off-canvas drawer below the breakpoint, opened by
 * SidebarTrigger) is what makes this responsive — no custom code for it.
 *
 * Pages own their own headings — the sidebar carries role identity, so
 * nothing here duplicates what AdminDashboard or EventParticipants render.
 */
export default function RoleLayout({ role }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const nav = ROLE_NAV[role] || [];
  const title = ROLE_TITLE[role] || "Dashboard";

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center justify-between gap-2 group-data-[collapsible=icon]:justify-center">
            <Link
              to="/"
              className="flex items-center gap-2.5 rounded-md px-2 py-1.5 group-data-[collapsible=icon]:hidden"
            >
              <img src="/logo.png" alt="" className="h-7 w-7 object-contain" />
              <span className="flex flex-col leading-tight">
                <strong className="text-sm">Spring Fest</strong>
                <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-primary">
                  {title}
                </span>
              </span>
            </Link>
            <SidebarTrigger className="hidden shrink-0 md:flex" />
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarMenu aria-label={`${title} sections`}>
            {nav.map((item) => {
              // Computed here, not via NavLink's own render-prop: SidebarMenuButton
              // needs isActive as a plain prop, and asChild (below) renders NavLink's
              // <a> directly as the button — nesting an actual <button> inside NavLink's
              // <a> would be invalid HTML.
              const isActive = item.end ? pathname === item.to : pathname.startsWith(item.to);
              const Icon = item.icon;
              return (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                    <NavLink to={item.to} end={item.end}>
                      {Icon && <Icon className="h-4 w-4 shrink-0" />}
                      <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarContent>

        <SidebarFooter>
          <Separator className="mb-1" />
          <div className="flex items-center gap-2.5 px-2 py-1.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt=""
                className="h-8 w-8 shrink-0 rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {(user?.displayName || user?.email || "?")[0].toUpperCase()}
              </span>
            )}
            <span className="flex min-w-0 flex-col leading-tight group-data-[collapsible=icon]:hidden">
              <strong className="truncate text-sm">{user?.displayName || "Signed in"}</strong>
              <span className="truncate text-xs text-muted-foreground">{user?.email}</span>
            </span>
          </div>
          <Link
            to="/"
            className="flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            <span className="group-data-[collapsible=icon]:hidden">Back to site</span>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="flex h-9 items-center gap-2 rounded-md px-3 text-left text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className="group-data-[collapsible=icon]:hidden">Log out</span>
          </button>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        {/* Only visible below the sidebar's mobile breakpoint. */}
        <div className="flex h-12 items-center gap-2 border-b border-border px-4 md:hidden">
          <SidebarTrigger />
          <span className="text-sm font-semibold">{title}</span>
        </div>
        <div className="flex-1 px-5 py-8 sm:px-8">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
