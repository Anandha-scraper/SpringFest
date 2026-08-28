import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import SpotlightCard from "../reactbits/SpotlightCard.jsx";
import AnimatedContent from "../reactbits/AnimatedContent.jsx";
import SplitFlapText from "../reactbits/SplitFlapText.jsx";
import BubbleMenu from "../reactbits/BubbleMenu.jsx";

import { getEvents } from "../../api/client.js";
import { eventTrackItems } from "../../content/fest.js";

// three.js/fiber/drei/rapier/meshline + the 2.4MB card.glb only load once
// this section actually mounts, not as part of the initial bundle. The
// Suspense boundary below already covers it — nothing else changes.
const Lanyard = lazy(() => import("../reactbits/lanyard/Lanyard.jsx"));


export default function EventsPreview() {
  const [events, setEvents] = useState(null);
  const [tracksOpen, setTracksOpen] = useState(false);
  const sectionRef = useRef(null);

  useEffect(() => {
    getEvents()
      .then(setEvents)
      .catch(() => setEvents([]));
  }, []);

  // Open the track picker on its own as soon as the section comes into view,
  // and reset it once the section has fully left so it opens again next time.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.35) {
          setTracksOpen(true);
        } else if (!entry.isIntersecting) {
          setTracksOpen(false);
        }
      },
      { threshold: [0, 0.35, 0.6] }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const hasEvents = events && events.length > 0;

  return (
    <section id="events" className="section section-tint" ref={sectionRef}>
      <div className="container">
        <div className="events-top">
          <div className="events-left">
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

            <div className="events-bubble">
              <BubbleMenu
                logo={<span className="bubble-wordmark">Tracks</span>}
                items={eventTrackItems}
                menuAriaLabel="Browse event tracks"
                menuBg="#ffffff"
                menuContentColor="#11224e"
                useFixedPosition={false}
                animationEase="back.out(1.5)"
                animationDuration={0.45}
                staggerDelay={0.1}
                open={tracksOpen}
              />
            </div>
          </div>

          <div className="events-right">
            <Suspense fallback={null}>
              <Lanyard position={[0, 0, 20]} gravity={[0, -40, 0]} />
            </Suspense>
          </div>
        </div>

        {events === null ? (
          <div className="spinner" />
        ) : hasEvents ? (
          <div className="grid">
            {events.map((ev, i) => (
              <AnimatedContent key={ev.id} distance={50} duration={0.7} delay={0.05 * (i % 6)}>
                <Link to={`/events/${ev.id}`} className="event-link">
                  <SpotlightCard className="event-card" spotlightColor="rgba(248, 123, 27, 0.20)">
                    {ev.category && <span className="tag">{ev.category}</span>}
                    <h3>{ev.name}</h3>
                    <p>{ev.description}</p>
                    <div className="card-meta">
                      <span>{ev.date}</span>
                      <span className="price">{ev.fee > 0 ? `₹${ev.fee}` : "Free"}</span>
                    </div>
                  </SpotlightCard>
                </Link>
              </AnimatedContent>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
