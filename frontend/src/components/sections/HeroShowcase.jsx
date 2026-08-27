import { Link } from "react-router-dom";
import PixelSwap from "../reactbits/PixelSwap.jsx";
import { fest } from "../../content/fest.js";

const hashtags = fest.tagline
  .replace(/[.,]/g, "")
  .split(" ")
  .filter((w) => w.length > 2)
  .slice(0, 3)
  .map((w) => `#${w.toLowerCase()}`);

function PosterCard() {
  return (
    <div className="ps-face ps-poster">
      <span className="ps-kicker">{fest.institution.city}</span>
      <div className="ps-title">
        <span>{fest.name}</span>
        <strong>{fest.year}</strong>
      </div>
      <span className="ps-dates">{fest.dates}</span>
      <div className="ps-tags">
        {hashtags.map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
      <span className="ps-hint">hover to flip ⟳</span>
    </div>
  );
}

function RegisterCard() {
  return (
    <div className="ps-face ps-register">
      <span className="ps-kicker">Ready to compete?</span>
      <h3>Grab your slot</h3>
      <p>24 events · ₹1 Lakh prize pool · 30+ colleges</p>
      <Link to="/#events" className="btn">
        Register Now →
      </Link>
    </div>
  );
}

export default function HeroShowcase() {
  return (
    <PixelSwap
      className="hero-pixelswap"
      aspectRatio="4 / 5"
      trigger="hover"
      pattern="random"
      pixelSize={40}
      duration={1100}
      pixelDuration={400}
      firstContent={<PosterCard />}
      secondContent={<RegisterCard />}
    />
  );
}
