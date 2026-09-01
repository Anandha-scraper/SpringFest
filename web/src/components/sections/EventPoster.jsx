"use client";

import { useState } from "react";
import { CalendarDays, Clock, Wallet } from "lucide-react";
import "@/styles/components/event-poster.css";
import ComicButton from "@/components/common/ComicButton.jsx";
import { formatEventDate, formatEventTimeRange, rupees } from "@/utils/format.js";

/**
 * A single event as a torn-paper "doodle poster".
 *
 * Front (details): category label, event name, date, time, registration fee.
 * The toggle flips it to that event's participant `instructions` and recolors
 * the poster into the dark "mood" palette.
 *
 * Ported from the supplied styled-components "doodlepro" Card — the doodle
 * decoration is kept; the text area is a flowing flex column, and the mood
 * switch is React state (`is-flipped` class) rather than a CSS `:checked` id,
 * so several posters on one page don't collide.
 *
 * @param {{ event: object, onRegister?: () => void }} props - event in the
 *   public API shape ({ name, category, date, start_time, end_time, fee,
 *   instructions, ... }). `onRegister` is the same sign-in entry point the
 *   hero's Register button uses.
 */
export default function EventPoster({ event, onRegister }) {
  const [flipped, setFlipped] = useState(false);

  const date = formatEventDate(event) || "Date TBA";
  const time = formatEventTimeRange(event) || "Time TBA";
  const fee = Number(event?.fee) > 0 ? rupees(event.fee) : "Free";
  const instructions = (event?.instructions || "").trim();

  return (
    <div className={`doodlepro${flipped ? " is-flipped" : ""}`}>
      <button
        type="button"
        className="doodlepro__toggle"
        aria-pressed={flipped}
        onClick={() => setFlipped((f) => !f)}
      >
        <span className="doodlepro__toggle-icon" aria-hidden="true" />
        {flipped ? "Details" : "Instructions"}
      </button>

      <div className="doodlepro__stage">
        <article className="doodlepro__poster">
          <span className="doodlepro__grain" aria-hidden="true" />
          <span className="doodlepro__grid" aria-hidden="true" />
          <span className="doodlepro__tape doodlepro__tape--left" aria-hidden="true" />
          <span className="doodlepro__tape doodlepro__tape--right" aria-hidden="true" />
          <span className="doodlepro__dot doodlepro__dot--one" aria-hidden="true" />
          <span className="doodlepro__dot doodlepro__dot--two" aria-hidden="true" />
          <span className="doodlepro__dot doodlepro__dot--three" aria-hidden="true" />
          <span className="doodlepro__star doodlepro__star--one" aria-hidden="true" />
          <span className="doodlepro__star doodlepro__star--two" aria-hidden="true" />
          <span className="doodlepro__scribble doodlepro__scribble--one" aria-hidden="true" />
          <span className="doodlepro__scribble doodlepro__scribble--two" aria-hidden="true" />
          <span className="doodlepro__arrow" aria-hidden="true" />

          <div className="doodlepro__content">
            <span className="doodlepro__label">{event?.category || "Event"}</span>
            <h3 className="doodlepro__title">{event?.name || "Untitled event"}</h3>
            <span className="doodlepro__underline" aria-hidden="true" />

            {flipped ? (
              <p
                className={`doodlepro__instructions${
                  instructions ? "" : " doodlepro__instructions--empty"
                }`}
              >
                {instructions || "Instructions will be shared soon."}
              </p>
            ) : (
              <ul className="doodlepro__meta">
                <li>
                  <CalendarDays size={16} aria-hidden="true" />
                  {date}
                </li>
                <li>
                  <Clock size={16} aria-hidden="true" />
                  {time}
                </li>
                <li>
                  <Wallet size={16} aria-hidden="true" />
                  {fee}
                </li>
              </ul>
            )}

            <div className="doodlepro__ribbon" aria-hidden="true">
              <div className="doodlepro__ribbon-track">
                <span>Spring Fest 2k26 · Register Now · </span>
                <span>Spring Fest 2k26 · Register Now · </span>
                <span>Spring Fest 2k26 · Register Now · </span>
              </div>
            </div>

            <div className="doodlepro__footer">
              <ComicButton
                className="doodlepro__register"
                label="REGISTER"
                onClick={onRegister}
              />
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
