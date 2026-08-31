"use client";

import { Fragment, useCallback, useMemo, useState } from "react";
import "@/styles/pages/admin/shared.css";
import { ChevronDown, ChevronRight, CircleCheck, CircleDashed, DoorOpen } from "lucide-react";
import Loader from "@/components/common/Loader.jsx";
import TablePagination from "@/components/admin/TablePagination.jsx";
import { getAttendance } from "@/api/client.js";
import { useApi } from "@/hooks/useApi.js";
import { Input } from "@/components/ui/input.jsx";

const PAGE_SIZE = 10;

/** Present / absent for one mark. Deliberately an icon plus a word: a bare
 *  tick and a bare cross look identical at a glance across a long table. */
function Mark({ on, yes, no }) {
  const Icon = on ? CircleCheck : CircleDashed;
  return (
    <span className={`attendance-mark ${on ? "is-on" : "is-off"}`}>
      <Icon size={14} aria-hidden="true" />
      {on ? yes : no}
    </span>
  );
}

/** One person's events, shown when their row is expanded. Team entries list
 *  each teammate's own state underneath — a team checks in one member at a
 *  time, so "the team arrived" is never a single fact. */
function Entries({ entries }) {
  return (
    <ul className="attendance-entries">
      {entries.map((e) => (
        <li
          key={e.registration_id}
          // Already scored: dimmed, never hidden or disabled. It's a
          // glance-able "done", not a lock — see the volunteer roster, which
          // uses the same class for the same reason.
          className={`attendance-entry${e.evaluated ? " is-evaluated" : ""}`}
        >
          <div className="attendance-entry__head">
            <strong>{e.event_name}</strong>
            {e.is_team && e.team_name && <span className="cell-sub">team “{e.team_name}”</span>}
            {e.allocation_code && <span className="status-pill">{e.allocation_code}</span>}
            {e.venue_name && <span className="cell-sub">{e.venue_name}</span>}
          </div>

          <div className="attendance-entry__marks">
            <Mark on={e.checked_in} yes="Checked in" no={e.ever_checked_in ? "Checked out" : "Not checked in"} />
            <Mark
              on={e.evaluated}
              yes={`Scored${e.evaluation_count > 1 ? ` ×${e.evaluation_count}` : ""}`}
              no="Not scored"
            />
            {e.status !== "completed" && (
              <span className={`status-pill status-pill--${e.status || "unknown"}`}>{e.status}</span>
            )}
          </div>

          {e.is_team && e.holders.length > 0 && (
            <ul className="attendance-holders">
              {e.holders.map((h) => (
                <li key={h.member_index} className={h.member_index === e.member_index ? "is-self" : ""}>
                  <span>
                    {h.name || <span className="cell-sub">Unnamed</span>}
                    {h.allocation_code && <span className="cell-sub"> {h.allocation_code}</span>}
                  </span>
                  <Mark
                    on={h.checked_in}
                    yes="in"
                    no={h.ever_checked_in ? "out" : "—"}
                  />
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function Attendance() {
  const fetcher = useCallback(() => getAttendance(), []);
  const { data, error, loading } = useApi(fetcher);
  const people = data || [];

  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(() => new Set());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return people;
    return people.filter((p) =>
      [p.name, p.email, ...p.entries.map((e) => e.event_name), ...p.entries.map((e) => e.team_name)]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [query, people]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const toggle = (key) =>
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  if (loading) return <Loader />;
  if (error) return <p className="error">{error}</p>;

  const doorCount = people.filter((p) => p.fest_checked_in).length;

  return (
    <div className="admin">
      <section className="admin-panel">
        <div className="panel-head">
          <h2>Attendance</h2>
          <span className="muted">
            <DoorOpen size={14} aria-hidden="true" /> {doorCount} of {people.length} through the door
          </span>
        </div>

        <div className="filter-bar">
          <Input
            type="search"
            placeholder="Search name, email, event, team…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
        </div>

        {!people.length ? (
          <p className="empty-state">Nobody has registered yet.</p>
        ) : !filtered.length ? (
          <p className="empty-state">No one matches “{query}”.</p>
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Person</th>
                    {/* The door is one flag for the whole fest; attendance and
                        scoring are counted per event. Kept as separate columns
                        because they're separate facts. */}
                    <th>Fest entry</th>
                    <th className="num">Events</th>
                    <th className="num">Attended</th>
                    <th className="num">Scored</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((p) => {
                    const expanded = open.has(p.person_key);
                    return (
                      <Fragment key={p.person_key}>
                        <tr
                          className="attendance-row"
                          onClick={() => toggle(p.person_key)}
                        >
                          <td>
                            <button
                              type="button"
                              className="attendance-toggle"
                              aria-expanded={expanded}
                              aria-label={`${expanded ? "Hide" : "Show"} ${p.name || p.email}'s events`}
                            >
                              {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                            </button>
                            <strong>{p.name || <span className="cell-sub">Unnamed</span>}</strong>
                            <span className="cell-sub">{p.email}</span>
                          </td>
                          <td>
                            <Mark on={p.fest_checked_in} yes="Arrived" no="Not yet" />
                          </td>
                          <td className="num">{p.events_count}</td>
                          <td className="num">{p.attended_count}</td>
                          <td className="num">{p.evaluated_count}</td>
                        </tr>
                        {expanded && (
                          <tr className="attendance-detail">
                            <td colSpan={5}>
                              <Entries entries={p.entries} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <TablePagination page={safePage} totalPages={totalPages} onPage={setPage} />
          </>
        )}
      </section>
    </div>
  );
}
