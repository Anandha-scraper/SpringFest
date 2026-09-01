"use client";

import { useCallback } from "react";
import "@/styles/pages/admin/dashboard.css";
import Link from "next/link";
import { useParams } from "next/navigation";
import { FileText } from "lucide-react";
import StatCard from "@/components/admin/StatCard.jsx";
import StatusPill from "@/components/admin/StatusPill.jsx";
import {
  downloadRegistrationsCsv,
  downloadVolunteerSubmission,
  getEventParticipants,
} from "@/api/client.js";
import { useApi } from "@/hooks/useApi.js";
import { useToast } from "@/components/ui/toast.jsx";
import { formatDateTime, formatEventTime, rupees } from "@/utils/format.js";
import Loader from "@/components/common/Loader.jsx";

export default function EventParticipants() {
  const { id } = useParams();
  const toast = useToast();
  const fetcher = useCallback(() => getEventParticipants(id), [id]);
  const { data, error, loading } = useApi(fetcher);

  const openSubmission = async (registrationId) => {
    try {
      await downloadVolunteerSubmission(registrationId);
    } catch (err) {
      toast.bad(err.message);
    }
  };

  if (loading) return <Loader />;
  if (error) {
    return (
      <div className="admin">
        <p className="error">{error}</p>
        <Link href="/admin" className="btn btn-ghost">← Back to dashboard</Link>
      </div>
    );
  }

  const { event } = data;

  return (
    <div className="admin">
      <Link href="/admin" className="back-link">← Back to dashboard</Link>

      <div className="admin-head">
        <div>
          <span className="eyebrow">Event participants</span>
          <h1>{event.name}</h1>
          <p className="muted">
            {formatEventTime(event)} · {event.venue_name || "No venue"}
            {event.fee > 0 ? ` · ${rupees(event.fee)} entry` : " · Free entry"}
          </p>
        </div>
        <button
          className="btn btn-ghost"
          type="button"
          onClick={() => downloadRegistrationsCsv({ event_id: id })}
        >
          Export CSV
        </button>
      </div>

      <div className="stat-cards">
        <StatCard label="Registered" value={data.total} />
        <StatCard label="Completed" value={data.completed} tone="ok" />
        <StatCard label="Checked in" value={data.checked_in} tone="warn" />
        <StatCard label="Revenue" value={data.revenue} prefix="₹" tone="accent" />
        {/* Null until somebody answers, so "no responses yet" never renders as
            a rating of zero. */}
        <StatCard
          label="Avg rating"
          value={data.feedback_avg ?? "—"}
          tone={data.feedback_avg ? "ok" : undefined}
        />
      </div>

      <section className="admin-panel">
        <h2>Participants</h2>
        {/* Per-event, so this stays one row per registration — unlike the
            Registrations page, which pivots to one row per person. */}
        {!data.participants.length ? (
          <p className="empty-state">Nobody has registered for this event yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Participant</th>
                  <th>Contact</th>
                  <th>College</th>
                  <th>Team</th>
                  <th>Status</th>
                  <th>Checked in</th>
                  <th className="num">Amount</th>
                  <th>Registered</th>
                  <th>File</th>
                  <th>Feedback</th>
                </tr>
              </thead>
              <tbody>
                {data.participants.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.name}</strong>
                      <span className="cell-sub">{r.email}</span>
                    </td>
                    <td>{r.phone || "—"}</td>
                    <td>{r.college || "—"}</td>
                    <td>
                      {r.team_name || "—"}
                      {r.team_size > 1 && <span className="cell-sub">{r.team_size} members</span>}
                    </td>
                    <td><StatusPill status={r.status} /></td>
                    <td>{r.checked_in ? "Yes" : "No"}</td>
                    <td className="num">{r.fee > 0 ? rupees(r.fee) : "Free"}</td>
                    <td className="cell-sub">{formatDateTime(r.created_at)}</td>
                    <td>
                      {r.submission_path ? (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => openSubmission(r.id)}
                        >
                          <FileText size={14} aria-hidden="true" /> Download
                        </button>
                      ) : (
                        <span className="cell-sub">—</span>
                      )}
                    </td>
                    {/* One row is one registration but feedback is per person,
                        so a team can hold several answers. */}
                    <td>
                      {(r.feedback || []).length ? (
                        <ul className="cell-list">
                          {r.feedback.map((f) => (
                            <li key={f.member_index}>
                              <strong>{f.rating}/5</strong>{" "}
                              <span className="cell-sub">{f.name || f.email}</span>
                              {f.comment && <div className="cell-sub">{f.comment}</div>}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="cell-sub">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
