"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock3, MessageCircle } from "lucide-react";
import { fest } from "@/content/fest.js";
import { useAuth } from "@/auth/AuthContext.jsx";

// Long enough to read the outcome and note the codes, short enough that
// nobody sits waiting for it. Dismissing early does the same thing.
const REDIRECT_MS = 5000;

/**
 * What happened to the registration that was just submitted, shown over the
 * event page for a few seconds before `onDone()` moves on.
 *
 * A modal rather than its own route: the answer is one sentence, and landing
 * back on the dashboard is where the participant wants to be anyway.
 */
export default function RegistrationResultDialog({
  open,
  awaiting,
  free,
  registrationId,
  codes = [],
  onDone,
}) {
  const { whatsappGroupUrl } = useAuth();
  // Opening the group link cancels the auto-redirect: sending someone to
  // WhatsApp and then navigating the page out from under them means they come
  // back to somewhere they didn't ask for. They dismiss it themselves instead.
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const timer = held ? null : setTimeout(onDone, REDIRECT_MS);
    const onKey = (e) => e.key === "Escape" && onDone();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onDone, held]);

  if (!open) return null;

  const shown = codes.filter(Boolean);

  return (
    <div
      className="reg-result"
      onClick={onDone}
      role="dialog"
      aria-modal="true"
      aria-label="Registration result"
    >
      <div className="reg-result__card center" onClick={(e) => e.stopPropagation()}>
        <div className="success-mark">
          {awaiting ? (
            <Clock3 size={52} strokeWidth={1.5} aria-hidden="true" />
          ) : (
            <CheckCircle2 size={52} strokeWidth={1.5} aria-hidden="true" />
          )}
        </div>

        <h2>
          {awaiting ? (free ? "Registration submitted" : "Payment submitted") : "You're in!"}
        </h2>

        <p className="muted success-lead">
          {awaiting ? (
            <>
              Your place at {fest.name} {fest.year} is held while an organiser{" "}
              {free ? "confirms your registration" : "checks your payment"}. You'll see the
              result — and your entry pass — under My Registrations.
            </>
          ) : (
            <>
              Your registration for {fest.name} {fest.year} is confirmed. Your entry pass is
              ready under My Registrations.
            </>
          )}
        </p>

        {shown.length > 0 && (
          <div className="success-ticket">
            <span className="reg-result__label">
              Your allocation code{shown.length > 1 ? "s" : ""}
            </span>
            <span className="success-ticket__codes">
              {shown.map((c) => (
                <code className="reg-id" key={c}>{c}</code>
              ))}
            </span>
          </div>
        )}

        {registrationId && !shown.length && (
          <div className="success-ticket">
            <span className="reg-result__label">Registration ID</span>
            <code className="reg-id">{registrationId}</code>
          </div>
        )}

        {/* The one moment someone is most likely to actually join the group.
            The auto-redirect below would take it away after five seconds, so
            clicking through cancels it — opening the link and then yanking the
            page out from under them is worse than staying put. */}
        {whatsappGroupUrl && (
          <a
            className="btn btn-sm reg-result__group"
            href={whatsappGroupUrl}
            target="_blank"
            rel="noreferrer noopener"
            onClick={(e) => {
              e.stopPropagation();
              setHeld(true);
            }}
          >
            <MessageCircle size={15} aria-hidden="true" /> Join the WhatsApp group
          </a>
        )}

        <p className="muted reg-result__hint">
          {held ? "Close this when you're ready." : "Taking you to your dashboard…"}
        </p>
      </div>
    </div>
  );
}
