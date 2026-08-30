import { CalendarDays, Flower2, Sparkles, Trophy, Users } from "lucide-react";
import "@/styles/components/hero-card.css";
import RegisterButton from "@/components/common/RegisterButton.jsx";
import { fest } from "@/content/fest.js";

/**
 * Neo-brutalist hero card — plain-CSS port of the supplied styled-components
 * "Creative Studio" card, re-themed to the fest palette (see
 * styles/components/hero-card.css). Replaces the old <PixelSwap> hero visual,
 * whose per-pixel hover animation cloned the card ~220× and ran ~440 Web
 * Animations, making the page janky.
 */
const FEATURES = [
  { icon: Sparkles, text: "24 Events" },
  { icon: Users, text: "30+ Colleges" },
  { icon: Trophy, text: "₹1L Prize Pool" },
  { icon: CalendarDays, text: "3 Days" },
];

// Bottom-left dot cluster (matches the reference's <svg viewBox="0 0 80 40">).
const DOT_ROWS = [
  { cy: 10, cxs: [10, 30, 50, 70] },
  { cy: 20, cxs: [20, 40, 60] },
  { cy: 30, cxs: [10, 30, 50, 70] },
];

export default function HeroCard({ onRegister }) {
  return (
    <article className="hero-card">
      <div className="hero-card__grid" aria-hidden="true" />
      <div className="hero-card__dots" aria-hidden="true" />

      <div className="hero-card__bold-pattern" aria-hidden="true">
        <svg viewBox="0 0 100 100">
          <path
            strokeDasharray="15 10"
            strokeWidth={10}
            stroke="currentColor"
            fill="none"
            d="M0,0 L100,0 L100,100 L0,100 Z"
          />
        </svg>
      </div>

      <header className="hero-card__title-area">
        <span className="hero-card__title">
          {fest.name} {fest.year}
        </span>
        <span className="hero-card__tag">
          <Flower2 size={13} aria-hidden="true" />
          Fest
        </span>
      </header>

      <div className="hero-card__body">
        <p className="hero-card__description">{fest.blurb}</p>

        <ul className="hero-card__feature-grid">
          {FEATURES.map(({ icon: Icon, text }) => (
            <li className="hero-card__feature" key={text}>
              <span className="hero-card__feature-icon">
                <Icon size={15} aria-hidden="true" />
              </span>
              <span className="hero-card__feature-text">{text}</span>
            </li>
          ))}
        </ul>

        <div className="hero-card__actions">
          <p className="hero-card__price">
            Registration starts from
            <span className="hero-card__price-amount">&#8377;200</span>
          </p>

          {onRegister && (
            <div className="hero-card__cta">
              <RegisterButton label="Register" onClick={onRegister} />
            </div>
          )}
        </div>
      </div>
      <div className="hero-card__corner-slice" aria-hidden="true" />
    </article>
  );
}
