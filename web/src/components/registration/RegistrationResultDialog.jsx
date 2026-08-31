"use client";

import { useEffect } from "react";
import { CheckCircle2, Clock3 } from "lucide-react";
import { fest } from "@/content/fest.js";

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
  useEffect(() => {
    if (!open) return undefined;
    const timer = setTimeout(onDone, REDIRECT_MS);
    const onKey = (e) => e.key === "Escape" && onDone();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onDone]);

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

        <p className="muted reg-result__hint">Taking you to your dashboard…</p>
      </div>
    </div>
  );
}
