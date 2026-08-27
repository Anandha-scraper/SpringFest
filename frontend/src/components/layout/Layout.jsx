import { Outlet } from "react-router-dom";
import Navbar from "./Navbar.jsx";
import Footer from "./Footer.jsx";
import ConfigNotice from "../ConfigNotice.jsx";

export default function Layout() {
  return (
    <>
      <Navbar />
      <ConfigNotice />
      <main className="app-main">
        <Outlet />
      </main>
      <Footer />
    </>
  );
}
