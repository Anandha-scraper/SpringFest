import { useCallback, useState } from "react";
import "@/styles/pages/admin/roles.css";
import Loader from "@/components/common/Loader.jsx";
import {
  getEventRollup,
  getEvents,
  getPeople,
  getVenues,
  setAssignments,
} from "@/api/client.js";
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

const load = () => Promise.all([getPeople(), getEvents(), getVenues(), getEventRollup()]);

export default function ManageRoles() {
  const fetcher = useCallback(load, []);
  const { data, error: loadError, loading, reload } = useApi(fetcher);
  const [people, events, venues, rollup] = data || [[], [], [], []];

  // The server rejects a clashing assignment; this holds its message per judge.
  const [conflict, setConflict] = useState(null); // { email, message }
  const [pending, setPending] = useState(null); // staged, awaiting confirmation

  const judges = people.filter((p) => p.role === "judge");
  const volunteers = people.filter((p) => p.role === "volunteer");
  const eventById = (id) => events.find((e) => e.id === id);
  const venueName = (id) => venues.find((v) => v.id === id)?.name || "Unassigned";

  const runPending = async () => {
    if (!pending) return;
    setConflict(null);
    try {
      await pending.run();
      await reload();
    } catch (err) {
      // A judge double-booked at the same time comes back as a 409 with the
      // clashing events named — show it against that judge's row.
      setConflict({ email: pending.email, message: err.message });
    }
    setPending(null);
  };

  const assignJudge = (judge, eventId) => {
    const ev = eventById(eventId);
    if (!ev) return;
    const next = [...(judge.event_ids || []), eventId];
    setPending({
      email: judge.email,
      title: `Assign ${judge.name || judge.email} to "${ev.name}"?`,
      body: `${ev.venue_name || "No venue"} · ${formatEventTime(ev)}`,
      run: () => setAssignments(judge.email, { event_ids: next }),
    });
  };

  const unassignJudge = (judge, eventId) => {
    const ev = eventById(eventId);
    const next = (judge.event_ids || []).filter((id) => id !== eventId);
    setPending({
      email: judge.email,
      title: `Remove "${ev?.name || eventId}" from ${judge.name || judge.email}?`,
      body: "The judge will no longer be assigned to this event.",
      run: () => setAssignments(judge.email, { event_ids: next }),
    });
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
      {/* ── Judges: assigned per event, never double-booked ─────── */}
      <section className="admin-panel">
        <div className="panel-head">
          <h2>Judges</h2>
          <span className="muted">{judges.length} judges</span>
        </div>

        {!judges.length ? (
          <p className="empty-state">No judges yet. Add one from the Add Roles page.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table data-table--compact">
              <thead>
                <tr>
                  <th>Judge</th>
                  <th>Assigned events</th>
                  <th>Assign to event</th>
                </tr>
              </thead>
              <tbody>
                {judges.map((j) => (
                  <tr key={j.email}>
                    <td>
                      <strong>{j.name || j.email}</strong>
                      <span className="cell-sub">{j.email}</span>
                    </td>
                    <td>
                      {!(j.event_ids || []).length ? (
                        <span className="cell-sub">No events assigned yet.</span>
                      ) : (
                        <ul className="assignment-list">
                          {j.event_ids.map((eventId) => {
                            const ev = eventById(eventId);
                            if (!ev) return null;
                            return (
                              <li key={eventId} className="assignment-chip">
                                <span>
                                  <strong>{ev.name}</strong>
                                  <span className="cell-sub">
                                    {ev.venue_name || "No venue"} · {formatEventTime(ev)}
                                  </span>
                                </span>
                                <button
                                  type="button"
                                  className="chip-remove"
                                  aria-label={`Remove ${ev.name}`}
                                  onClick={() => unassignJudge(j, eventId)}
                                >
                                  ×
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                      {conflict?.email === j.email && (
                        <p className="error assignment-error">{conflict.message}</p>
                      )}
                    </td>
                    <td>
                      <select
                        className="input input-sm"
                        value=""
                        onChange={(e) => assignJudge(j, e.target.value)}
                      >
                        <option value="">Choose an event…</option>
                        {events
                          .filter((ev) => !(j.event_ids || []).includes(ev.id))
                          .map((ev) => (
                            <option key={ev.id} value={ev.id}>
                              {ev.name} — {formatEventTime(ev)}
                            </option>
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

      {/* ── Volunteers: general duty per venue ───────────────────── */}
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
          far the judging has got. Both bars are empty until the event's own
          start time passes — the server sends `progress: null` for that, so
          "not started" and "started, nothing judged" stay distinguishable. */}
      <div className="venue-grid">
        {rollup.map((ev) => {
          const total = ev.registrations || 0;
          const pct = (n) => (total ? (n / total) * 100 : 0);
          return (
            <section className="admin-panel venue-card" key={ev.event_id}>
              <div className="panel-head">
                <h2>{ev.name}</h2>
                <span className={`pill ${ev.started ? "pill-completed" : "pill-draft"}`}>
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
                      style={{ width: `${pct(ev.checked_in)}%` }}
                    />
                    <span
                      className="bar-fill bar-fill--done"
                      style={{ width: `${pct(ev.evaluated)}%` }}
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

              {(ev.judges.length > 0 || ev.volunteers.length > 0) && (
                <div className="venue-staff">
                  {ev.judges.map((name) => (
                    <span key={name} className="pill pill-judge">{name}</span>
                  ))}
                  {ev.volunteers.map((name) => (
                    <span key={name} className="pill pill-volunteer">{name}</span>
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
