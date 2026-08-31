"use client";

import { useCallback, useState } from "react";
import "@/styles/pages/admin/roles.css";
import Loader from "@/components/common/Loader.jsx";
import { getEventRollup, getPeople, getVenues, setAssignments } from "@/api/client.js";
import { useApi } from "@/hooks/useApi.js";
import { formatEventTime } from "@/utils/format.js";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.jsx";

const load = () => Promise.all([getPeople(), getVenues(), getEventRollup()]);

export default function ManageRoles() {
  const fetcher = useCallback(load, []);
  const { data, error: loadError, loading, reload } = useApi(fetcher);
  const [people, venues, rollup] = data || [[], [], []];

  // A rejected assignment (unknown venue, wrong role) is shown against the
  // row that caused it rather than as a page-level error.
  const [conflict, setConflict] = useState(null); // { email, message }
  const [pending, setPending] = useState(null); // staged, awaiting confirmation

  const volunteers = people.filter((p) => p.role === "volunteer");
  const venueName = (id) => venues.find((v) => v.id === id)?.name || "Unassigned";

  const runPending = async () => {
    if (!pending) return;
    setConflict(null);
    try {
      await pending.run();
      await reload();
    } catch (err) {
      setConflict({ email: pending.email, message: err.message });
    }
    setPending(null);
  };

  const allocateVenue = (person, venueId) => {
    const target = venues.find((v) => v.id === venueId);
    setPending({
      email: person.email,
      title: venueId
        ? `Allocate ${person.name || person.email} to ${target.name}?`
        : `Unassign ${person.name || person.email}?`,
      body: person.venue_id
        ? `Currently at ${venueName(person.venue_id)}.`
        : "The volunteer will be on general duty at this venue.",
      run: () => setAssignments(person.email, { venue_id: venueId }),
    });
  };

  if (loading) return <Loader />;
  if (loadError) return <p className="error">{loadError}</p>;

  return (
    <div className="admin">
      {/* ── Volunteers: one venue each — they check in AND score ── */}
      <section className="admin-panel">
        <div className="panel-head">
          <h2>Volunteers</h2>
          <span className="muted">{volunteers.length} volunteers</span>
        </div>

        {!volunteers.length ? (
          <p className="empty-state">No volunteers yet. Add one from the Add Roles page.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table data-table--compact">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Venue</th>
                  <th>Change venue</th>
                </tr>
              </thead>
              <tbody>
                {volunteers.map((p) => (
                  <tr key={p.email}>
                    <td>
                      <strong>{p.name || p.email}</strong>
                      <span className="cell-sub">{p.email}</span>
                    </td>
                    <td>
                      {p.venue_id ? venueName(p.venue_id) : <span className="cell-sub">Unassigned</span>}
                      {conflict?.email === p.email && (
                        <p className="error assignment-error">{conflict.message}</p>
                      )}
                    </td>
                    <td>
                      <select
                        className="input input-sm"
                        value={p.venue_id || ""}
                        onChange={(e) => {
                          if (e.target.value !== (p.venue_id || "")) allocateVenue(p, e.target.value);
                        }}
                      >
                        <option value="">Unassign</option>
                        {venues.map((v) => (
                          <option key={v.id} value={v.id}>{v.name}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Progress per event ───────────────────────────────────────
          Organisers think in events, not venues: who has turned up, and how
          far the scoring has got. Both bars are empty until the event's own
          start time passes — the server sends `progress: null` for that, so
          "not started" and "started, nothing scored" stay distinguishable. */}
      <div className="venue-grid">
        {rollup.map((ev) => {
          const total = ev.registrations || 0;
          const pct = (n) => (total ? (n / total) * 100 : 0);
          return (
            <section className="admin-panel venue-card" key={ev.event_id}>
              <div className="panel-head">
                <h2>{ev.name}</h2>
                <span className={`status-pill ${ev.started ? "status-pill--completed" : "status-pill--draft"}`}>
                  {ev.started ? `${ev.checked_in}/${total}` : "Not started"}
                </span>
              </div>
              <span className="cell-sub">
                {ev.venue_name || "No venue"}
                {ev.date ? ` · ${formatEventTime(ev)}` : ""}
              </span>

              {ev.started ? (
                <>
                  {/* Checked in (green) behind evaluated (accent), both over
                      the same total, so the two read as one progression. */}
                  <span className="bar-track event-progress">
                    <span
                      className="bar-fill bar-fill--in"
                      style={{ "--bar-pct": `${pct(ev.checked_in)}%` }}
                    />
                    <span
                      className="bar-fill bar-fill--done"
                      style={{ "--bar-pct": `${pct(ev.evaluated)}%` }}
                    />
                  </span>
                  <div className="venue-stat-row">
                    <span><strong>{total}</strong> registered</span>
                    <span><strong>{ev.checked_in}</strong> checked in</span>
                    <span><strong>{ev.evaluated}</strong> evaluated</span>
                  </div>
                </>
              ) : (
                <>
                  <span className="bar-track event-progress" aria-hidden="true" />
                  <div className="venue-stat-row">
                    <span><strong>{total}</strong> registered</span>
                    <span className="muted">Progress starts when the event does</span>
                  </div>
                </>
              )}

              {ev.volunteers.length > 0 && (
                <div className="venue-staff">
                  {ev.volunteers.map((name) => (
                    <span key={name} className="status-pill status-pill--volunteer">{name}</span>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pending?.title}</AlertDialogTitle>
            <AlertDialogDescription>{pending?.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={runPending}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
