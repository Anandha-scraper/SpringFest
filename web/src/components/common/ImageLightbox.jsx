"use client";

import { useEffect } from "react";

/**
 * Click-to-enlarge overlay for a single image (the payment screenshot in the
 * approval queue). Controlled: render it only when `src` is set, close on
 * Escape, a backdrop click, or a click on the image itself.
 *
 * Styles live in `styles/pages/admin/payment.css` (`.img-lightbox`).
 */
export default function ImageLightbox({ src, alt = "", onClose }) {
  useEffect(() => {
    if (!src) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [src, onClose]);

  if (!src) return null;

  return (
    <div
      className="img-lightbox"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={alt || "Image preview"}
    >
      <img src={src} alt={alt} />
    </div>
  );
}
