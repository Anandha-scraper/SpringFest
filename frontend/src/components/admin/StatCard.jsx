import CountUp from "../reactbits/CountUp.jsx";

export default function StatCard({ label, value, prefix = "", tone = "", note = "" }) {
  return (
    <div className={`stat-card ${tone}`}>
      <span className="stat-card-label">{label}</span>
      <span className="stat-card-value">
        {prefix}
        <CountUp to={value ?? 0} duration={1.2} separator="," />
      </span>
      {/* For a number that is legitimately zero rather than missing. */}
      {note && <span className="stat-card-note">{note}</span>}
    </div>
  );
}
