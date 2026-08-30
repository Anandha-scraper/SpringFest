import { useCallback, useEffect, useState } from "react";
import "@/styles/pages/admin/shared.css";
import "@/styles/pages/my-registrations.css";
import { Link } from "react-router-dom";
import { Download, QrCode, UserPlus } from "lucide-react";
import {
  downloadPersonalQr,
  getEvents,
  getMyRegistrations,
  personalQrObjectUrl,
} from "@/api/client.js";
import { useAuth } from "@/auth/AuthContext.jsx";
import { yearLabel } from "@/content/formOptions.js";
import { formatEventDate, formatEventTimeRange } from "@/utils/format.js";
import StatusPill from "@/components/admin/StatusPill.jsx";
import EventSubmission from "@/components/registration/EventSubmission.jsx";
import AddTeammate from "@/components/registration/AddTeammate.jsx";

/** The signed-in person's one badge — scanning it is how a volunteer sees
 * every event they're registered for, not just this one.
 *
 * Fetched rather than pointed at with a plain src because the endpoint is
 * authenticated — a bare <img src> sends no bearer token.
 */
function PersonalQr({ codes = [] }) {
  const [src, setSrc] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let url = "";
    let cancelled = false;
    personalQrObjectUrl()
      .then((objectUrl) => {
        if (cancelled) return URL.revokeObjectURL(objectUrl);
        url = objectUrl;
        setSrc(objectUrl);
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, []);

  return (
    <div className="myreg-qr">
      <span className="myreg-qr__title">
        <QrCode size={18} aria-hidden="true" /> Your Entry Pass
      </span>
      {src ? (
        <img src={src} alt="Your Spring Fest entry QR code" />
      ) : (
        <div className="ticket-placeholder">{error ? "!" : "…"}</div>
      )}
      <p className="muted">Show this at the door — one code for every event you're registered for.</p>
      {codes.length > 0 && (
        <div className="myreg-codes">
          <span className="myreg-codes__label">Your codes</span>
          {codes.map((c) => (
            <span className="alloc-code" key={c}>{c}</span>
          ))}
        </div>
      )}
      <button className="btn btn-ghost btn-sm" type="button" onClick={downloadPersonalQr}>
        <Download size={13} aria-hidden="true" /> Download
      </button>
    </div>
  );
}

/** The person's own details, wherever they sit on a registration (lead → the
 * doc's top-level fields; team member → their entry in `members[]`). */
function ownDetails(rows) {
  for (const r of rows) {
    const d =
      r.member_index === 0
        ? {
            name: r.name,
            email: r.email,
            phone: r.phone,
            college: r.college,
            department: r.department,
            year: r.year,
            location: r.location,
          }
        : (r.members || [])[r.member_index - 1];
    if (d && d.email) return d;
  }
  return null;
}

// The one open action a registration still needs, done on the event page.
const PAYMENT_CTA = {
  draft: "Finish & pay",
  pending: "Complete payment",
  rejected: "Resubmit proof",
};

export default function MyRegistrations() {
  const { registrationOpen } = useAuth();
  const [items, setItems] = useState(null);
  const [events, setEvents] = useState([]);
  const [error, setError] = useState("");
  const [sheet, setSheet] = useState(null); // { registration, event, resume } | null

  const load = useCallback(() => {
    Promise.all([getMyRegistrations(), getEvents()])
      .then(([regs, evs]) => {
        setItems(regs);
        setEvents(evs);
      })
      .catch((e) => {
        setError(e.message);
        setItems([]);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const byId = new Map(events.map((e) => [e.id, e]));
  const rows = items || [];
  const me = ownDetails(rows);
  const myCodes = rows.map((r) => (r.allocation_codes || [])[r.member_index]).filter(Boolean);
  const teams = rows
    .filter((r) => (r.team_size || 1) > 1)
    .map((r) => ({
      id: r.id,
      event: r.event_name || r.event_id,
      teamName: r.team_name,
      codes: r.allocation_codes || [],
      holders: [{ name: r.name, email: r.email, phone: r.phone }, ...(r.members || [])],
    }));

  return (
    <div className="myreg">
      {error && <p className="error">{error}</p>}

      {items === null ? (
        <div className="spinner" />
      ) : items.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state__lead">You haven't registered for any events yet.</p>
          <Link to="/#events" className="btn">Browse events</Link>
        </div>
      ) : (
        <section className="myreg-layout">
          <PersonalQr codes={myCodes} />

          <div className="myreg-right">
            <div className="myreg-info">
              {me && (
                <div className="reg-detail-group">
                  <h4>You</h4>
                  <div className="reg-detail-row"><span>Name</span><span>{me.name || "—"}</span></div>
                  <div className="reg-detail-row"><span>Email</span><span>{me.email}</span></div>
                  <div className="reg-detail-row"><span>Phone</span><span>{me.phone || "—"}</span></div>
                  <div className="reg-detail-row"><span>College</span><span>{me.college || "—"}</span></div>
                  <div className="reg-detail-row"><span>Department</span><span>{me.department || "—"}</span></div>
                  <div className="reg-detail-row"><span>Year</span><span>{me.year ? yearLabel(me.year) : "—"}</span></div>
                  <div className="reg-detail-row"><span>Location</span><span>{me.location || "—"}</span></div>
                </div>
              )}

              {teams.map((t) => (
                <div className="reg-detail-group" key={t.id}>
                  <div className="reg-detail-group-head">
                    <h4>{t.event}</h4>
                    {t.teamName && <span className="muted">{t.teamName}</span>}
                  </div>
                  {t.holders.map((h, i) => (
                    <div className="reg-detail-row" key={i}>
                      <span>
                        {h.name || "—"}
                        {t.codes[i] && <span className="alloc-code alloc-code--sm">{t.codes[i]}</span>}
                      </span>
                      <span>{[h.email, h.phone].filter(Boolean).join(" · ") || "—"}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className="myreg-events-block">
              <h3 className="myreg-events-title">Your events</h3>
              <div className="myreg-events">
                {items.map((r) => {
              const event = byId.get(r.event_id) || { name: r.event_name || r.event_id };
              const isLead = r.member_index === 0;
              const topUp = Number(r.amount_due) > 0;
              const topupPending = isLead && topUp && (r.status === "pending" || r.status === "rejected");
              const topupReview = topUp && r.status === "awaiting_approval";
              const canAdd =
                isLead &&
                !!event.is_team_event &&
                (r.team_size || 1) < (event.team_max || 1) &&
                r.status === "completed" &&
                registrationOpen;
              // The plain resume-payment link is only for a first payment that
              // never completed — a top-up gets its own resume button instead.
              const cta = topUp ? null : PAYMENT_CTA[r.status];
              return (
                <div className="myreg-event" key={r.id}>
                  <div className="myreg-event__top">
                    <strong className="myreg-event__name">{event.name}</strong>
                    <div className="myreg-event__top-right">
                      <StatusPill status={r.status} />
                      {canAdd && (
                        <button
                          type="button"
                          className="myreg-event__add"
                          title="Add a teammate"
                          aria-label="Add a teammate"
                          onClick={() => setSheet({ registration: r, event, resume: false })}
                        >
                          <UserPlus size={15} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>
                  {event.category && <span className="tag">{event.category}</span>}
                  <div className="myreg-event__meta">
                    <span>{formatEventDate(event) || "Date TBA"}</span>
                    <span>{formatEventTimeRange(event) || "Time TBA"}</span>
                  </div>
                  {(r.allocation_codes || [])[r.member_index] && (
                    <span className="alloc-code myreg-event__code">
                      {r.allocation_codes[r.member_index]}
                    </span>
                  )}
                  {cta && (
                    <Link
                      className="btn btn-sm"
                      to={`/events/${r.event_id}`}
                      state={{ resumeRegistration: r }}
                    >
                      {cta}
                    </Link>
                  )}
                  {topupPending && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => setSheet({ registration: r, event, resume: true })}
                    >
                      {r.status === "rejected" ? "Retry teammate payment" : "Finish adding teammate"}
                    </button>
                  )}
                  {topupReview && (
                    <p className="muted myreg-event__note">New teammate's payment is under review.</p>
                  )}
                  {event.allow_submissions && (
                    <EventSubmission
                      registrationId={r.id}
                      canUpload={r.member_index === 0}
                      filename={r.submission_filename}
                    />
                  )}
                </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {sheet && (
        <AddTeammate
          registration={sheet.registration}
          event={sheet.event}
          resume={sheet.resume}
          onClose={() => setSheet(null)}
          onDone={() => {
            setSheet(null);
            load();
          }}
        />
      )}
    </div>
  );
}
