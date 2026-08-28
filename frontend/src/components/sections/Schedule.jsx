import { Suspense, lazy } from "react";
import Shuffle from "../reactbits/Shuffle.jsx";

// @xyflow/react (+ its CSS) only loads once this section mounts, instead of
// shipping in the initial bundle for every visitor.
const ScheduleFlow = lazy(() => import("./ScheduleFlow.jsx"));

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

        <Suspense fallback={<div className="spinner" />}>
          <ScheduleFlow />
        </Suspense>
      </div>
    </section>
  );
}
