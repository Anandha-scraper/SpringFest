import CountUp from "../reactbits/CountUp.jsx";
import { fest } from "../../content/fest.js";

export default function Stats() {
  return (
    <section id="stats" className="stats-strip">
      <div className="container stats-grid">
        {fest.stats.map((s) => (
          <div key={s.label} className="stat-tile">
            <div className="stat-value">
              {s.prefix}
              <CountUp to={s.value} duration={2} separator="," />
              {s.suffix}
            </div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
