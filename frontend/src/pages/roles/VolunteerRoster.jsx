import { useCallback, useEffect, useState } from "react";
import "@/styles/pages/admin/roles.css";
import { CheckCircle2, Circle } from "lucide-react";
import { getVolunteerRoster, getVolunteerSummary, toggleCheckIn } from "@/api/client.js";
import { useToast } from "@/components/ui/toast.jsx";
import Loader from "@/components/common/Loader.jsx";
import { useHeldLoading } from "@/hooks/useHeldLoading.js";
import JudgingQueueView from "@/components/roles/JudgingQueueView.jsx";

export default function VolunteerRoster() {
  const toast = useToast();
  const [roster, setRoster] = useState(null);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const loading = useHeldLoading(!roster || !summary);

  const load = useCallback(() => {
    setError("");
    Promise.all([getVolunteerRoster(), getVolunteerSummary()])
      .then(([r, s]) => {
        setRoster(r);
        setSummary(s);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  const toggle = (regId, memberIndex, checkedIn) => {
    const key = `${regId}.${memberIndex}`;
    setBusyKey(key);
    toggleCheckIn(regId, memberIndex, checkedIn)
      .then(() => {
        setRoster((r) => ({
          ...r,
          participants: r.participants.map((p) =>
            p.registration_id === regId
              ? {
                  ...p,
                  holders: p.holders.map((h) =>
                    h.member_index === memberIndex ? { ...h, checked_in: checkedIn } : h
                  ),
                }
              : p
          ),
        }));
      })
      .catch((e) => toast.bad(e.message))
      .finally(() => setBusyKey(""));
  };

  if (error) return <p className="error">{error}</p>;
  if (loading || !roster || !summary) return <Loader />;

  return (
    <section className="admin-panel">
      <div className="panel-head">
        <h2>Roster</h2>
        {summary.event && <span className="muted">{summary.event.name}</span>}
      </div>

      {summary.event && (
        <div className="notice" style={{ marginBottom: "1rem" }}>
          <JudgingQueueView current={summary.now_evaluating} upcoming={summary.up_next} />
        </div>
      )}

      {roster.participants.length === 0 ? (
        <p className="empty-state">No confirmed teams for your event yet.</p>
      ) : (
        <ul className="checkin-row-list" style={{ display: "grid", gap: ".75rem" }}>
          {roster.participants.map((p) => (
            <li
              key={p.registration_id}
              /* Already scored reads as dimmed but stays fully interactive —
                 check-in must keep working after a team has been judged. */
              className={`assignment-chip${p.evaluated ? " is-evaluated" : ""}`}
              style={{ flexDirection: "column", alignItems: "stretch" }}
            >
              <strong>{p.team_name || p.lead_name}</strong>
              <ul style={{ listStyle: "none", padding: 0, margin: ".25rem 0 0", display: "grid", gap: ".35rem" }}>
                {p.holders.map((h) => (
                  <li key={h.member_index} style={{ display: "flex", justifyContent: "space-between", gap: ".5rem" }}>
                    <span>
                      {h.name}
                      {h.allocation_code && (
                        <span className="checkin-row__code" style={{ marginLeft: 6 }}>
                          {h.allocation_code}
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      className={`btn btn-sm ${h.checked_in ? "btn-ghost" : ""}`}
                      disabled={busyKey === `${p.registration_id}.${h.member_index}`}
                      onClick={() => toggle(p.registration_id, h.member_index, !h.checked_in)}
                    >
                      {h.checked_in ? (
                        <>
                          <CheckCircle2 size={14} /> In
                        </>
                      ) : (
                        <>
                          <Circle size={14} /> Check in
                        </>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
