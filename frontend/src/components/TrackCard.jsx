import { useState } from "react";

// Neo-brutalist track card — the React Bits `Card` (styled-components)
// ported to plain CSS, matching this repo's styling approach.
// `image` is the public/events SVF; until the file exists a CSS skeleton
// mock reserves the space so the grid stays laid out.

const TRACK_ICONS = {
  technical: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M8 6l-6 6 6 6" />
      <path d="M16 6l6 6-6 6" />
    </svg>
  ),
  "non-technical": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M12 3l2.9 6.3 6.8.8-5 4.7 1.3 6.7L12 18l-6 3.5 1.3-6.7-5-4.7 6.8-.8z" />
    </svg>
  ),
  hackathon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M5 21V4" />
      <path d="M5 6h11.5a1.5 1.5 0 011.5 1.5V10H7" />
      <path d="M5 13h10.5a1.5 1.5 0 011.5 1.5V16a1.5 1.5 0 01-1.5 1.5H11" />
    </svg>
  ),
  workshop: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M14.5 6.5a4 4 0 10-5.2 5.2l-5 5a1.5 1.5 0 102.2 2.2l5-5A4 4 0 1014.5 6.5z" />
    </svg>
  ),
};

export default function TrackCard({ label, image, accent, tint, onClick }) {
  const [imageFailed, setImageFailed] = useState(false);

  // public/ dir maps to the site root: /events/<name>.svg
  const showImage = image && !imageFailed;

  return (
    <button type="button" className="card-sm track-card" onClick={onClick}>
      <div className="block-header track-header" style={{ background: tint }}>
        <div className="block-title">
          <span className="track-icon" style={{ background: accent, color: "#fff" }}>
            {TRACK_ICONS[label.toLowerCase()]}
          </span>
          <p className="block-title-text">{label}</p>
        </div>
      </div>
      <div className="css-dom">
        {showImage ? (
          <img
            src={image}
            alt={`${label} artwork`}
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ) : null}
      </div>
    </button>
  );
}