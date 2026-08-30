import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import SplitFlapText from "@/components/animation/SplitFlapText.jsx";
import TrackCard from "@/components/common/TrackCard.jsx";
import EventPoster from "@/components/sections/EventPoster.jsx";
import ComicButton from "@/components/common/ComicButton.jsx";
import Loader from "@/components/common/Loader.jsx";
import SignInModal from "@/components/common/SignInModal.jsx";
import { useAuth } from "@/auth/AuthContext.jsx";
import { useApi } from "@/hooks/useApi.js";
import { getEvents } from "@/api/client.js";
import { EVENT_CATEGORIES } from "@/content/formOptions.js";
import { homeForRole } from "@/content/roles.js";

// One card per event category — order and labels come from EVENT_CATEGORIES so
// this stays in sync with the categories the backend accepts.
const TRACK_META = {
  Technical: { image: "/events/technical.svg", accent: "#E14E1D", tint: "#f4dbda" },
  "Non-Technical": { image: "/events/non-technical.svg", accent: "#10b981", tint: "#dcf5e7" },
  Hackathon: { image: "/events/hackathon.svg", accent: "#6366f1", tint: "#e6e8fd" },
  Workshop: { image: "/events/workshop.svg", accent: "#f59e0b", tint: "#fef3d9" },
};
const TRACKS = EVENT_CATEGORIES.map((label) => ({ label, ...TRACK_META[label] }));

export default function EventsPreview() {
  // Public endpoint. A slow/failed fetch just leaves every category looking
  // empty (and inert) — the four static cards still render either way.
  const { data, loading } = useApi(getEvents);
  const [selected, setSelected] = useState(null);
  const { user, role } = useAuth();
  const [signInOpen, setSignInOpen] = useState(false);
  const navigate = useNavigate();

  // Same sign-in entry point as the hero's Register button: signed in goes
  // straight to the role dashboard, otherwise open the sign-in card.
  const handleRegister = () => {
    if (user) navigate(homeForRole(role));
    else setSignInOpen(true);
  };

  const byCategory = (data || []).reduce((map, event) => {
    (map[event.category] ||= []).push(event);
    return map;
  }, {});
  const eventsFor = (label) => byCategory[label] || [];

  // If a selection resolves to an empty (or failed) category, fall back to the grid.
  useEffect(() => {
    if (!loading && selected && eventsFor(selected).length === 0) setSelected(null);
  }, [loading, selected, data]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (label) => {
    // Categories with no events are inert once we know that — allowed while loading.
    if (label !== selected && !loading && eventsFor(label).length === 0) return;
    setSelected((current) => (current === label ? null : label));
  };

  const shownTracks = selected ? TRACKS.filter((t) => t.label === selected) : TRACKS;

  return (
    <section id="events" className="section section-tint">
      <div className="container">
        <div className="events-top">
          <div className="events-flap">
            <SplitFlapText
              text="EVENTS"
              padTo={6}
              tileColor="#11224e"
              textColor="#eeeeee"
              tileRadius={12}
              gap={10}
              fontSize="clamp(2.2rem, 6vw, 4.4rem)"
            />
          </div>
          <ComicButton
            className="events-hint-btn"
            label="TAP A TRACK TO SEE EVENT DETAILS"
          />
        </div>

        <div className="events-lineup">
          {shownTracks.map((track) => (
            <TrackCard
              key={track.label}
              {...track}
              expanded={selected === track.label}
              onClick={() => toggle(track.label)}
            />
          ))}

          {selected && (
            <div className={`events-scatter${loading ? " events-scatter--status" : ""}`}>
              {loading ? (
                <Loader />
              ) : (
                eventsFor(selected).map((event) => (
                  <EventPoster key={event.id} event={event} onRegister={handleRegister} />
                ))
              )}
            </div>
          )}
        </div>

        <SignInModal open={signInOpen} onClose={() => setSignInOpen(false)} />
      </div>
    </section>
  );
}
