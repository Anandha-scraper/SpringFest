"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Download, FileSpreadsheet, FileText, X } from "lucide-react";
import { useMemo, useState } from "react";

import { downloadTeamRegister, getEvents } from "@/api/client.js";
import { useToast } from "@/components/ui/toast.jsx";
import { useApi } from "@/hooks/useApi.js";
import "@/styles/components/download-team-register-dialog.css";

/** Shared export chooser for the all-participant and per-event admin screens.
 * The event page passes its id, which makes that event the default while still
 * letting an organiser deliberately switch to the full-fest register. */
export default function DownloadTeamRegisterDialog({ eventId = "", children }) {
  const toast = useToast();
  const { data, error, loading } = useApi(getEvents);
  const events = useMemo(
    () => [...(data || [])].sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id)),
    [data]
  );
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState(eventId ? "event" : "all");
  const [selectedEventId, setSelectedEventId] = useState(eventId);
  const [format, setFormat] = useState("xlsx");
  const [busy, setBusy] = useState(false);

  const setDialogOpen = (nextOpen) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setScope(eventId ? "event" : "all");
      setSelectedEventId(eventId);
      setFormat("xlsx");
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    const chosenEventId = scope === "event" ? selectedEventId : "";
    if (scope === "event" && !chosenEventId) {
      toast.bad("Choose an event before downloading its register.");
      return;
    }
    setBusy(true);
    try {
      await downloadTeamRegister({ eventId: chosenEventId, format });
      setOpen(false);
      toast.ok(`${format === "pdf" ? "PDF" : "Excel"} register download started.`);
    } catch (err) {
      toast.bad(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={setDialogOpen}>
      <Dialog.Trigger asChild>{children}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="team-register-dialog__overlay" />
        <Dialog.Content className="team-register-dialog" aria-describedby="team-register-description">
          <div className="team-register-dialog__head">
            <div>
              <Dialog.Title>Download team register</Dialog.Title>
              <Dialog.Description id="team-register-description">
                Confirmed registrations only. Each participant receives a signature box.
              </Dialog.Description>
            </div>
            <Dialog.Close className="team-register-dialog__close" aria-label="Close download dialog">
              <X size={18} aria-hidden="true" />
            </Dialog.Close>
          </div>

          <form className="team-register-dialog__body" onSubmit={submit}>
            <fieldset className="team-register-dialog__group">
              <legend>Registration scope</legend>
              <label className="team-register-dialog__choice">
                <input
                  type="radio"
                  name="register-scope"
                  value="all"
                  checked={scope === "all"}
                  onChange={() => setScope("all")}
                />
                <span><strong>All events</strong><small>One section or worksheet for each event.</small></span>
              </label>
              <label className="team-register-dialog__choice">
                <input
                  type="radio"
                  name="register-scope"
                  value="event"
                  checked={scope === "event"}
                  onChange={() => setScope("event")}
                />
                <span><strong>Specific event</strong><small>Download a single event register.</small></span>
              </label>
            </fieldset>

            {scope === "event" && (
              <label className="team-register-dialog__field">
                <span>Event</span>
                <select
                  className="input"
                  value={selectedEventId}
                  onChange={(event) => setSelectedEventId(event.target.value)}
                  disabled={loading || Boolean(error)}
                  required
                >
                  <option value="">{loading ? "Loading events..." : "Choose an event"}</option>
                  {events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
                </select>
                {error && <small className="team-register-dialog__error">Could not load events: {error}</small>}
              </label>
            )}

            <fieldset className="team-register-dialog__group">
              <legend>File format</legend>
              <div className="team-register-dialog__formats">
                <label className={`team-register-dialog__format ${format === "xlsx" ? "is-selected" : ""}`}>
                  <input type="radio" name="register-format" value="xlsx" checked={format === "xlsx"} onChange={() => setFormat("xlsx")} />
                  <FileSpreadsheet size={21} aria-hidden="true" />
                  <span><strong>Excel</strong><small>Editable and print-ready.</small></span>
                </label>
                <label className={`team-register-dialog__format ${format === "pdf" ? "is-selected" : ""}`}>
                  <input type="radio" name="register-format" value="pdf" checked={format === "pdf"} onChange={() => setFormat("pdf")} />
                  <FileText size={21} aria-hidden="true" />
                  <span><strong>PDF</strong><small>A4 landscape for printing.</small></span>
                </label>
              </div>
            </fieldset>

            <div className="team-register-dialog__actions">
              <Dialog.Close type="button" className="btn btn-ghost" disabled={busy}>Cancel</Dialog.Close>
              <button className="btn" type="submit" disabled={busy || (scope === "event" && (!selectedEventId || loading || Boolean(error)))}>
                <Download size={16} aria-hidden="true" /> {busy ? "Preparing..." : `Download ${format === "pdf" ? "PDF" : "Excel"}`}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
