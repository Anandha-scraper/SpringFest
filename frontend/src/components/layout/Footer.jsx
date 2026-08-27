import { Link } from "react-router-dom";
import { fest, navLinks } from "../../content/fest.js";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <div className="nav-brand">
            <span className="nav-mark">🌸</span>
            <span>
              {fest.name} <em>{fest.year}</em>
            </span>
          </div>
          <p className="muted">{fest.blurb}</p>
          <p className="footer-inst">
            {fest.institution.department}
            <br />
            {fest.institution.name} · {fest.institution.city}
          </p>
        </div>

        <div className="footer-col">
          <h4>Explore</h4>
          {navLinks.map((l) => (
            <a key={l.label} href={l.href}>{l.label}</a>
          ))}
          <Link to="/my-registrations">My Registrations</Link>
        </div>

        <div className="footer-col">
          <h4>Contact</h4>
          {fest.contacts.map((c) => (
            <div key={c.role} className="footer-contact">
              <span className="footer-role">{c.role}</span>
              <strong>{c.name}</strong>
              <a href={`tel:${c.phone.replace(/\s/g, "")}`}>{c.phone}</a>
              <a href={`mailto:${c.email}`}>{c.email}</a>
            </div>
          ))}
        </div>

        <div className="footer-col">
          <h4>Follow</h4>
          <a href={fest.social.instagram} target="_blank" rel="noreferrer">Instagram</a>
          <a href={fest.social.linkedin} target="_blank" rel="noreferrer">LinkedIn</a>
          <a href={fest.social.twitter} target="_blank" rel="noreferrer">X / Twitter</a>
          <a href={fest.institution.website} target="_blank" rel="noreferrer">College Website</a>
        </div>
      </div>

      <div className="container footer-bottom">
        <span>
          © {new Date().getFullYear()} {fest.name} {fest.year} · {fest.institution.name}
        </span>
        <span className="muted">{fest.dates} · {fest.venue}</span>
      </div>
    </footer>
  );
}
