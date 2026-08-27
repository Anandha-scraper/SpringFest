export default function StatusPill({ status }) {
  return <span className={`pill pill-${status || "unknown"}`}>{status || "unknown"}</span>;
}
