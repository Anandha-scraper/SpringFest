"use client";

import { useState } from "react";
import "@/styles/pages/admin/shared.css";

import Loader from "@/components/common/Loader.jsx";
import TablePagination from "@/components/admin/TablePagination.jsx";
import PersonDetailsDialog from "@/components/admin/PersonDetailsDialog.jsx";
import { getDrafts } from "@/api/client.js";
import { useApi } from "@/hooks/useApi.js";

// Longer than the approvals page: these rows are text, with no screenshot to
// leave room for.
const PAGE_SIZE = 12;

const fetchDrafts = () => getDrafts();

/** How long a draft has been sitting. The list is oldest-first, so this is the
 * column that says who to call. */
function waitingFor(iso) {
  if (!iso) return "—";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days < 1) return "today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

export default function Drafts() {
  const { data, error: loadError, loading } = useApi(fetchDrafts, { liveOn: "registrations" });
  const [page, setPage] = useState(1);
  const [details, setDetails] = useState(null);

  const rows = data || [];
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const openDetails = (r) =>
    setDetails({
      title: r.name,
      people: [{ ...r, lead: true }, ...(r.members || [])],
    });

  if (loading) return <Loader />;
  if (loadError) return <p className="error">{loadError}</p>;

  return (
    <div className="admin">
      <section className="admin-panel">
        <div className="panel-head">
          <h2>Saved but not paid</h2>
          <span className="muted">{rows.length} unfinished</span>
        </div>

        <p className="muted panel-note">
          Forms somebody filled in and stopped. Nothing has been charged and no seat is
          confirmed — these are people to follow up with. Oldest first.
        </p>

        {!rows.length ? (
          <p className="empty-state">
            No unfinished forms. A draft appears here when someone saves a registration
            without submitting it for payment.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Participant</th>
                  <th>Contact</th>
                  <th>Event</th>
                  <th>College</th>
                  <th>Would pay</th>
                  <th>Waiting</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r) => (
                  <tr key={r.registration_id}>
                    <td>
                      <button className="link-btn" type="button" onClick={() => openDetails(r)}>
                        {r.name || "—"}
                      </button>
                      {r.team_name && (
                        <span className="cell-sub">
                          Team {r.team_name} · {r.team_size} member
                          {r.team_size === 1 ? "" : "s"}
                        </span>
                      )}
                    </td>
                    <td>
                      {/* The point of this screen is to reach them, so both
                          contact routes are one click, not behind the dialog. */}
                      <a href={`mailto:${r.email}`}>{r.email}</a>
                      <span className="cell-sub">
                        <a href={`tel:${r.phone}`}>{r.phone || "—"}</a>
                      </span>
                    </td>
                    <td>
                      {r.event_name || r.event_id}
                      {r.category && <span className="cell-sub">{r.category}</span>}
                    </td>
                    <td>
                      {r.college || "—"}
                      <span className="cell-sub">
                        {[r.department, r.year && `Year ${r.year}`].filter(Boolean).join(" · ")}
                      </span>
                    </td>
                    <td>{r.fee > 0 ? `₹${r.fee}` : "Free"}</td>
                    <td>{waitingFor(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <TablePagination page={safePage} totalPages={totalPages} onPage={setPage} />
      </section>

      <PersonDetailsDialog
        open={Boolean(details)}
        title={details?.title}
        people={details?.people || []}
        onClose={() => setDetails(null)}
      />
    </div>
  );
}
