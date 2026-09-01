"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.jsx";
import { yearLabel } from "@/content/formOptions.js";

/**
 * Everything a person typed on a registration — for the lead and, on a team
 * entry, every member. Teammates never sign in themselves, so an admin screen
 * is the only place their details surface at all.
 *
 * Shared by the Registrations table and the Approvals queue so both show the
 * same fields; `people` entries are the raw registration/member maps, with
 * `lead: true` on whoever registered.
 */
export default function PersonDetailsDialog({ open, onClose, title, subtitle, people = [] }) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {subtitle && <AlertDialogDescription>{subtitle}</AlertDialogDescription>}
        </AlertDialogHeader>

        <ul className="team-list person-list">
          {/* Keyed on position, not email. A roster can legitimately repeat an
              address — a lead typed in as their own teammate, say — and a
              display component must never crash on the data it is handed,
              whatever the write path allows. */}
          {people.map((p, i) => (
            <li key={`${p.email || "anon"}-${i}`}>
              <span>
                <strong>{p.name || "—"}</strong>
                {p.lead && <span className="status-pill status-pill--lead">lead</span>}
              </span>
              <div className="reg-detail-group person-fields">
                <div className="reg-detail-row"><span>Email</span><span>{p.email || "—"}</span></div>
                <div className="reg-detail-row"><span>Phone</span><span>{p.phone || "—"}</span></div>
                <div className="reg-detail-row"><span>College</span><span>{p.college || "—"}</span></div>
                <div className="reg-detail-row">
                  <span>Department</span><span>{p.department || "—"}</span>
                </div>
                <div className="reg-detail-row">
                  <span>Year</span><span>{p.year ? yearLabel(p.year) : "—"}</span>
                </div>
                <div className="reg-detail-row">
                  <span>Location</span>
                  {/* "Other" is a placeholder — the typed city is the answer. */}
                  <span>
                    {(p.location === "Other" ? p.location_other : p.location) || "—"}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <AlertDialogFooter>
          <AlertDialogAction>Close</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
