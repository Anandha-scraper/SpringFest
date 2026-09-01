"use client";

import { fest } from "@/content/fest.js";
import FestMemberCard from "@/components/common/FestMemberCard.jsx";

export default function Footer() {
  const c = fest.contact;

  return (
    // The nav's /#contact target lives here — the contact block and the
    // footer are one compact unit at the bottom of the page.
    <footer id="contact" className="footer">
      <div className="footer-contact">
        <div className="footer-contact-copy">
          <div className="contact-group">
            <span className="contact-label">Faculty Co-ordinator</span>
            <strong>{c.faculty.name}</strong>
            <a href={`tel:${c.faculty.phone.replace(/\s/g, "")}`}>{c.faculty.phone}</a>
          </div>

          <div className="contact-group">
            <span className="contact-label">Student Co-ordinators</span>
            <ul className="contact-list">
              {c.students.map((s) => (
                <li key={s.name}>
                  <strong>{s.name}</strong>
                  <a href={`tel:${s.phone.replace(/\s/g, "")}`}>{s.phone}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <FestMemberCard />

        <a
          className="contact-map"
          href={c.mapLink}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open map to ${fest.institution.name} in Google Maps`}
        >
          <iframe
            src={c.mapEmbed}
            title={`Map to ${fest.institution.name}`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
            tabIndex="-1"
          />
        </a>
      </div>
    </footer>
  );
}
