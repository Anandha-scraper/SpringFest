import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import Aurora from "../reactbits/Aurora.jsx";
import Crosshair from "../reactbits/Crosshair.jsx";
import SplitText from "../reactbits/SplitText.jsx";
import BlurText from "../reactbits/BlurText.jsx";
import GradientText from "../reactbits/GradientText.jsx";
import StarBorder from "../reactbits/StarBorder.jsx";
import Magnet from "../reactbits/Magnet.jsx";
import HeroShowcase from "./HeroShowcase.jsx";
import { useAuth } from "../../auth/AuthContext.jsx";
import { fest } from "../../content/fest.js";

const finePointer =
  typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(pointer: fine)").matches
    : false;

// Placeholder filters — no navigation yet.
const DUMMY_ACTIONS = ["Technical", "Non-Technical", "Schedule"];

export default function Hero() {
  const heroRef = useRef(null);
  const navigate = useNavigate();
  const { user, loginWithGoogle } = useAuth();

  // Register is the sign-in entry point now that the navbar has no button.
  const handleRegister = async () => {
    if (user) {
      document.querySelector("#events")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    try {
      await loginWithGoogle();
    } catch {
      navigate("/login");
    }
  };

  return (
    <section className="hero" ref={heroRef}>
      {/* CSS blobs — always painted, so the hero still reads
          correctly if WebGL is unavailable. */}
      <div className="hero-blobs" aria-hidden="true">
        <span className="blob blob-pink" />
        <span className="blob blob-peach" />
        <span className="blob blob-mint" />
        <span className="blob blob-lilac" />
      </div>

      <div className="hero-aurora" aria-hidden="true">
        <Aurora colorStops={["#f5a55c", "#f87b1b", "#cbd99b"]} blend={0.35} amplitude={0.8} speed={0.4} />
      </div>
      <div className="hero-veil" aria-hidden="true" />

      {finePointer && <Crosshair containerRef={heroRef} color="#f87b1b" />}

      <div className="container hero-grid">
        <div className="hero-copy">
          <span className="hero-pill">
            {fest.dates} · {fest.institution.city}
          </span>

          <h1 className="hero-title">
            <SplitText
              text={fest.name}
              className="hero-title-main"
              delay={60}
              duration={0.8}
              ease="power3.out"
              splitType="chars"
              from={{ opacity: 0, y: 60 }}
              to={{ opacity: 1, y: 0 }}
              threshold={0.1}
              textAlign="left"
            />
            <GradientText
              className="hero-title-year"
              colors={["#f87b1b", "#11224e", "#9bb15f", "#f5a55c", "#f87b1b"]}
              animationSpeed={6}
            >
              {fest.year}
            </GradientText>
          </h1>

          <BlurText
            text={fest.tagline}
            className="hero-tagline"
            delay={40}
            animateBy="words"
            direction="bottom"
          />

          <p className="hero-blurb">{fest.blurb}</p>

          <div className="hero-actions">
            <Magnet padding={80} magnetStrength={6}>
              <button type="button" className="hero-register" onClick={handleRegister}>
                <StarBorder as="div" color="#f87b1b" speed="4s" className="hero-star-btn">
                  Register Now →
                </StarBorder>
              </button>
            </Magnet>

            {DUMMY_ACTIONS.map((label) => (
              <button key={label} type="button" className="hero-chip">
                {label}
              </button>
            ))}
          </div>

          <div className="hero-inst">
            Presented by {fest.institution.department}
            <br />
            <strong>{fest.institution.name}</strong>
          </div>
        </div>

        <div className="hero-visual">
          <HeroShowcase />
        </div>
      </div>

      <a href="#stats" className="hero-scroll" aria-label="Scroll to content">
        <span />
      </a>
    </section>
  );
}
