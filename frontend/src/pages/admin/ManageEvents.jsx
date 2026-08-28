import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Trash2 } from "lucide-react";
import FormActions from "../../components/admin/FormActions.jsx";
import {
  addVenue,
  createEvent,
  getEvents,
  getVenues,
  removeEvent,
  removeVenue,
  updateEvent,
} from "../../api/client.js";
import { useApi } from "../../hooks/useApi.js";
import { formatEventTime, rupees } from "../../lib/format.js";
import { DatePicker } from "@/components/ui/date-picker.jsx";
import { TimePicker } from "@/components/ui/time-picker.jsx";
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

const CATEGORIES = ["Technical", "Non-Technical", "Hackathon", "Workshop"];

const blankForm = () => ({
  name: "",
  category: CATEGORIES[0],
  venue_id: "",
  date: "",
  start_time: "",
  end_time: "",
  fee: "",
  description: "",
  is_team_event: false,
  team_min: 2,
  team_max: 4,
});

const load = () => Promise.all([getEvents(), getVenues()]);

export default function ManageEvents() {
  const fetcher = useCallback(load, []);
  const { data, error: loadError, loading, reload } = useApi(fetcher);
  const [events, venues] = data || [[], []];

  const [form, setForm] = useState(blankForm);
  const [editing, setEditing] = useState(null); // the event being edited
  const [error, setError] = useState("");

  const [venueName, setVenueName] = useState("");
  const [venueError, setVenueError] = useState("");
  const [pending, setPending] = useState(null); // a staged destructive action

  // A venue backs at most one event, so only free venues are offered — plus
  // the one this event already holds, when editing.
  const availableVenues = useMemo(
    () =>
      venues.filter(
        (v) => !events.some((e) => e.venue_id === v.id && e.id !== editing?.id)
      ),
    [venues, events, editing]
  );

  const eventAtVenue = (venueId) => events.find((e) => e.venue_id === venueId);

  // Locked once anyone has registered: the terms they signed up to can't move.
  const locked = !!editing?.locked;

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const reset = () => {
    setForm(blankForm());
    setEditing(null);
    setError("");
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    const payload = {
      ...form,
      fee: Number(form.fee) || 0,
      team_min: Number(form.team_min) || 1,
      team_max: Number(form.team_max) || 1,
      is_team_event: !!form.is_team_event,
    };
    try {
      if (editing) {
        // Send only what's editable, so a locked field never triggers a 403
        // just by being present and unchanged.
        const editable = locked
          ? {
              venue_id: payload.venue_id,
              start_time: payload.start_time,
              end_time: payload.end_time,
              description: payload.description,
            }
          : payload;
        await updateEvent(editing.id, editable);
      } else {
        await createEvent(payload);
      }
      reset();
      await reload();
    } catch (err) {
      setError(err.message);
    }
  };

  const edit = (ev) => {
    setEditing(ev);
    setError("");
    setForm({
      name: ev.name,
      category: ev.category || CATEGORIES[0],
      venue_id: ev.venue_id || "",
      date: ev.date || "",
      start_time: ev.start_time || "",
      end_time: ev.end_time || "",
      fee: String(ev.fee ?? ""),
      description: ev.description || "",
      is_team_event: !!ev.is_team_event,
      team_min: ev.team_min ?? 2,
      team_max: ev.team_max ?? 4,
    });
  };

  const submitVenue = async (e) => {
    e.preventDefault();
    setVenueError("");
    if (!venueName.trim()) return;
    try {
      await addVenue({ name: venueName.trim() });
      setVenueName("");
      await reload();
    } catch (err) {
      setVenueError(err.message);
    }
  };

  const runPending = async () => {
    if (!pending) return;
    try {
      await pending.run();
      if (pending.type === "deleteEvent" && editing?.id === pending.id) reset();
      await reload();
      setError("");
      setVenueError("");
    } catch (err) {
      if (pending.type === "deleteVenue") setVenueError(err.message);
      else setError(err.message);
    }
    setPending(null);
  };

  if (loading) return <div className="spinner" />;
  if (loadError) return <p className="error">{loadError}</p>;

  return (
    <div className="admin">
      <div className="admin-head">
        <div>
          <span className="eyebrow">Organiser view</span>
          <h1>Events</h1>
          <p className="muted">Create events under each category and assign a venue.</p>
        </div>
      </div>

      {/* ── Venues: a name and nothing else ─────────────────────── */}
      <section className="admin-panel">
        <div className="panel-head">
          <h2>Venues</h2>
          <span className="muted">{venues.length} venues</span>
        </div>

        <form className="filter-bar" onSubmit={submitVenue}>
          <input
            className="input"
            required
            placeholder="Venue name"
            value={venueName}
            onChange={(e) => setVenueName(e.target.value)}
          />
          <FormActions saveLabel="Add venue" />
        </form>

        {venueError && <p className="error">{venueError}</p>}

        {!venues.length ? (
          <p className="empty-state">No venues yet. Add one above before creating events.</p>
        ) : (
          <div className="venue-chip-grid">
            {venues.map((v) => {
              const holder = eventAtVenue(v.id);
              return (
                <div className="venue-chip" key={v.id}>
                  <span>
                    <strong>{v.name}</strong>
                    <span className="cell-sub">{holder ? holder.name : "Free"}</span>
                  </span>
                  <button
                    className="icon-btn"
                    type="button"
                    aria-label={`Delete ${v.name}`}
                    onClick={() =>
                      setPending({
                        type: "deleteVenue",
                        title: `Delete ${v.name}?`,
                        body: holder
                          ? `"${holder.name}" is held here — reassign it to another venue first.`
                          : "This venue is free and can be removed.",
                        run: () => removeVenue(v.id),
                      })
                    }
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Event form ──────────────────────────────────────────── */}
      <section className="admin-panel">
        <div className="panel-head">
          <h2>{editing ? `Edit ${editing.name}` : "Add an event"}</h2>
        </div>

        {locked && (
          <p className="notice">
            People have already registered for this event, so its name, fee, date and category are
            fixed. You can still change the venue, timing and description.
          </p>
        )}

        <form className="event-form" onSubmit={submit}>
          <input
            className="input"
            name="name"
            required
            disabled={locked}
            placeholder="Event name"
            value={form.name}
            onChange={change}
          />
          <select
            className="input"
            name="category"
            value={form.category}
            onChange={change}
            disabled={locked}
          >
            {CATEGORIES.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <select className="input" name="venue_id" value={form.venue_id} onChange={change}>
            <option value="">Select a venue…</option>
            {availableVenues.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
          <input
            className="input"
            name="fee"
            type="number"
            min="0"
            disabled={locked}
            placeholder="Fee (₹)"
            value={form.fee}
            onChange={change}
          />
          <div className="event-form-when">
            <DatePicker
              value={form.date}
              onChange={(date) => setForm({ ...form, date })}
              disabled={locked}
            />
            <TimePicker
              value={form.start_time}
              onChange={(start_time) => setForm({ ...form, start_time })}
              placeholder="Start time"
            />
            <span className="event-form-time-sep">–</span>
            <TimePicker
              value={form.end_time}
              onChange={(end_time) => setForm({ ...form, end_time })}
              placeholder="End time"
            />
          </div>
          <input
            className="input event-form-wide"
            name="description"
            placeholder="Short description"
            value={form.description}
            onChange={change}
          />
          <label className="check-row event-form-wide">
            <input
              type="checkbox"
              checked={form.is_team_event}
              disabled={locked}
              onChange={(e) => setForm({ ...form, is_team_event: e.target.checked })}
            />
            Team event
            {form.is_team_event && (
              <>
                <input
                  className="input input-sm"
                  type="number"
                  min="1"
                  disabled={locked}
                  value={form.team_min}
                  onChange={(e) => setForm({ ...form, team_min: e.target.value })}
                />
                <span className="event-form-time-sep">to</span>
                <input
                  className="input input-sm"
                  type="number"
                  min="1"
                  disabled={locked}
                  value={form.team_max}
                  onChange={(e) => setForm({ ...form, team_max: e.target.value })}
                />
                <span className="cell-sub">members</span>
              </>
            )}
          </label>
          <FormActions
            editing={!!editing}
            saveLabel={editing ? "Save changes" : "Add event"}
            onCancel={editing ? reset : undefined}
          />
        </form>

        {error && <p className="error">{error}</p>}
      </section>

      {CATEGORIES.map((category) => {
        const rows = events.filter((e) => e.category === category);
        return (
          <section className="admin-panel" key={category}>
            <div className="panel-head">
              <h2>
                {category}
                <span className="division-count">{rows.length}</span>
              </h2>
            </div>

            {!rows.length ? (
              <p className="empty-state">No {category.toLowerCase()} events yet.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Event</th>
                      <th>Venue</th>
                      <th>Date &amp; time</th>
                      <th className="num">Fee</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((ev) => (
                      <tr key={ev.id}>
                        <td>
                          <Link to={`/admin/events/${ev.id}`}>
                            <strong>{ev.name}</strong>
                          </Link>
                          {ev.description && <span className="cell-sub">{ev.description}</span>}
                        </td>
                        <td>{ev.venue_name || <span className="cell-sub">Unassigned</span>}</td>
                        <td className="cell-nowrap">{formatEventTime(ev) || "—"}</td>
                        <td className="num">{ev.fee > 0 ? rupees(ev.fee) : "Free"}</td>
                        <td className="row-actions">
                          <button className="btn btn-ghost btn-sm" type="button" onClick={() => edit(ev)}>
                            Edit
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            type="button"
                            onClick={() =>
                              setPending({
                                type: "deleteEvent",
                                id: ev.id,
                                title: `Delete "${ev.name}"?`,
                                body:
                                  "This can't be undone. An event that already has registrations " +
                                  "can't be deleted at all.",
                                run: () => removeEvent(ev.id),
                              })
                            }
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}

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
