"use client";

import { Building2, CalendarCheck, CalendarDays, LogIn, MapPin, QrCode, Users } from "lucide-react";
import "@/styles/components/hero-card.css";
import RegisterButton from "@/components/common/RegisterButton.jsx";
import { fest } from "@/content/fest.js";

/**
 * Neo-brutalist hero card — plain-CSS port of the supplied styled-components
 * "Creative Studio" card, re-themed to the fest palette (see
 * styles/components/hero-card.css). Carries the fest identity plus the
 * four-step "how to register" flow, so the landing hero is the card alone.
 */
const META = [
  { icon: CalendarDays, text: "25–26 September 2026" },
  { icon: MapPin, text: "KSRCE · Tiruchengode" },
  { icon: Building2, text: "Dept. of Computer Science & Engineering" },
];

const STEPS = [
  { icon: LogIn, text: "Click Register , Sign in with your Google account" },
  { icon: CalendarCheck, text: "Pick events , enter solo or as a team" },
  { icon: Users, text: "Add teammates, pay the fee online , login with registered mail to see your QR pass" },
  { icon: QrCode, text: "Every member gets a personal QR pass" },
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
          <CalendarDays size={13} aria-hidden="true" />
          Symposium
        </span>
      </header>

      <div className="hero-card__body">
        <p className="hero-card__kicker">National Level Technical Symposium</p>
        <p className="hero-card__description">
          {fest.tagline} Emerging technologies, future trends and computing —
          two days of building, competing and celebrating.
        </p>

        <ul className="hero-card__meta">
          {META.map(({ icon: Icon, text }) => (
            <li className="hero-card__meta-item" key={text}>
              <Icon size={14} aria-hidden="true" />
              {text}
            </li>
          ))}
        </ul>

        <div className="hero-card__steps-head">How to register</div>
        <ol className="hero-card__steps">
          {STEPS.map(({ icon: Icon, text }, i) => (
            <li className="hero-card__step" key={text}>
              <span className="hero-card__step-num" aria-hidden="true">
                {i + 1}
              </span>
              <span className="hero-card__step-icon" aria-hidden="true">
                <Icon size={15} />
              </span>
              <span className="hero-card__step-text">{text}</span>
            </li>
          ))}
        </ol>

        <div className="hero-card__actions">
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
