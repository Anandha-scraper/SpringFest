"use client";

import "@/styles/components/register-button.css";

/**
 * Hero "Register" button. Plain-CSS port of the supplied styled-components
 * button (corner-flourish brackets + peek-out drawers + hue-shift hover);
 * see styles/components/register-button.css. The reference's lime
 * `--btn-color` is swapped for the fest orange `--accent`.
 *
 * API unchanged: <RegisterButton label="Register Now" onClick={fn} />.
 * `topText` / `bottomText` fill the two drawers that slide out on hover —
 * the button is the sign-in entry point, so they hint at what's behind it.
 */
const CORNER_PATH =
  "M32,32C14.355,32,0,17.645,0,0h.985c0,17.102,13.913,31.015,31.015,31.015v.985Z";

export default function RegisterButton({
  label = "Register Now",
  onClick,
  topText = "log in",
  bottomText = "check status",
}) {
  return (
    <div className="register-button">
      <div className="btn-container">
        <div className="btn-drawer transition-top" aria-hidden="true">{topText}</div>
        <div className="btn-drawer transition-bottom" aria-hidden="true">{bottomText}</div>
        <button className="btn" type="button" onClick={onClick}>
          <span className="btn-text">{label}</span>
        </button>
        {[0, 1, 2, 3].map((i) => (
          <svg key={i} className="btn-corner" xmlns="http://www.w3.org/2000/svg" viewBox="-1 1 32 32" aria-hidden="true">
            <path d={CORNER_PATH} />
          </svg>
        ))}
      </div>
    </div>
  );
}
