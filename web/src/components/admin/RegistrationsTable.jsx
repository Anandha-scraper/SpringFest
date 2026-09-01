"use client";

import { useEffect, useState } from "react";
import { Eye, Pencil } from "lucide-react";
import StatusPill from "@/components/admin/StatusPill.jsx";
import Loader from "@/components/common/Loader.jsx";
import PersonDetailsDialog from "@/components/admin/PersonDetailsDialog.jsx";
import { formatDateTime, rupees } from "@/utils/format.js";
import { getAdminRegistration, updateAdminRegistration } from "@/api/client.js";
import { DEPARTMENTS, STUDY_YEARS, TN_CITIES, yearLabel } from "@/content/formOptions.js";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet.jsx";

const money = (n) => (n > 0 ? rupees(n) : "Free");

// Percentage widths so `table-layout: fixed` keeps columns steady across pages.
const COLS = [20, 12, 11, 15, 16, 11, 9, 6];

/** One person's academic block — lead or team member, same rules the public
 * registration form uses, so an admin edit can't save what it couldn't. */
function EditDetailFields({ idPrefix, values, onChange }) {
  const field = (name) => `${idPrefix}-${name}`;
  return (
    <>
      <label htmlFor={field("college")}>College</label>
      <input id={field("college")} value={values.college || ""} required minLength={2}
        onChange={(e) => onChange("college", e.target.value)} />

      <label htmlFor={field("department")}>Department</label>
      <select id={field("department")} value={values.department || ""} required
        onChange={(e) => onChange("department", e.target.value)}>
        <option value="" disabled>Department</option>
        {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
      </select>

      <label htmlFor={field("year")}>Year of study</label>
      <select id={field("year")} value={values.year || ""} required
        onChange={(e) => onChange("year", e.target.value)}>
        <option value="" disabled>Year of study</option>
        {STUDY_YEARS.map((y) => <option key={y} value={y}>{yearLabel(y)}</option>)}
      </select>

      <label htmlFor={field("location")}>Location</label>
      <select id={field("location")} value={values.location || ""} required
        onChange={(e) => onChange("location", e.target.value)}>
        <option value="" disabled>City / district</option>
        {TN_CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      {values.location === "Other" && (
        <input placeholder="City" required minLength={2} value={values.location_other || ""}
          onChange={(e) => onChange("location_other", e.target.value)} />
      )}
    </>
  );
}

/** Fixing a typo on one registration — the lead's own fields plus every team
 * member's. Team size, event, fee and status aren't editable here; those
 * belong to the approval flow and the event's own rules. */
function EditRegistrationSheet({ registrationId, onClose, onSaved }) {
  const [row, setRow] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAdminRegistration(registrationId)
      .then(setRow)
      .catch((e) => setError(e.message));
  }, [registrationId]);

  const changeLead = (field, value) => setRow((r) => ({ ...r, [field]: value }));
  const changeMember = (i, field, value) =>
    setRow((r) => ({
      ...r,
      members: r.members.map((m, idx) => (idx === i ? { ...m, [field]: value } : m)),
    }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const patch = {
        name: row.name,
        email: row.email,
        phone: row.phone,
        college: row.college,
        department: row.department,
        year: row.year,
        location: row.location,
        location_other: row.location_other,
        team_name: row.team_name,
      };
      if (row.members?.length) patch.members = row.members;
      await updateAdminRegistration(registrationId, patch);
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="reg-detail">
        <SheetHeader className="reg-detail-head">
          <SheetTitle>Edit registration</SheetTitle>
          <SheetDescription>Fix a typo in the lead's or a teammate's details.</SheetDescription>
        </SheetHeader>

        {!row ? (
          error ? <p className="error">{error}</p> : <Loader compact />
        ) : (
          <form className="form reg-edit-form" onSubmit={submit}>
            <h4>Lead</h4>
            <label htmlFor="edit-name">Full name</label>
            <input id="edit-name" required minLength={2} value={row.name || ""}
              onChange={(e) => changeLead("name", e.target.value)} />

            <label htmlFor="edit-email">Email</label>
            <input id="edit-email" type="email" required value={row.email || ""}
              onChange={(e) => changeLead("email", e.target.value)} />

            <label htmlFor="edit-phone">Phone</label>
            <input id="edit-phone" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} required
              value={row.phone || ""}
              onChange={(e) => changeLead("phone", e.target.value.replace(/\D/g, "").slice(0, 10))} />

            <EditDetailFields idPrefix="edit-lead" values={row} onChange={changeLead} />

            {row.team_name !== undefined && row.team_name !== "" && (
              <>
                <label htmlFor="edit-team">Team name</label>
                <input id="edit-team" value={row.team_name || ""}
                  onChange={(e) => changeLead("team_name", e.target.value)} />
              </>
            )}

            {(row.members || []).map((m, i) => (
              <div className="team-member" key={i}>
                <div className="team-member-head"><strong>Member {i + 2}</strong></div>
                <label htmlFor={`edit-m${i}-name`}>Full name</label>
                <input id={`edit-m${i}-name`} required minLength={2} value={m.name || ""}
                  onChange={(e) => changeMember(i, "name", e.target.value)} />

                <label htmlFor={`edit-m${i}-email`}>Email</label>
                <input id={`edit-m${i}-email`} type="email" required value={m.email || ""}
                  onChange={(e) => changeMember(i, "email", e.target.value)} />

                <label htmlFor={`edit-m${i}-phone`}>Phone</label>
                <input id={`edit-m${i}-phone`} inputMode="numeric" pattern="[0-9]{10}" maxLength={10} required
                  value={m.phone || ""}
                  onChange={(e) => changeMember(i, "phone", e.target.value.replace(/\D/g, "").slice(0, 10))} />

                <EditDetailFields idPrefix={`edit-m${i}`} values={m}
                  onChange={(field, value) => changeMember(i, field, value)} />
              </div>
            ))}

            {error && <p className="error">{error}</p>}
            <div className="form-actions-row">
              <button className="btn" type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </button>
              <button className="btn btn-ghost" type="button" onClick={onClose} disabled={saving}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}

/**
 * One row per *person*, with their registrations rolled up — the shape
 * `GET /admin/participants` returns. A row's Events cell counts how many events
 * they entered and Total paid sums only what actually cleared.
 */
export default function RegistrationsTable({ rows, minRows = 0, onSaved }) {
  const [selected, setSelected] = useState(null);
  const [details, setDetails] = useState(null);
  const [editingId, setEditingId] = useState(null);

  /** Open the details dialog for one person and, on a team entry, their whole
   * roster. Someone leading two teams has two rosters, so they get the detail
   * drawer (which lists every one) instead. */
  const openDetails = (r, t) =>
    setDetails({
      title: t ? t.team_name : r.name,
      subtitle: t
        ? `${t.event_name} · ${t.team_size} members · led by ${r.name}`
        : r.solo_events.join(" · ") || r.email,
      people: [{ ...r, lead: true }, ...(t?.members || [])],
    });

  if (!rows.length) return <p className="empty-state">No registrations match these filters.</p>;

  // Header ≈ 2.6rem + 3.5rem a row: holds the height so a short last page
  // doesn't make the pagination jump.
  const minHeight = minRows ? `${minRows * 3.5 + 2.6}rem` : undefined;

  const handleSaved = () => onSaved?.();

  return (
    <>
      <div className="table-wrap reg-table-wrap" style={{ "--reg-table-min-h": minHeight }}>
        <table className="data-table data-table--fixed">
          <colgroup>
            {COLS.map((w, i) => (
              <col key={i} style={{ "--col-w": `${w}%` }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th>Participant</th>
              <th>Contact</th>
              <th>College</th>
              <th>Events</th>
              <th>Teams</th>
              <th>Status</th>
              <th className="num">Total paid</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.uid}>
                <td>
                  {/* Always a link: a solo participant's own details are worth
                      one click too, not just a team's roster. */}
                  <button
                    className="link-btn"
                    type="button"
                    onClick={() =>
                      r.teams.length > 1 ? setSelected(r) : openDetails(r, r.teams[0])
                    }
                  >
                    {r.name}
                  </button>
                  <span className="cell-sub">{r.email}</span>
                </td>
                <td>{r.phone || "—"}</td>
                <td>{r.college || "—"}</td>
                {/* Events entered alone, by name — a count tells an organiser
                    nothing they can act on. */}
                <td>
                  {r.solo_events.length ? (
                    <ul className="cell-list">
                      {r.solo_events.map((name) => (
                        <li key={name}>{name}</li>
                      ))}
                    </ul>
                  ) : (
                    "—"
                  )}
                </td>
                {/* One chip per team registration, not one per person: the
                    same participant can lead two teams for two events, each
                    with its own roster. */}
                <td>
                  {r.teams.length ? (
                    <ul className="cell-list">
                      {r.teams.map((t) => (
                        <li key={t.registration_id}>
                          <button
                            className="link-btn"
                            type="button"
                            onClick={() => openDetails(r, t)}
                          >
                            {t.team_name}
                          </button>
                          <span className="cell-sub">{t.team_size} members</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    "—"
                  )}
                </td>
                <td><StatusPill status={r.status} /></td>
                <td className="num">{money(r.total_paid)}</td>
                <td>
                  <button
                    className="icon-btn"
                    type="button"
                    aria-label={`View ${r.name}'s registrations`}
                    onClick={() => setSelected(r)}
                  >
                    <Eye size={15} aria-hidden="true" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PersonDetailsDialog
        open={!!details}
        onClose={() => setDetails(null)}
        title={details?.title}
        subtitle={details?.subtitle}
        people={details?.people || []}
      />

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="reg-detail">
          {selected && (
            <>
              <SheetHeader className="reg-detail-head">
                <SheetTitle className="pr-6">{selected.name}</SheetTitle>
                <SheetDescription>
                  {selected.events_count} event{selected.events_count === 1 ? "" : "s"} ·{" "}
                  {money(selected.total_paid)} paid
                </SheetDescription>
              </SheetHeader>

              <div className="reg-detail-body">
                <section className="reg-detail-group">
                  <h4>Participant</h4>
                  <div className="reg-detail-row"><span>Email</span><span>{selected.email}</span></div>
                  <div className="reg-detail-row"><span>Phone</span><span>{selected.phone || "—"}</span></div>
                  <div className="reg-detail-row"><span>College</span><span>{selected.college || "—"}</span></div>
                  <div className="reg-detail-row"><span>Department</span><span>{selected.department || "—"}</span></div>
                  <div className="reg-detail-row">
                    <span>Year</span><span>{selected.year ? yearLabel(selected.year) : "—"}</span>
                  </div>
                  <div className="reg-detail-row"><span>Location</span><span>{selected.location || "—"}</span></div>
                  {/* Every team they're in, since a person can hold more
                      than one — each event's block below names its own. */}
                  {selected.teams.map((t) => (
                    <div className="reg-detail-row" key={t.registration_id}>
                      <span>Team</span>
                      <span>{t.team_name} · {t.team_size} members</span>
                    </div>
                  ))}
                </section>

                {/* One block per event: the whole point of the per-person row. */}
                {selected.events.map((e) => (
                  <section className="reg-detail-group" key={e.registration_id}>
                    <div className="reg-detail-group-head">
                      <h4>{e.event_name}</h4>
                      <button
                        className="icon-btn"
                        type="button"
                        aria-label={`Edit ${e.event_name} registration`}
                        onClick={() => setEditingId(e.registration_id)}
                      >
                        <Pencil size={14} aria-hidden="true" />
                      </button>
                    </div>
                    <div className="reg-detail-row">
                      <span>Status</span><span><StatusPill status={e.status} /></span>
                    </div>
                    {!!e.allocation_codes?.length && (
                      <div className="reg-detail-row">
                        <span>Allocation code{e.allocation_codes.length > 1 ? "s" : ""}</span>
                        <span className="mono">{e.allocation_codes.join(" ")}</span>
                      </div>
                    )}
                    <div className="reg-detail-row">
                      <span>Attended</span><span>{e.checked_in ? "Checked in" : "Not checked in"}</span>
                    </div>
                    <div className="reg-detail-row"><span>Amount</span><span>{money(e.fee)}</span></div>
                    {/* Screenshot payments carry a transaction reference and an
                        admin's verdict instead of gateway ids. */}
                    {e.payment_mode === "screenshot" ? (
                      <>
                        <div className="reg-detail-row">
                          <span>Transaction ID</span><span className="mono">{e.transaction_id || "—"}</span>
                        </div>
                        <div className="reg-detail-row">
                          <span>Reviewed by</span><span>{e.reviewed_by || "—"}</span>
                        </div>
                        {e.review_note && (
                          <div className="reg-detail-row">
                            <span>Note</span><span>{e.review_note}</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="reg-detail-row">
                          <span>Payment ID</span><span className="mono">{e.payment_id || "—"}</span>
                        </div>
                        <div className="reg-detail-row">
                          <span>Order ID</span><span className="mono">{e.order_id || "—"}</span>
                        </div>
                      </>
                    )}
                    <div className="reg-detail-row">
                      <span>Method</span><span>{e.payment_method || "—"}</span>
                    </div>
                    <div className="reg-detail-row">
                      <span>Registered</span><span>{formatDateTime(e.created_at)}</span>
                    </div>
                    {/* Paid at ≈ registered at: confirming the payment is what
                        confirms the registration. */}
                    <div className="reg-detail-row">
                      <span>Paid</span><span>{formatDateTime(e.paid_at)}</span>
                    </div>
                  </section>
                ))}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {editingId && (
        <EditRegistrationSheet
          registrationId={editingId}
          onClose={() => setEditingId(null)}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}
