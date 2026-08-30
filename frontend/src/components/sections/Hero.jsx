import { Suspense, lazy, useState } from "react";
import { useNavigate } from "react-router-dom";
import HeroCard from "@/components/sections/HeroCard.jsx";
import ScrollVelocity from "@/components/animation/ScrollVelocity.jsx";
import LogoLoop from "@/components/animation/LogoLoop.jsx";
import SignInModal from "@/components/common/SignInModal.jsx";
import { useAuth } from "@/auth/AuthContext.jsx";
import { fest } from "@/content/fest.js";
import { homeForRole } from "@/content/roles.js";

// ogl (WebGL) only loads once this chunk resolves. The CSS blobs rendered
// alongside it below are the "WebGL unavailable" fallback and are always
// painted regardless, so there's no visible gap while this streams in.
const Aurora = lazy(() => import("@/components/animation/Aurora.jsx"));

const PARTNER_LOGOS = fest.partners.map((name) => ({
  node: <span className="loop-wordmark">{name}</span>,
  title: name,
  ariaLabel: name,
}));

// Placeholder marquee copy — replace with the real strings later.
const MARQUEE_TEXTS = ["Spring Fest 2k26 ✦ Code · Culture · Chaos ✦", "24 Events ✦ 30+ Colleges ✦ ₹1L Prizes ✦"];

export default function Hero() {
  const { user, role } = useAuth();
  const [signInOpen, setSignInOpen] = useState(false);
  const navigate = useNavigate();

  // Register is the sign-in entry point now that the navbar has no button.
  // Already signed in, it goes straight to your role dashboard.
  const handleRegister = () => {
    if (user) navigate(homeForRole(role));
    else setSignInOpen(true);
  };

  return (
    <section className="hero">
      {/* CSS blobs — always painted, so the hero still reads
          correctly if WebGL is unavailable. */}
      <div className="hero-blobs" aria-hidden="true">
        <span className="blob blob-pink" />
        <span className="blob blob-peach" />
        <span className="blob blob-mint" />
        <span className="blob blob-lilac" />
      </div>

      <div className="hero-aurora" aria-hidden="true">
        <Suspense fallback={null}>
          <Aurora colorStops={["#f5a55c", "#f87b1b", "#cbd99b"]} blend={0.35} amplitude={0.8} speed={0.4} />
        </Suspense>
      </div>
      <div className="hero-veil" aria-hidden="true" />

      <div className="hero-logoloop">
        <LogoLoop
          logos={PARTNER_LOGOS}
          speed={45}
          direction="left"
          logoHeight={18}
          gap={56}
          hoverSpeed={0}
          scaleOnHover
          fadeOut
          fadeOutColor="#f6f6f7"
          ariaLabel="Partners and sponsors"
        />
      </div>

      {/* The hero is the card alone — the old copy column (title, tagline,
          blurb, institution) lived here; the card already carries all of it. */}
      <div className="container hero-grid">
        <div className="hero-visual">
          <HeroCard onRegister={handleRegister} />
          <SignInModal open={signInOpen} onClose={() => setSignInOpen(false)} />
        </div>
      </div>

      <div className="hero-marquee" aria-hidden="true">
        <ScrollVelocity
          texts={MARQUEE_TEXTS}
          velocity={60}
          numCopies={8}
          className="hero-marquee-text"
        />
      </div>
    </section>
  );
}
