import { Outlet, useLocation } from "react-router-dom";
import Navbar from "./Navbar.jsx";
import Footer from "./Footer.jsx";

export default function Layout() {
  const { pathname } = useLocation();

  return (
    <>
      <Navbar />
      <main className="app-main">
        <Outlet />
      </main>
      {pathname === "/" && <Footer />}
    </>
  );
}
