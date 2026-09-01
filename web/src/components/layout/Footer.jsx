"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fest } from "@/content/fest.js";
import FestMemberCard from "@/components/common/FestMemberCard.jsx";
import { venueAccess } from "@/api/client.js";
import { useVenueAccess } from "@/venue/VenueAccessContext.jsx";

/** Staff access — a code an admin generates per event, unlocking that
 *  event's checked-in teams and their submission files. Permanently visible,
 *  not an easter egg; the code is the only real credential here, so hiding
 *  the door adds nothing.
 *
 *  Resolves the code up front, in the footer, so a wrong one never leaves
 *  the visitor anywhere but the page they were already on. Only a valid code
 *  navigates, and the resolved view — never the code's own request/response
 *  — goes into VenueAccessContext, off the URL entirely. */
function VenueAccessForm() {
  const router = useRouter();
  const { setView } = useVenueAccess();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    setError("");
    setBusy(true);
    try {
      const resolved = await venueAccess(trimmed);
      setView({ code: trimmed, ...resolved });
      setCode("");
      router.push("/venue");
    } catch (err) {
      // The server already gives one identical message for a blank, unknown
      // or revoked code — shown verbatim, not reworded into something that
      // might accidentally distinguish the cases it deliberately doesn't.
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="venue-access-form" onSubmit={submit}>
      <label htmlFor="venue-access-code" className="venue-access-form__label">
        Staff access code
      </label>
      <div className="venue-access-form__row">
        <input
          id="venue-access-code"
          className="input"
          placeholder="Enter code"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setError("");
          }}
          autoComplete="off"
          spellCheck={false}
        />
        <button type="submit" className="btn btn-sm" disabled={busy || !code.trim()}>
          {busy ? "Checking…" : "Go"}
        </button>
      </div>
      {error && <p className="venue-access-form__error">{error}</p>}
    </form>
  );
}

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

          <VenueAccessForm />
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
