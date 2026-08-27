import { fest } from "../../content/fest.js";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div className="footer-id">
          <span className="footer-mark">🌸</span>
          <div>
            <strong>
              {fest.name} <em>{fest.year}</em>
            </strong>
            <span className="footer-sub">
              {fest.institution.name} · {fest.dates}
            </span>
          </div>
        </div>

        <div className="footer-links">
          {fest.contacts.slice(0, 2).map((c) => (
            <a key={c.role} href={`mailto:${c.email}`}>{c.email}</a>
          ))}
          <a href={`tel:${fest.contacts[0].phone.replace(/\s/g, "")}`}>
            {fest.contacts[0].phone}
          </a>
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
