"use client";

import "@/styles/components/bracket-button.css";

/**
 * Plain-CSS port of the supplied styled-components "GAME ON" button — a label
 * framed by two offset bars (::before / ::after) that pull inward on hover.
 * Used only as the "tap a track" hint by the Events header, so it's a static
 * <div>, not an interactive element.
 */
export default function BracketButton({ label = "GAME ON", className = "" }) {
  return (
    <div className={`bracket-button ${className}`.trim()}>
      <div className="bracket-button__box">
        <span>{label}</span>
      </div>
    </div>
  );
}
