// The only server component in the app: it renders <html>, the metadata and
// the font links that index.html used to carry, then hands off to Providers.
// Every page below is client-rendered — see app/(marketing)/page.jsx for the
// one exception and why.
//
// Only the true globals are imported here. Every other stylesheet is imported
// by the component or page it belongs to, exactly as before.
import "@/styles/tokens.css";
import "@/styles/base.css";
import "@/styles/layout.css";
// Utilities only — preflight is off, so this can't touch the reset above.
import "@/styles/tailwind.css";

import Providers from "./providers.jsx";

export const metadata = {
  title: "Spring Fest 2k26",
  description:
    "Spring Fest 2k26 — national-level technical symposium at K.S.R. College of Engineering, " +
    "Tiruchengode. 25–26 September 2026. Think · Compete · Conquer · Celebrate.",
  icons: { icon: "/logo.png", apple: "/logo.png" },
};

export const viewport = {
  themeColor: "#eeeeee",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Press+Start+2P&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
