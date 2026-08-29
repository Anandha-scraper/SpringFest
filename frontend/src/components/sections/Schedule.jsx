import Shuffle from "../reactbits/Shuffle.jsx";
import ScheduleFlow from "./ScheduleFlow.jsx";

export default function Schedule() {
  return (
    <section id="schedule" className="section">
      <div className="container">
        <div className="schedule-head">
          <Shuffle
            text="Schedule"
            tag="h2"
            textAlign="left"
            shuffleDirection="right"
            duration={0.35}
            animationMode="evenodd"
            shuffleTimes={1}
            ease="power3.out"
            stagger={0.03}
            threshold={0.1}
            triggerOnce
            triggerOnHover
            respectReducedMotion
          />
        </div>

        <ScheduleFlow />
      </div>
    </section>
  );
}