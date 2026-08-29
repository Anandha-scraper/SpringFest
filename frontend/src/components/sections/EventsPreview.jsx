import { useEffect, useState } from "react";
import SplitFlapText from "../reactbits/SplitFlapText.jsx";
import ChromaGrid from "../reactbits/ChromaGrid.jsx";

import { getEvents } from "../../api/client.js";

// Card tint per grid slot until event artwork lands; gradients stay dark so
// the white name/description text keeps contrast.
const CARD_TONES = [
  { border: "#f87b1b" }, // orange
  { border: "#11224e" }, // navy
  { border: "#9bb15f" }, // sage
  { border: "#f5a55c" }, // peach
];

export default function EventsPreview() {
  const [events, setEvents] = useState(null);

  useEffect(() => {
    getEvents()
      .then(setEvents)
      .catch(() => setEvents([]));
  }, []);

  const items = (events ?? []).map((ev, i) => {
    const tone = CARD_TONES[i % CARD_TONES.length];
    return {
      title: ev.name,
      subtitle: ev.description,
      borderColor: tone.border,
      gradient: `linear-gradient(165deg, ${tone.border}, #0d1526)`,
      url: `/events/${ev.id}`,
    };
  });

  const hasEvents = events && events.length > 0;

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
        </div>

        {events === null ? (
          <div className="spinner" />
        ) : hasEvents ? (
          <ChromaGrid items={items} columns={4} radius={260} />
        ) : null}
      </div>
    </section>
  );
}