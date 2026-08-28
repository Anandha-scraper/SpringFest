/**
 * Hero "Register" button. Structure and animation are the supplied
 * styled-components button, ported to plain CSS (see styles/register-button.css)
 * — the lime `--btn-color` is swapped for the fest's orange accent and the
 * drawer copy is fest-specific.
 */
export default function RegisterButton({
  label = "Register Now",
  topText = "registrations",
  bottomText = "close soon",
  onClick,
}) {
  return (
    <div className="register-button">
      <div className="btn-container">
        <div className="btn-drawer transition-top">{topText}</div>
        <div className="btn-drawer transition-bottom">{bottomText}</div>
        <button className="btn" type="button" onClick={onClick}>
          <span className="btn-text">{label}</span>
        </button>
        {[0, 1, 2, 3].map((i) => (
          <svg key={i} className="btn-corner" xmlns="http://www.w3.org/2000/svg" viewBox="-1 1 32 32">
            <path d="M32,32C14.355,32,0,17.645,0,0h.985c0,17.102,13.913,31.015,31.015,31.015v.985Z" />
          </svg>
        ))}
      </div>
    </div>
  );
}
