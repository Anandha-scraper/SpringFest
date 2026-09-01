"use client";

import SplitFlapText from "@/components/animation/SplitFlapText.jsx";
import ScheduleFlow from "@/components/sections/ScheduleFlow.jsx";

export default function Schedule() {
  return (
    <section id="schedule" className="section">
      <div className="container">
        <div className="schedule-head">
          <SplitFlapText
            text="SCHEDULE"
            padTo={8}
            tileColor="#11224e"
            textColor="#eeeeee"
            tileRadius={12}
            gap={10}
            fontSize="clamp(2.2rem, 6vw, 4.4rem)"
          />
        </div>

        <ScheduleFlow />
      </div>
    </section>
  );
}