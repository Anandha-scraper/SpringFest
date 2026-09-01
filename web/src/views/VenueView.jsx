"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import "@/styles/pages/admin/shared.css";
import "@/styles/pages/admin/roles.css";
import "@/styles/venue.css";
import { FileText, MapPin } from "lucide-react";
import { downloadVenueSubmission } from "@/api/client.js";
import { useToast } from "@/components/ui/toast.jsx";
import { useVenueAccess } from "@/venue/VenueAccessContext.jsx";
import { formatEventTime } from "@/utils/format.js";

/**
 * The code-gated venue view — no navbar, no role sidebar. Whoever is looking
 * at this has no account; there is nothing here to route them back to except
 * the landing page.
 *
 * Reads the resolved view from `VenueAccessContext`, never from the URL. A
 * direct or reloaded visit with nothing in that context bounces to `/` —
 * see the context's own module header for why the code is never persisted.
 */
export default function VenueView() {
  const router = useRouter();
  const toast = useToast();
  const { view, clear } = useVenueAccess();

  useEffect(() => {
    if (!view) router.replace("/");
  }, [view, router]);

  if (!view) return null;

  const { event, teams } = view;

  const download = async (registrationId) => {
    try {
      await downloadVenueSubmission(view.code, registrationId);
    } catch (err) {
      toast.bad(err.message);
    }
  };

  return (
    <main className="venue-view">
      <div className="venue-view__inner">
        <section className="admin-panel">
          <div className="panel-head">
            <h2>{event.name}</h2>
            <button type="button" className="btn btn-ghost btn-sm" onClick={clear}>
              Done
            </button>
          </div>
          <p className="muted">
            {formatEventTime(event) || "Time TBA"}
            {event.venue_name && (
              <>
                {" · "}
                <MapPin size={13} aria-hidden="true" style={{ verticalAlign: "-2px" }} />{" "}
                {event.venue_name}
              </>
            )}
          </p>

          {teams.length === 0 ? (
            <p className="empty-state">No teams checked in for this event yet.</p>
          ) : (
            <ul className="checkin-row-list">
              {teams.map((t) => (
                <li key={t.registration_id} className="roster-team">
                  <div className="roster-team__head">
                    <strong>{t.team_name || t.lead_name}</strong>
                    {t.has_submission && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => download(t.registration_id)}
                      >
                        <FileText size={14} aria-hidden="true" /> Download submission
                      </button>
                    )}
                  </div>
                  <div className="roster-holder__name">
                    {t.lead_name}
                    {t.lead_allocation_code && (
                      <span className="checkin-row__code">{t.lead_allocation_code}</span>
                    )}
                  </div>
                  {t.member_names.length > 0 && (
                    <p className="cell-sub">Team: {t.member_names.join(", ")}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
