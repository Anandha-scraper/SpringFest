"use client";

import { usePathname } from "next/navigation";
import Navbar from "@/components/layout/Navbar.jsx";
import Footer from "@/components/layout/Footer.jsx";
import PageBoundary from "@/components/common/PageBoundary.jsx";

/** The marketing shell — navbar, content, and the footer on the landing page
 * only. `<Outlet />` became `children`: in the App Router the nesting is the
 * directory structure, so this is rendered by app/(marketing)/layout.jsx with
 * the page already inside it. */
export default function Layout({ children }) {
  const pathname = usePathname();

  return (
    <>
      <Navbar />
      <main className="app-main">
        <PageBoundary>{children}</PageBoundary>
      </main>
      {pathname === "/" && <Footer />}
    </>
  );
}
