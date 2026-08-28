import styled from "styled-components";

/**
 * Hero "Register" button. Structure and animation are the supplied
 * styled-components button; the lime `--btn-color` is swapped for the fest's
 * orange accent and the drawer copy is fest-specific.
 */
export default function RegisterButton({
  label = "Register Now",
  topText = "registrations",
  bottomText = "close soon",
  onClick,
}) {
  return (
    <StyledWrapper>
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
    </StyledWrapper>
  );
}

const StyledWrapper = styled.div`
  .btn-container {
    --btn-color: #f87b1b;
    --corner-color: #11224e22;
    --corner-dist: 24px;
    --corner-multiplier: 1.5;
    --timing-function: cubic-bezier(0, 0, 0, 2.5);
    --duration: 250ms;

    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .btn {
    position: relative;
    min-width: 190px;
    min-height: calc(var(--corner-dist) * 2);
    border-radius: 16px;
    border: none;
    padding: 0.35em 1.2em;

    background: linear-gradient(#fff3, #0001), var(--btn-color);
    box-shadow:
      1px 1px 2px -1px #fff inset,
      0 2px 1px #11224e10,
      0 4px 2px #11224e10,
      0 8px 4px #11224e10,
      0 16px 8px #11224e10,
      0 32px 16px #11224e10;

    transition:
      transform var(--duration) var(--timing-function),
      filter var(--duration) var(--timing-function);
    cursor: pointer;
  }

  .btn-drawer {
    position: absolute;
    display: flex;
    justify-content: center;

    min-height: 32px;
    border-radius: 16px;
    border: none;
    padding: 0.25em 1em;
    font-size: 0.78em;
    font-weight: 600;
    font-family: var(--font-body);
    letter-spacing: 0.02em;
    color: #11224ecc;
    white-space: nowrap;

    background: linear-gradient(#fff3, #0001), var(--btn-color);
    opacity: 0;

    transition:
      transform calc(0.5 * var(--duration)) ease,
      filter var(--duration) var(--timing-function),
      opacity calc(0.5 * var(--duration)) ease;
    filter: blur(2px);
  }

  .transition-top {
    top: 0;
    left: 0;
    right: 0;
    border-radius: 12px 12px 0 0;
    align-items: start;
  }
  .transition-bottom {
    bottom: 0;
    left: 0;
    right: 0;
    border-radius: 0 0 12px 12px;
    align-items: end;
  }

  .btn-text {
    display: inline-block;

    font-size: 1.05em;
    font-family: var(--font-body);
    font-weight: 700;
    color: #5550;

    background-image: linear-gradient(#fff, #ffffffdd);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    filter: drop-shadow(0 1px 0 #0003) drop-shadow(0 -1px 0 #fff4);

    transition:
      transform var(--duration) var(--timing-function),
      filter var(--duration) var(--timing-function),
      color var(--duration) var(--timing-function);
  }

  .btn-corner {
    position: absolute;
    width: 32px;
    fill: none;
    stroke: var(--corner-color);

    transition:
      transform var(--duration) var(--timing-function),
      filter var(--duration) var(--timing-function);
  }

  .btn-corner:nth-of-type(1) {
    top: 0;
    left: 0;
    transform: translate(calc(-1 * var(--corner-dist)), calc(-1 * var(--corner-dist))) rotate(90deg);
  }
  .btn-corner:nth-of-type(2) {
    top: 0;
    right: 0;
    transform: translate(var(--corner-dist), calc(-1 * var(--corner-dist))) rotate(180deg);
  }
  .btn-corner:nth-of-type(3) {
    bottom: 0;
    right: 0;
    transform: translate(var(--corner-dist), var(--corner-dist)) rotate(-90deg);
  }
  .btn-corner:nth-of-type(4) {
    bottom: 0;
    left: 0;
    transform: translate(calc(-1 * var(--corner-dist)), var(--corner-dist)) rotate(0deg);
  }

  .btn-container:has(.btn:hover),
  .btn-container:has(.btn:focus-visible) {
    .btn {
      transform: scale(1.05);
      filter: drop-shadow(0 16px 16px #11224e22);
    }
    .transition-top {
      transform: translateY(-24px) rotateZ(3deg);
      filter: blur(0px);
      animation: hue-anim 3s infinite linear;
      opacity: 1;
    }
    .transition-bottom {
      transform: translateY(24px) rotateZ(3deg);
      filter: blur(0px);
      animation: hue-anim 3s infinite linear;
      opacity: 1;
    }
    .btn-text {
      filter: drop-shadow(0 1px 0 #0003) drop-shadow(0 -1px 0 #fff4) drop-shadow(0px 6px 2px #11224e33);
      transform: scale(1.05);
    }

    --corner-color: #11224e44;
    .btn-corner:nth-of-type(1) {
      transform: translate(
          calc(-1 * var(--corner-multiplier) * var(--corner-dist)),
          calc(-1 * var(--corner-multiplier) * var(--corner-dist))
        )
        rotate(90deg);
      filter: drop-shadow(-10px 10px 1px var(--corner-color)) drop-shadow(-20px 20px 2px var(--corner-color));
    }
    .btn-corner:nth-of-type(2) {
      transform: translate(
          calc(var(--corner-multiplier) * var(--corner-dist)),
          calc(-1 * var(--corner-multiplier) * var(--corner-dist))
        )
        rotate(180deg);
      filter: drop-shadow(-10px 10px 1px var(--corner-color)) drop-shadow(-20px 20px 2px var(--corner-color));
    }
    .btn-corner:nth-of-type(3) {
      transform: translate(
          calc(var(--corner-multiplier) * var(--corner-dist)),
          calc(var(--corner-multiplier) * var(--corner-dist))
        )
        rotate(-90deg);
      filter: drop-shadow(-10px 10px 1px var(--corner-color)) drop-shadow(-20px 20px 2px var(--corner-color));
    }
    .btn-corner:nth-of-type(4) {
      transform: translate(
          calc(-1 * var(--corner-multiplier) * var(--corner-dist)),
          calc(var(--corner-multiplier) * var(--corner-dist))
        )
        rotate(0deg);
      filter: drop-shadow(-10px 10px 1px var(--corner-color)) drop-shadow(-20px 20px 2px var(--corner-color));
    }
  }

  .btn-container:has(.btn:active) {
    .btn {
      transform: scale(0.95);
      filter: drop-shadow(0 10px 4px #11224e22);
    }
    .transition-top,
    .transition-bottom {
      transform: translateY(0px) scale(0.5);
    }
    .btn-text {
      transform: scale(1);
    }
    --corner-color: #11224e55;
    --corner-multiplier: 0.95;
  }

  @keyframes hue-anim {
    0%,
    100% {
      filter: hue-rotate(0deg);
    }
    50% {
      filter: hue-rotate(-30deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .btn,
    .btn-text,
    .btn-corner,
    .btn-drawer {
      transition: none;
      animation: none;
    }
  }
`;
