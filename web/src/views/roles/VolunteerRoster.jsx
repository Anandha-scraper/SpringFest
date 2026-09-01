"use client";

import { useCallback, useEffect, useState } from "react";
import "@/styles/pages/admin/roles.css";
import { CheckCircle2, Circle, FileText } from "lucide-react";
import { getVolunteerRoster, getVolunteerSummary, toggleCheckIn, volunteerSubmissionObjectUrl } from "@/api/client.js";
import { useToast } from "@/components/ui/toast.jsx";
import Loader from "@/components/common/Loader.jsx";
import { useDeferredLoading } from "@/hooks/useDeferredLoading.js";
import { useLiveResource } from "@/live/LiveUpdates.jsx";

export default function VolunteerRoster() {
  const toast = useToast();
  const [roster, setRoster] = useState(null);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const loading = useDeferredLoading(!roster || !summary);

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
  // The roster is the screen most likely to be open while someone else is
  // checking people in — at the next desk, or on the volunteer's own phone.
  useLiveResource("registrations", load);

  // Check-in only — one-way. There is no toggle back to unchecked; the
  // backend rejects `checked_in: false` outright (services/checkin.service.js).
  const checkIn = (regId, memberIndex) => {
    const key = `${regId}.${memberIndex}`;
    setBusyKey(key);
    toggleCheckIn(regId, memberIndex, true)
      .then(() => {
        setRoster((r) => ({
          ...r,
          participants: r.participants.map((p) =>
            p.registration_id === regId
              ? {
                  ...p,
                  holders: p.holders.map((h) =>
                    h.member_index === memberIndex ? { ...h, checked_in: true } : h
                  ),
                }
              : p
          ),
        }));
      })
      .catch((e) => toast.bad(e.message))
      .finally(() => setBusyKey(""));
  };

  const openSubmission = async (registrationId) => {
    try {
      const url = await volunteerSubmissionObjectUrl(registrationId);
      window.open(url, "_blank", "noopener");
    } catch (err) {
      toast.bad(err.message);
    }
  };

  if (error) return <p className="error">{error}</p>;
  if (loading || !roster || !summary) return <Loader />;

  return (
    <section className="admin-panel">
      <div className="panel-head">
        <h2>Roster</h2>
        {summary.event && <span className="muted">{summary.event.name}</span>}
      </div>

      {roster.participants.length === 0 ? (
        <p className="empty-state">No confirmed teams for your event yet.</p>
      ) : (
        <ul className="checkin-row-list">
          {roster.participants.map((p) => (
            <li key={p.registration_id} className="roster-team">
              <div className="roster-team__head">
                <strong>{p.team_name || p.lead_name}</strong>
                {p.has_submission && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => openSubmission(p.registration_id)}
                  >
                    <FileText size={14} aria-hidden="true" /> View submission
                  </button>
                )}
              </div>
              <ul className="roster-holders">
                {p.holders.map((h) => (
                  <li key={h.member_index} className="roster-holder">
                    <span className="roster-holder__name">
                      {h.name}
                      {h.allocation_code && (
                        <span className="checkin-row__code">{h.allocation_code}</span>
                      )}
                    </span>
                    {h.checked_in ? (
                      // One-way: once in, this is a fact, not a control — no
                      // button, nothing left to click.
                      <span className="roster-holder__mark">
                        <CheckCircle2 size={14} aria-hidden="true" /> Checked in
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-sm"
                        disabled={busyKey === `${p.registration_id}.${h.member_index}`}
                        onClick={() => checkIn(p.registration_id, h.member_index)}
                      >
                        <Circle size={14} aria-hidden="true" /> Check in
                      </button>
                    )}
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
