"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { saveEventFeedback } from "@/api/client.js";

const RATINGS = [1, 2, 3, 4, 5];
const MAX_COMMENT = 1000;

/**
 * "How was it?" on a registration card — one rating and comment per *person*,
 * so every member of a team gets their own say rather than the lead answering
 * for everyone.
 *
 * `state` comes from the server (`feedback_state` on the registration row) and
 * is never recomputed here: the window is a wall-clock comparison in the fest's
 * own timezone, and a browser elsewhere would get the midnight boundary wrong.
 * The four states are distinct on purpose — "hasn't happened yet" must not read
 * as "you missed it".
 */
export default function EventFeedback({ registrationId, initial, state, closesAt }) {
  const [saved, setSaved] = useState(initial || null);
  const [rating, setRating] = useState(initial?.rating || 0);
  const [comment, setComment] = useState(initial?.comment || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [justSaved, setJustSaved] = useState(false);

  const day = (closesAt || "").split("T")[0];

  if (state === "before") {
    return <p className="muted event-card__feedback">Feedback opens on the day of the event.</p>;
  }

  if (state === "closed") {
    if (!saved) {
      return <p className="muted event-card__feedback">Feedback for this event has closed.</p>;
    }
    return (
      <div className="event-card__feedback">
        <p className="event-card__feedback-read">
          <Stars value={saved.rating} />
          {saved.comment && <span className="event-card__feedback-text">{saved.comment}</span>}
        </p>
        <p className="muted">Feedback closed{day ? ` on ${day}` : ""}.</p>
      </div>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    if (!rating) return setError("Pick a rating first.");
    setError("");
    setBusy(true);
    try {
      const entry = await saveEventFeedback(registrationId, { rating, comment });
      setSaved(entry);
      setJustSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="event-card__feedback" onSubmit={submit}>
      <span className="event-card__feedback-label">How was it?</span>

      <div className="event-card__feedback-stars" role="radiogroup" aria-label="Rating">
        {RATINGS.map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} out of 5`}
            className={`event-card__star${n <= rating ? " is-on" : ""}`}
            disabled={busy}
            onClick={() => {
              setRating(n);
              setJustSaved(false);
            }}
          >
            <Star size={18} aria-hidden="true" />
          </button>
        ))}
      </div>

      <textarea
        className="input"
        rows={2}
        maxLength={MAX_COMMENT}
        placeholder="Anything else? (optional)"
        value={comment}
        disabled={busy}
        onChange={(e) => {
          setComment(e.target.value);
          setJustSaved(false);
        }}
      />

      <div className="event-card__feedback-actions">
        <button type="submit" className="btn btn-sm" disabled={busy || !rating}>
          {busy ? "Saving…" : saved ? "Update feedback" : "Save feedback"}
        </button>
        {justSaved && <span className="muted">Saved — you can edit it until the day ends.</span>}
      </div>

      {error && <p className="error">{error}</p>}
    </form>
  );
}

function Stars({ value }) {
  return (
    <span className="event-card__feedback-stars" aria-label={`${value} out of 5`}>
      {RATINGS.map((n) => (
        <Star
          key={n}
          size={16}
          aria-hidden="true"
          className={`event-card__star${n <= value ? " is-on" : ""}`}
        />
      ))}
    </span>
  );
}
