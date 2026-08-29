import { useState } from "react";
import { useNavigate } from "react-router-dom";
import SplitFlapText from "../reactbits/SplitFlapText.jsx";
import TrackCard from "../TrackCard.jsx";
import SignInModal from "../SignInModal.jsx";
import { useAuth } from "../../auth/AuthContext.jsx";
import { homeForRole } from "../../content/roles.js";

// Fixed track cards — the actual per-event list lives behind registration.
const TRACKS = [
  { label: "Technical", image: "/events/technical.svg", accent: "#E14E1D", tint: "#f4dbda" },
  { label: "Non-Technical", image: "/events/nontechincal.svg", accent: "#10b981", tint: "#dcf5e7" },
  { label: "Hackathon", image: "/events/hackathon.svg", accent: "#6366f1", tint: "#e6e8fd" },
  { label: "Workshop", image: "/events/workshop.svg", accent: "#f59e0b", tint: "#fef3d9" },
];

export default function EventsPreview() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [signInOpen, setSignInOpen] = useState(false);

  // Same behaviour as the hero Register button: signed in go to your role
  // dashboard, otherwise open the sign-in modal.
  const handleTrackClick = () => {
    if (user) navigate(homeForRole(role));
    else setSignInOpen(true);
  };

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

        <div className="track-grid">
          {TRACKS.map((track) => (
            <TrackCard key={track.label} {...track} onClick={handleTrackClick} />
          ))}
        </div>
      </div>

      <SignInModal open={signInOpen} onClose={() => setSignInOpen(false)} />
    </section>
  );
}