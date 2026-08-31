"use client";

import { useCallback } from "react";
import "@/styles/pages/admin/roles.css";
import Link from "next/link";
import { getVolunteerSummary } from "@/api/client.js";
import { useApi } from "@/hooks/useApi.js";
import { formatEventTime } from "@/utils/format.js";
import Loader from "@/components/common/Loader.jsx";
import JudgingQueueView from "@/components/roles/JudgingQueueView.jsx";

export default function VolunteerHome() {
  const fetcher = useCallback(getVolunteerSummary, []);
  const { data, error, loading } = useApi(fetcher, { liveOn: "registrations" });

  if (loading) return <Loader />;
  if (error) return <p className="error">{error}</p>;

  if (!data?.event) {
    return (
      <section className="admin-panel">
        <div className="panel-head">
          <h2>Overview</h2>
        </div>
        <p className="empty-state">
          {data?.venue_name
            ? `You're assigned to ${data.venue_name}, but no event is scheduled there yet.`
            : "You haven't been assigned to a venue yet. An organiser will set this up."}
        </p>
      </section>
    );
  }

  const { event } = data;
  return (
    <section className="admin-panel">
      <div className="panel-head">
        <h2>Overview</h2>
        <span className="muted">{data.venue_name}</span>
      </div>

      <div className="assignment-chip" style={{ marginBottom: "1rem" }}>
        <span>
          <strong>{event.name}</strong>
          <span className="cell-sub">{formatEventTime(event) || "Time TBA"}</span>
        </span>
      </div>

      <p className="muted">
        <strong>{data.registrations}</strong> registered ·{" "}
        <strong>{data.completed}</strong> confirmed ·{" "}
        <strong>{data.event_checked_in}</strong> checked in ·{" "}
        <strong>{data.evaluated}</strong> evaluated
      </p>

      <div className="notice" style={{ marginTop: "1rem" }}>
        <JudgingQueueView current={data.now_evaluating} upcoming={data.up_next} />
      </div>

      <p className="muted" style={{ marginTop: "1rem" }}>
        Head to <Link href="/volunteer/check-in">Check-in</Link> to scan participants, or{" "}
        <Link href="/volunteer/tasks">Roster</Link> for the full list.
      </p>
    </section>
  );
}
