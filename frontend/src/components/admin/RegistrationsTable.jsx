import { useState } from "react";
import { Eye } from "lucide-react";
import StatusPill from "./StatusPill.jsx";
import { formatDateTime, rupees } from "../../lib/format.js";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet.jsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.jsx";

const money = (n) => (n > 0 ? rupees(n) : "Free");

// Percentage widths so `table-layout: fixed` keeps columns steady across pages.
const COLS = [21, 12, 11, 8, 12, 8, 13, 8, 7];

/**
 * One row per *person*, with their registrations rolled up — the shape
 * `GET /admin/participants` returns. A row's Events cell counts how many events
 * they entered and Total paid sums only what actually cleared.
 */
export default function RegistrationsTable({ rows, minRows = 0 }) {
  const [selected, setSelected] = useState(null);
  const [team, setTeam] = useState(null);

  if (!rows.length) return <p className="empty-state">No registrations match these filters.</p>;

  // Header ≈ 2.6rem + 3.5rem a row: holds the height so a short last page
  // doesn't make the pagination jump.
  const minHeight = minRows ? `${minRows * 3.5 + 2.6}rem` : undefined;

  return (
    <>
      <div className="table-wrap" style={{ minHeight }}>
        <table className="data-table data-table--fixed">
          <colgroup>
            {COLS.map((w, i) => (
              <col key={i} style={{ width: `${w}%` }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th>Participant</th>
              <th>Contact</th>
              <th>College</th>
              <th className="num">Events</th>
              <th>Team</th>
              <th className="num">Team size</th>
              <th>Status</th>
              <th className="num">Total paid</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.uid}>
                <td>
                  <strong>{r.name}</strong>
                  <span className="cell-sub">{r.email}</span>
                </td>
                <td>{r.phone || "—"}</td>
                <td>{r.college || "—"}</td>
                <td className="num">
                  {r.events_count}
                  <span className="cell-sub">
                    {r.events.map((e) => e.event_name).join(", ")}
                  </span>
                </td>
                <td>
                  {r.team_name ? (
                    <button className="link-btn" type="button" onClick={() => setTeam(r)}>
                      {r.team_name}
                    </button>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="num">{r.team_size > 1 ? r.team_size : "—"}</td>
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

      {/* Teammates: they don't sign in themselves, so this is the only place
          their details surface. */}
      <AlertDialog open={!!team} onOpenChange={(open) => !open && setTeam(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{team?.team_name}</AlertDialogTitle>
            <AlertDialogDescription>
              {team?.team_size} members · led by {team?.name}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="team-list">
            <li>
              <span><strong>{team?.name}</strong><span className="pill pill-judge">lead</span></span>
              <span className="cell-sub">{team?.email} · {team?.phone}</span>
            </li>
            {(team?.members || []).map((m) => (
              <li key={m.email}>
                <span><strong>{m.name}</strong></span>
                <span className="cell-sub">{m.email} · {m.phone}</span>
              </li>
            ))}
          </ul>
          <AlertDialogFooter>
            <AlertDialogAction>Close</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
                  {selected.team_name && (
                    <div className="reg-detail-row">
                      <span>Team</span>
                      <span>{selected.team_name} · {selected.team_size} members</span>
                    </div>
                  )}
                </section>

                {/* One block per event: the whole point of the per-person row. */}
                {selected.events.map((e) => (
                  <section className="reg-detail-group" key={e.registration_id}>
                    <h4>{e.event_name}</h4>
                    <div className="reg-detail-row">
                      <span>Status</span><span><StatusPill status={e.status} /></span>
                    </div>
                    <div className="reg-detail-row">
                      <span>Attended</span><span>{e.checked_in ? "Checked in" : "Not checked in"}</span>
                    </div>
                    <div className="reg-detail-row"><span>Amount</span><span>{money(e.fee)}</span></div>
                    <div className="reg-detail-row">
                      <span>Payment ID</span><span className="mono">{e.payment_id || "—"}</span>
                    </div>
                    <div className="reg-detail-row">
                      <span>Order ID</span><span className="mono">{e.order_id || "—"}</span>
                    </div>
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
    </>
  );
}
