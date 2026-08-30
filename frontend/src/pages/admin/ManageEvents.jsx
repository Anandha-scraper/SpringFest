import { useCallback, useMemo, useState } from "react";
import "@/styles/pages/admin/events.css";
import { Link } from "react-router-dom";
import { Lock, Plus, Trash2 } from "lucide-react";
import Loader from "@/components/common/Loader.jsx";
import FormActions from "@/components/admin/FormActions.jsx";
import { useToast } from "@/components/ui/toast.jsx";
import {
  addVenue,
  createEvent,
  getAdminEvent,
  getEvents,
  getVenues,
  removeEvent,
  removeVenue,
  updateEvent,
} from "@/api/client.js";
import { useApi } from "@/hooks/useApi.js";
import { EVENT_CATEGORIES } from "@/content/formOptions.js";
import { formatEventTime, rupees } from "@/utils/format.js";
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

const CATEGORIES = EVENT_CATEGORIES;

/** Today as YYYY-MM-DD, local — the earliest date an event can be scheduled
 *  for. Built from local components so it matches what the picker renders. */
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const blankForm = () => ({
  name: "",
  category: CATEGORIES[0],
  venue_id: "",
  date: "",
  start_time: "",
  end_time: "",
  fee: "",
  description: "",
  instructions: "",
  // [{ label, max }] — the event's scoring scheme. The total shown to the
  // organiser is derived (sum of max), never part of the form or the payload.
  marking_criteria: [],
  is_team_event: false,
  team_min: 2,
  team_max: 4,
  allow_submissions: false,
});

const load = () => Promise.all([getEvents(), getVenues()]);

export default function ManageEvents() {
  const fetcher = useCallback(load, []);
  const { data, error: loadError, loading, reload } = useApi(fetcher);
  const [events, venues] = data || [[], []];

  const toast = useToast();
  const [form, setForm] = useState(blankForm);
  const [editing, setEditing] = useState(null); // the event being edited
  const [venueName, setVenueName] = useState("");
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

  // Marking-criteria rows — their own handlers since they're a list, not a
  // single named input.
  const addCriterion = () =>
    setForm((f) => ({ ...f, marking_criteria: [...f.marking_criteria, { label: "", max: "" }] }));
  const updateCriterion = (i, field, value) =>
    setForm((f) => ({
      ...f,
      marking_criteria: f.marking_criteria.map((c, j) => (j === i ? { ...c, [field]: value } : c)),
    }));
  const removeCriterion = (i) =>
    setForm((f) => ({ ...f, marking_criteria: f.marking_criteria.filter((_, j) => j !== i) }));
  const markingTotal = form.marking_criteria.reduce((s, c) => s + (Number(c.max) || 0), 0);

  const reset = () => {
    setForm(blankForm());
    setEditing(null);
  };

  const submit = async (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      fee: Number(form.fee) || 0,
      team_min: Number(form.team_min) || 1,
      team_max: Number(form.team_max) || 1,
      is_team_event: !!form.is_team_event,
      // Drop half-filled rows and coerce marks to numbers before sending.
      marking_criteria: form.marking_criteria
        .map((c) => ({ label: c.label.trim(), max: Number(c.max) || 0 }))
        .filter((c) => c.label && c.max > 0),
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
              instructions: payload.instructions,
              marking_criteria: payload.marking_criteria,
              allow_submissions: payload.allow_submissions,
            }
          : payload;
        await updateEvent(editing.id, editable);
        toast.ok(`${editing.name} saved.`);
      } else {
        await createEvent(payload);
        toast.ok(`${payload.name} created.`);
      }
      reset();
      await reload();
    } catch (err) {
      toast.bad(err.message);
    }
  };

  /** The list from GET /events carries no marking_criteria — it's judges-only
   *  and the public route deliberately never returns it — so editing fetches
   *  the raw doc from the admin route to fill that field in. */
  const edit = async (ev) => {
    setEditing(ev);
    setForm({
      name: ev.name,
      category: ev.category || CATEGORIES[0],
      venue_id: ev.venue_id || "",
      date: ev.date || "",
      start_time: ev.start_time || "",
      end_time: ev.end_time || "",
      fee: String(ev.fee ?? ""),
      description: ev.description || "",
      instructions: ev.instructions || "",
      marking_criteria: [],
      is_team_event: !!ev.is_team_event,
      team_min: ev.team_min ?? 2,
      team_max: ev.team_max ?? 4,
      allow_submissions: !!ev.allow_submissions,
    });
    try {
      const full = await getAdminEvent(ev.id);
      // A legacy free-text value isn't an array — it loads as an empty scheme.
      setForm((prev) => ({
        ...prev,
        marking_criteria: Array.isArray(full.marking_criteria)
          ? full.marking_criteria.map((c) => ({ label: c.label ?? "", max: c.max ?? "" }))
          : [],
      }));
    } catch (err) {
      toast.bad(`Couldn't load the marking criteria: ${err.message}`);
    }
  };

  const submitVenue = async (e) => {
    e.preventDefault();
    if (!venueName.trim()) return;
    try {
      await addVenue({ name: venueName.trim() });
      setVenueName("");
      await reload();
      toast.ok("Venue added.");
    } catch (err) {
      toast.bad(err.message);
    }
  };

  const runPending = async () => {
    if (!pending) return;
    try {
      await pending.run();
      if (pending.type === "deleteEvent" && editing?.id === pending.id) reset();
      await reload();
      toast.ok("Deleted.");
    } catch (err) {
      toast.bad(err.message);
    }
    setPending(null);
  };

  if (loading) return <Loader />;
  if (loadError) return <p className="error">{loadError}</p>;

  return (
    <div className="admin">
      {/* ── Venues and the event form, one panel ────────────────────
          A venue only exists to be picked in the form below it, so the two
          sit together: add the room, then schedule what happens in it. */}
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

        <div className="panel-head event-form-head">
          <h2>{editing ? `Edit ${editing.name}` : "Add an event"}</h2>
        </div>

        {locked && (
          <p className="notice">
            People have already registered for this event, so its name, fee, date and category are
            fixed. You can still change the venue, timing and description.
          </p>
        )}

        <form className="event-form" onSubmit={submit}>
          {/* Row one: what the event is, where, and what it costs. */}
          <div className="event-form-row">
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
              placeholder={form.is_team_event ? "Fee per person (₹)" : "Fee (₹)"}
              value={form.fee}
              onChange={change}
            />
          </div>

          {/* Row two: when it runs and a one-line summary — all on one row on
              a laptop. An event can't be scheduled into the past, so the date
              picker is bounded the opposite way round to its default. */}
          <div className="event-form-schedule">
            <DatePicker
              value={form.date}
              onChange={(date) => setForm({ ...form, date })}
              min={today()}
              max={null}
              disabled={locked}
            />
            <TimePicker
              value={form.start_time}
              onChange={(start_time) => setForm({ ...form, start_time })}
              placeholder="Start time"
            />
            <TimePicker
              value={form.end_time}
              onChange={(end_time) => setForm({ ...form, end_time })}
              placeholder="End time"
            />
            <input
              className="input"
              name="description"
              placeholder="Short description"
              value={form.description}
              onChange={change}
            />
          </div>

          {/* Mark allocation on the left, participant instructions on the
              right — they pair naturally and neither needs full width. */}
          <div className="event-form-split">
          {/* The event's scoring scheme: named parameters, each with a max
              mark, and a live total. Judges score against these later. */}
          <div className="field">
            <span className="field-label">
              <Lock size={12} aria-hidden="true" /> Mark allocation criteria
            </span>
            <div className="criteria-editor">
              {form.marking_criteria.map((c, i) => (
                <div className="criteria-row" key={i}>
                  <input
                    className="input"
                    placeholder="Parameter (e.g. Presentation)"
                    value={c.label}
                    onChange={(e) => updateCriterion(i, "label", e.target.value)}
                  />
                  <input
                    className="input"
                    type="number"
                    min="1"
                    placeholder="Marks"
                    value={c.max}
                    onChange={(e) => updateCriterion(i, "max", e.target.value)}
                  />
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Remove ${c.label || "parameter"}`}
                    onClick={() => removeCriterion(i)}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </div>
              ))}
              <div className="criteria-foot">
                <button type="button" className="btn btn-ghost btn-sm" onClick={addCriterion}>
                  <Plus size={14} aria-hidden="true" /> Add parameter
                </button>
                {form.marking_criteria.length > 0 && (
                  <span className="criteria-total">
                    Total <strong>{markingTotal}</strong>
                  </span>
                )}
              </div>
            </div>
          </div>

          <label className="field">
            <span className="field-label">Instructions for participants</span>
            <textarea
              className="input"
              name="instructions"
              rows={4}
              placeholder="What to bring, how to prepare, rules on the day…"
              value={form.instructions}
              onChange={change}
            />
            <span className="cell-sub">Shown on the event page to everyone.</span>
          </label>
          </div>

          <label className="check-row">
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
          <label className="check-row">
            <input
              type="checkbox"
              checked={form.allow_submissions}
              onChange={(e) => setForm({ ...form, allow_submissions: e.target.checked })}
            />
            Accept a presentation file (PDF / PPT / DOC) from participants
          </label>
          <FormActions
            editing={!!editing}
            saveLabel={editing ? "Save changes" : "Add event"}
            onCancel={editing ? reset : undefined}
          />
        </form>
      </section>

      {/* Technical | Non-Technical (row 1), then Hackathon | Workshop (row 2). */}
      <div className="event-category-grid">
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
                          {/* Closed individually — the fest-wide switch and
                              these toggles both live on the Payment page. */}
                          {ev.registration_open === false && (
                            <span className="pill pill-failed">Closed</span>
                          )}
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
