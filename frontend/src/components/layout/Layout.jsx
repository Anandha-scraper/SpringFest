import { Outlet, useLocation } from "react-router-dom";
import Navbar from "@/components/layout/Navbar.jsx";
import Footer from "@/components/layout/Footer.jsx";
import PageBoundary from "@/components/common/PageBoundary.jsx";

export default function Layout() {
  const { pathname } = useLocation();

  return (
    <>
      <Navbar />
      <main className="app-main">
        <PageBoundary>
          <Outlet />
        </PageBoundary>
      </main>
      {pathname === "/" && <Footer />}
    </>
  );
}
