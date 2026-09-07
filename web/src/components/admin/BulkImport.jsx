"use client";

import { useRef, useState } from "react";

import { Download, FileSpreadsheet } from "lucide-react";

import { downloadImportTemplate, importRegistrations } from "@/api/client.js";
import { useToast } from "@/components/ui/toast.jsx";

/** Bulk entry from the .xlsx template.
 *
 * The flow is deliberately validate-then-commit: "Check the file" runs the
 * whole import server-side and writes nothing, so an admin fixes their
 * spreadsheet against real errors before anything lands. Committing anyway
 * with known-bad rows is allowed — good rows import, bad ones come back
 * listed — because a typo on row 198 should not discard the other 197.
 */
export default function BulkImport() {
  const toast = useToast();
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState("");
  const [report, setReport] = useState(null);

  const run = async (dryRun) => {
    if (!file || busy) return;
    setBusy(dryRun ? "check" : "import");
    try {
      const res = await importRegistrations(file, { dryRun });
      setReport(res);
      if (dryRun) {
        toast.info(
          res.errors.length
            ? `${res.errors.length} row${res.errors.length === 1 ? "" : "s"} need fixing.`
            : `Looks good — ${res.summary.would_create} registration${res.summary.would_create === 1 ? "" : "s"} ready.`
        );
      } else {
        toast.ok(
          `Imported ${res.summary.created_registrations} registration${res.summary.created_registrations === 1 ? "" : "s"}.`
        );
        // A committed file must not be re-submitted by a stray second click.
        setFile(null);
        if (fileRef.current) fileRef.current.value = "";
      }
    } catch (err) {
      toast.bad(err.message);
      setReport(null);
    } finally {
      setBusy("");
    }
  };

  const getTemplate = async () => {
    try {
      await downloadImportTemplate();
    } catch (err) {
      toast.bad(err.message);
    }
  };

  return (
    <section className="admin-panel">
      <div className="panel-head">
        <h2>Import from a spreadsheet</h2>
        <button className="btn btn-sm btn-ghost" type="button" onClick={getTemplate}>
          <Download size={15} aria-hidden="true" /> Template
        </button>
      </div>

      <p className="muted panel-note">
        One row per person. Give everyone on a team the same team name and event, and put the
        lead first. Imported people are recorded as paid and get their code straight away —
        they do not need an account first. The template lists every event and its id.
      </p>

      <div className="import-controls">
        <label className="btn btn-ghost" htmlFor="import-file">
          <FileSpreadsheet size={15} aria-hidden="true" />
          {file ? file.name : "Choose .xlsx"}
        </label>
        <input
          id="import-file"
          ref={fileRef}
          className="visually-hidden"
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(e) => {
            setFile(e.target.files?.[0] || null);
            setReport(null);
          }}
        />
        <button
          className="btn btn-ghost"
          type="button"
          disabled={!file || Boolean(busy)}
          onClick={() => run(true)}
        >
          {busy === "check" ? "Checking…" : "Check the file"}
        </button>
        <button
          className="btn"
          type="button"
          disabled={!file || Boolean(busy)}
          onClick={() => run(false)}
        >
          {busy === "import" ? "Importing…" : "Import"}
        </button>
      </div>

      {report && (
        <div className="import-report">
          <p>
            {report.dry_run ? (
              <>
                <strong>Dry run</strong> — nothing was saved. {report.total_rows} row
                {report.total_rows === 1 ? "" : "s"}, {report.summary.would_create} registration
                {report.summary.would_create === 1 ? "" : "s"} ready to import.
              </>
            ) : (
              <>
                <strong>Imported</strong> {report.summary.created_registrations} registration
                {report.summary.created_registrations === 1 ? "" : "s"} covering{" "}
                {report.summary.created_holders} participant
                {report.summary.created_holders === 1 ? "" : "s"}.
              </>
            )}
          </p>

          {report.errors.length > 0 && (
            <>
              <h4 className="import-report-head">
                {report.errors.length} row{report.errors.length === 1 ? "" : "s"} not imported
              </h4>
              <ul className="import-errors">
                {report.errors.map((e, i) => (
                  <li key={`${e.row}-${i}`}>
                    {/* The spreadsheet's own row number — the admin is looking
                        at Excel, not at our array. */}
                    <span className="mono">Row {e.row}</span> {e.detail}
                    {e.team_name && <span className="muted"> (team {e.team_name})</span>}
                  </li>
                ))}
              </ul>
            </>
          )}

          {report.warnings.length > 0 && (
            <ul className="import-errors">
              {report.warnings.map((w, i) => (
                <li key={i}>
                  <span className="mono">Row {w.row}</span> {w.detail}
                </li>
              ))}
            </ul>
          )}

          {!report.dry_run && report.created.length > 0 && (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Rows</th>
                    <th>Participant</th>
                    <th>Event</th>
                    <th>Codes</th>
                  </tr>
                </thead>
                <tbody>
                  {report.created.map((c) => (
                    <tr key={c.registration_id}>
                      <td className="mono">{c.row_numbers.join(", ")}</td>
                      <td>
                        {c.name}
                        {c.team_name && <span className="cell-sub">Team {c.team_name}</span>}
                      </td>
                      <td>{c.event_name}</td>
                      <td>
                        {c.allocation_codes.map((code) => (
                          <span className="alloc-code" key={code}>
                            {code}
                          </span>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
