"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import HeroCard from "@/components/sections/HeroCard.jsx";
import LogoLoop from "@/components/animation/LogoLoop.jsx";
import SignInModal from "@/components/common/SignInModal.jsx";
import { useAuth } from "@/auth/AuthContext.jsx";
import { fest } from "@/content/fest.js";
import { homeForRole } from "@/content/roles.js";

const PARTNER_LOGOS = fest.partners.map((name) => ({
  node: <span className="loop-wordmark">{name}</span>,
  title: name,
  ariaLabel: name,
}));

export default function Hero() {
  const { user, role } = useAuth();
  const [signInOpen, setSignInOpen] = useState(false);
  const router = useRouter();

  // Register is the sign-in entry point now that the navbar has no button.
  // Already signed in, it goes straight to your role dashboard.
  const handleRegister = () => {
    if (user) router.push(homeForRole(role));
    else setSignInOpen(true);
  };

  return (
    <section className="hero">
      {/* The hero backdrop: four big blurred colour blobs under a cream veil.
          These used to be the fallback behind a WebGL layer; that layer is
          gone, so this is the backdrop now. They go static below 899px —
          blur + animated scale is the most expensive thing a phone GPU here
          can be asked to do. See landing.css. */}
      <div className="hero-blobs" aria-hidden="true">
        <span className="blob blob-pink" />
        <span className="blob blob-peach" />
        <span className="blob blob-mint" />
        <span className="blob blob-lilac" />
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
          ariaLabel="Events"
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
    </section>
  );
}
