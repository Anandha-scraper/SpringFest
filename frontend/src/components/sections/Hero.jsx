import { Link } from "react-router-dom";
import Aurora from "../reactbits/Aurora.jsx";
import SplitText from "../reactbits/SplitText.jsx";
import BlurText from "../reactbits/BlurText.jsx";
import GradientText from "../reactbits/GradientText.jsx";
import StarBorder from "../reactbits/StarBorder.jsx";
import Magnet from "../reactbits/Magnet.jsx";
import { fest } from "../../content/fest.js";

export default function Hero() {
  return (
    <section className="hero">
      {/* CSS pastel blobs — always painted, so the hero still reads
          correctly if WebGL is unavailable. */}
      <div className="hero-blobs" aria-hidden="true">
        <span className="blob blob-pink" />
        <span className="blob blob-peach" />
        <span className="blob blob-mint" />
        <span className="blob blob-lilac" />
      </div>

      <div className="hero-aurora" aria-hidden="true">
        <Aurora colorStops={["#ffd4b2", "#ffb3c9", "#b9ecd8"]} blend={0.35} amplitude={0.8} speed={0.4} />
      </div>
      <div className="hero-veil" aria-hidden="true" />

      <div className="container hero-content">
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
            textAlign="center"
          />
          <GradientText
            className="hero-title-year"
            colors={["#f2789f", "#f7a072", "#8b6fd4", "#4fbf9b", "#f2789f"]}
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

        <div className="hero-cta">
          <Magnet padding={80} magnetStrength={6}>
            <Link to="/#events">
              <StarBorder as="div" color="#f2789f" speed="4s" className="hero-star-btn">
                Register Now →
              </StarBorder>
            </Link>
          </Magnet>
          <a href="#schedule" className="btn btn-ghost">View Schedule</a>
        </div>

        <div className="hero-inst">
          Presented by {fest.institution.department}
          <br />
          <strong>{fest.institution.name}</strong>
        </div>
      </div>

      <a href="#stats" className="hero-scroll" aria-label="Scroll to content">
        <span />
      </a>
    </section>
  );
}
