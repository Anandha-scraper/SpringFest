import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Download, QrCode, Ticket as TicketIcon } from "lucide-react";
import { downloadPersonalQr, getMyRegistrations, personalQrObjectUrl } from "../api/client.js";
import StatusPill from "../components/admin/StatusPill.jsx";

/** The signed-in person's one badge — scanning it is how a volunteer sees
 * every event they're registered for, not just this one.
 *
 * Fetched rather than pointed at with a plain src because the endpoint is
 * authenticated — a bare <img src> sends no bearer token.
 */
function PersonalQr() {
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
    <div className="card personal-qr">
      <div className="card-meta" style={{ paddingTop: 0 }}>
        <QrCode size={18} aria-hidden="true" />
        <strong>Your Entry Pass</strong>
      </div>
      <p className="muted" style={{ fontSize: "0.85rem" }}>
        One code for everything you're registered for — show it at the door for any event.
      </p>
      {src ? (
        <img src={src} alt="Your Spring Fest entry QR code" width={220} height={220} />
      ) : (
        <div className="ticket-placeholder">{error ? "!" : "…"}</div>
      )}
      <button className="btn btn-ghost btn-sm" type="button" onClick={downloadPersonalQr}>
        <Download size={13} aria-hidden="true" /> Save
      </button>
    </div>
  );
}

export default function MyRegistrations() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getMyRegistrations()
      .then(setItems)
      .catch((e) => {
        setError(e.message);
        setItems([]);
      });
  }, []);

  return (
    <div className="container page-pad">
      <div className="section-head">
        <span className="eyebrow">Your fest</span>
        <h2>My Registrations</h2>
        <p>Everything you've signed up for, with payment status and your entry pass.</p>
      </div>

      {error && <p className="error">{error}</p>}

      {items === null ? (
        <div className="spinner" />
      ) : items.length === 0 ? (
        <div className="empty-state">
          <p style={{ marginBottom: 20 }}>You haven't registered for any events yet.</p>
          <Link to="/#events" className="btn">Browse events</Link>
        </div>
      ) : (
        <div className="grid">
          <PersonalQr />
          {items.map((r) => (
            <div className="card" key={r.id}>
              <div className="card-meta" style={{ paddingTop: 0 }}>
                <StatusPill status={r.status} />
                <span className="price">{r.fee > 0 ? `₹${r.fee}` : "Free"}</span>
              </div>
              <h3>{r.event_name || r.event_id}</h3>
              <p className="muted" style={{ fontSize: "0.85rem" }}>
                Registration ID
                <br />
                <code style={{ fontSize: "0.82rem" }}>{r.id}</code>
              </p>

              {r.status === "pending" && (
                <Link className="btn btn-sm" to={`/events/${r.event_id}`}>
                  Complete payment
                </Link>
              )}

              {r.status === "awaiting_approval" && (
                <p className="muted" style={{ fontSize: "0.85rem" }}>
                  Payment submitted{r.transaction_id ? ` (ref ${r.transaction_id})` : ""}.
                  An organiser is checking it — you'll get your entry pass once it's
                  approved.
                </p>
              )}

              {r.status === "rejected" && (
                <>
                  <div className="notice notice-warn">
                    <strong>Payment not accepted</strong>
                    <p>{r.review_note || "The organisers couldn't verify your payment."}</p>
                  </div>
                  {/* Carries the registration across so the resubmit lands on
                      this row rather than creating a second one. */}
                  <Link
                    className="btn btn-sm"
                    to={`/events/${r.event_id}`}
                    state={{ resumeRegistration: r }}
                  >
                    Resubmit proof
                  </Link>
                </>
              )}

              {r.status === "completed" && (
                <p className="muted" style={{ fontSize: "0.85rem" }}>
                  <TicketIcon size={13} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: 4 }} />
                  Show your Spring Fest QR above at the door.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
