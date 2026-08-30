import "@/styles/components/comic-button.css";

/**
 * Comic-brutalist button — plain-CSS port of the supplied styled-components
 * reference, retinted to the fest palette (primary → --accent orange,
 * secondary → --ink navy, accent → --sage) and sized down hard so it fits the
 * event poster's footer: the reference's `padding: 2em` container and
 * `font-size: 1.5em` would have blown straight through `.doodlepro__stage`,
 * which clips at `overflow: hidden`.
 *
 * The whole visual (inner panel, offset shadow block, accent frame, halftone
 * dots, ink splatter) is decoration and `aria-hidden`; only `.button-text`
 * carries the accessible name.
 */
export default function ComicButton({ label = "REGISTER", onClick, className = "" }) {
  return (
    <div className={`comic-brutal-button-container ${className}`.trim()}>
      <span className="button-shadow" aria-hidden="true" />
      <button type="button" className="comic-brutal-button" onClick={onClick}>
        <span className="button-inner">
          <span className="halftone-overlay" aria-hidden="true" />
          <span className="ink-splatter" aria-hidden="true" />
          <span className="button-text">{label}</span>
        </span>
      </button>
      <span className="button-frame" aria-hidden="true" />
    </div>
  );
}
