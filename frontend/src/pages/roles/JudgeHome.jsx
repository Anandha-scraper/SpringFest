import { useCallback } from "react";
import "@/styles/pages/admin/roles.css";
import { Link } from "react-router-dom";
import { getJudgeEvents } from "@/api/client.js";
import { useApi } from "@/hooks/useApi.js";
import { eventsOverlap, formatEventTime } from "@/utils/format.js";
import Loader from "@/components/common/Loader.jsx";

export default function JudgeHome() {
  const fetcher = useCallback(getJudgeEvents, []);
  const { data: events, error, loading } = useApi(fetcher);

  if (loading) return <Loader />;
  if (error) return <p className="error">{error}</p>;

  const list = [...(events || [])];

  return (
    <section className="admin-panel">
      <div className="panel-head">
        <h2>My assignments</h2>
        <span className="muted">
          {list.length} event{list.length === 1 ? "" : "s"}
        </span>
      </div>

      {!list.length ? (
        <p className="empty-state">No events assigned to you yet.</p>
      ) : (
        <ul className="assignment-list assignment-list-lg">
          {list.map((ev) => {
            const clash = list.find(
              (other) =>
                other.event_id !== ev.event_id &&
                eventsOverlap(
                  { date: ev.date, start_time: ev.start_time, end_time: ev.end_time },
                  { date: other.date, start_time: other.start_time, end_time: other.end_time }
                )
            );
            return (
              <li key={ev.event_id} className="assignment-chip">
                <span>
                  <strong>{ev.name}</strong>
                  <span className="cell-sub">
                    {formatEventTime(ev) || "Time TBA"} · {ev.checked_in} checked in ·{" "}
                    {ev.evaluated_by_me}/{ev.checked_in} scored by you
                  </span>
                  {ev.category && <span className="tag">{ev.category}</span>}
                  {!ev.marking_criteria?.length && (
                    <span className="status-pill status-pill--failed" title="No scoring criteria yet">
                      no criteria
                    </span>
                  )}
                </span>
                {clash && (
                  <span className="status-pill status-pill--failed" title={`Overlaps with ${clash.name}`}>
                    conflict
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {list.length > 0 && (
        <p className="muted" style={{ marginTop: "1rem" }}>
          Go to <Link to="/judge/scoring">Scoring</Link> to evaluate teams, or{" "}
          <Link to="/judge/queue">Queue</Link> to set who's on stage next.
        </p>
      )}
    </section>
  );
}
