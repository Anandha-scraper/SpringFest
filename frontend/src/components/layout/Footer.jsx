import { fest } from "../../content/fest.js";

export default function Footer() {
  const c = fest.contact;

  return (
    // The nav's /#contact target lives here now — the contact block and the
    // footer are one unit at the bottom of the page, not a full-height section.
    <footer id="contact" className="footer">
      <div className="container footer-contact">
        <div className="footer-contact-copy">
          <span className="footer-label">Get in touch</span>
          <h2>Contact</h2>
          <p className="footer-lede">
            Questions about events, registration or travel — reach the desk below.
          </p>

          <ul className="contact-list">
            <li>
              <span className="contact-label">Convenor</span>
              <strong>{c.person}</strong>
              <span className="muted">{c.role}</span>
            </li>
            <li>
              <span className="contact-label">Email</span>
              <a href={`mailto:${c.email}`}>{c.email}</a>
            </li>
            <li>
              <span className="contact-label">Phone</span>
              <a href={`tel:${c.phone.replace(/\s/g, "")}`}>{c.phone}</a>
            </li>
            <li>
              <span className="contact-label">Location</span>
              <span>{c.location}</span>
              <a href={c.mapLink} target="_blank" rel="noreferrer">
                Open in Maps →
              </a>
            </li>
          </ul>
        </div>

        <div className="contact-map">
          <iframe
            src={c.mapEmbed}
            title={`Map to ${fest.institution.name}`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>
      </div>

      <div className="container footer-inner">
        <div>
          <strong>
            {fest.name} {fest.year}
          </strong>
          <span className="footer-sub">
            {fest.institution.name} · {fest.dates}
          </span>
        </div>

        <div className="footer-social">
          <a href={fest.social.instagram} target="_blank" rel="noreferrer">Instagram</a>
          <a href={fest.social.linkedin} target="_blank" rel="noreferrer">LinkedIn</a>
          <a href={fest.social.twitter} target="_blank" rel="noreferrer">X</a>
        </div>
      </div>

      <div className="container footer-base">
        © {new Date().getFullYear()} {fest.institution.name} · {fest.institution.department}
      </div>
    </footer>
  );
}
