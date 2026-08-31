"use client";

import { useEffect, useRef, useState } from "react";
import "@/styles/pages/volunteer-check-in.css";
import { CheckCircle2, Circle, DoorOpen, Keyboard, MapPin, ScanLine, XCircle } from "lucide-react";
import { festCheckIn, scanPersonToken, toggleCheckIn } from "@/api/client.js";
import { formatEventTime } from "@/utils/format.js";

const SCANNER_ID = "volunteer-qr-scanner";
const RESCAN_GUARD_MS = 2000;

/** One event row for the scanned person, with an event check-in/out toggle. */
function EventRow({ reg, onToggle, busy }) {
  const blocked = reg.status !== "completed" || !reg.can_event_check_in;
  const why =
    reg.status !== "completed"
      ? "Not a confirmed registration"
      : !reg.can_event_check_in
        ? "This event isn't at your venue"
        : undefined;
  return (
    <li className="checkin-row" style={blocked && !busy ? { opacity: 0.6 } : undefined}>
      <div className="checkin-row-info">
        <div className="checkin-row__head">
          <strong>{reg.event_name}</strong>
          {reg.allocation_code && <span className="checkin-row__code">{reg.allocation_code}</span>}
        </div>
        <span className="schedule-meta">{formatEventTime(reg) || "Date to be announced"}</span>
        {reg.venue_name && (
          <span className="schedule-meta">
            <MapPin size={13} aria-hidden="true" />
            {reg.venue_name}
          </span>
        )}
        {reg.team_name && <span className="muted checkin-row__team">Team: {reg.team_name}</span>}
        {!reg.can_event_check_in && reg.status === "completed" && (
          <span className="muted checkin-row__team">Another venue's event</span>
        )}
      </div>
      <button
        type="button"
        className={`btn btn-sm ${reg.checked_in ? "btn-ghost" : ""}`}
        disabled={busy || blocked}
        onClick={() => onToggle(reg, !reg.checked_in)}
        title={why}
      >
        {reg.checked_in ? (
          <>
            <CheckCircle2 size={15} aria-hidden="true" /> Checked in
          </>
        ) : (
          <>
            <Circle size={15} aria-hidden="true" /> Check in
          </>
        )}
      </button>
    </li>
  );
}

function Scanner({ onDecode, active }) {
  const [scanError, setScanError] = useState("");
  const lastRef = useRef({ text: "", at: 0 });

  useEffect(() => {
    if (!active) return undefined;
    let scanner;
    let cancelled = false;
    let started = false;

    import("html5-qrcode").then(({ Html5Qrcode }) => {
      if (cancelled) return;
      scanner = new Html5Qrcode(SCANNER_ID);
      scanner
        .start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (text) => {
            const now = Date.now();
            if (text === lastRef.current.text && now - lastRef.current.at < RESCAN_GUARD_MS) return;
            lastRef.current = { text, at: now };
            onDecode(text);
          },
          () => {}
        )
        .then(() => {
          started = true;
        })
        .catch((err) => setScanError(err?.message || "Could not start the camera"));
    });

    return () => {
      cancelled = true;
      if (!scanner || !started) return;
      try {
        scanner
          .stop()
          .then(() => scanner.clear())
          .catch(() => {});
      } catch {
        /* already stopped */
      }
    };
  }, [active, onDecode]);

  if (scanError) {
    return (
      <div className="notice notice-warn">
        <strong>Camera unavailable</strong>
        <p>{scanError} — allow camera access, or use "Enter ID" below.</p>
      </div>
    );
  }

  return <div id={SCANNER_ID} className="qr-scanner" />;
}

export default function VolunteerCheckIn() {
  const [checkType, setCheckType] = useState("event"); // "fest" | "event"
  const [mode, setMode] = useState("scan"); // "scan" | "manual"
  const [person, setPerson] = useState(null);
  const [manualId, setManualId] = useState("");
  const [error, setError] = useState("");
  const [busyKey, setBusyKey] = useState("");

  const handleDecode = (token) => {
    setError("");
    scanPersonToken(token)
      .then(setPerson)
      .catch((e) => setError(e.message));
  };

  const handleManual = (e) => {
    e.preventDefault();
    if (!manualId.trim()) return;
    setError("");
    setBusyKey(manualId);
    toggleCheckIn(manualId.trim(), 0, true)
      .then(() => setManualId(""))
      .catch((e) => setError(e.message))
      .finally(() => setBusyKey(""));
  };

  const handleToggle = (reg, checkedIn) => {
    const key = `${reg.registration_id}.${reg.member_index}`;
    setBusyKey(key);
    toggleCheckIn(reg.registration_id, reg.member_index, checkedIn)
      .then(() => {
        setPerson((p) => ({
          ...p,
          registrations: p.registrations.map((r) =>
            r.registration_id === reg.registration_id && r.member_index === reg.member_index
              ? { ...r, checked_in: checkedIn }
              : r
          ),
        }));
      })
      .catch((e) => setError(e.message))
      .finally(() => setBusyKey(""));
  };

  const handleFestCheckIn = () => {
    setBusyKey("fest");
    festCheckIn(person.uid)
      .then(() => setPerson((p) => ({ ...p, fest_checked_in: true })))
      .catch((e) => setError(e.message))
      .finally(() => setBusyKey(""));
  };

  const reset = () => {
    setPerson(null);
    setError("");
  };

  return (
    <section className="admin-panel checkin-panel">
      <div className="panel-head">
        <h2>Check-in</h2>
        <div className="checkin-mode-toggle">
          <button
            type="button"
            className={`btn btn-sm ${checkType === "fest" ? "" : "btn-ghost"}`}
            onClick={() => {
              setCheckType("fest");
              setMode("scan");
            }}
          >
            <DoorOpen size={15} aria-hidden="true" /> Fest entry
          </button>
          <button
            type="button"
            className={`btn btn-sm ${checkType === "event" ? "" : "btn-ghost"}`}
            onClick={() => setCheckType("event")}
          >
            <MapPin size={15} aria-hidden="true" /> Event
          </button>
        </div>
      </div>

      <div className="checkin-mode-toggle" style={{ marginBottom: ".75rem" }}>
        <button
          type="button"
          className={`btn btn-sm ${mode === "scan" ? "" : "btn-ghost"}`}
          onClick={() => setMode("scan")}
        >
          <ScanLine size={15} aria-hidden="true" /> Scan
        </button>
        {checkType === "event" && (
          <button
            type="button"
            className={`btn btn-sm ${mode === "manual" ? "" : "btn-ghost"}`}
            onClick={() => setMode("manual")}
          >
            <Keyboard size={15} aria-hidden="true" /> Enter ID
          </button>
        )}
      </div>

      {error && (
        <div className="notice notice-warn">
          <strong>Couldn't do that</strong>
          <p>{error}</p>
        </div>
      )}

      {mode === "scan" && !person && <Scanner active={mode === "scan"} onDecode={handleDecode} />}

      {mode === "manual" && checkType === "event" && !person && (
        <form className="form checkin-manual-form" onSubmit={handleManual}>
          <label htmlFor="ci-manual">Registration ID</label>
          <input
            id="ci-manual"
            placeholder="Paste or type the registration id"
            value={manualId}
            onChange={(e) => setManualId(e.target.value)}
          />
          <button className="btn" type="submit" disabled={!manualId.trim() || busyKey === manualId}>
            {busyKey === manualId ? "Checking in…" : "Check in the lead"}
          </button>
          <p className="muted checkin-note">
            No ticket or QR on hand? Check in the team lead by their registration id (only works for
            your venue's event).
          </p>
        </form>
      )}

      {person && (
        <div className="checkin-person">
          <div className="checkin-person-head">
            {person.picture ? (
              <img src={person.picture} alt="" width={44} height={44} className="checkin-avatar" />
            ) : (
              <div className="checkin-avatar checkin-avatar-placeholder">
                {(person.name || person.email || "?")[0]?.toUpperCase()}
              </div>
            )}
            <div>
              <strong>{person.name || person.email}</strong>
              {person.name && <p className="muted checkin-note">{person.email}</p>}
            </div>
          </div>

          {checkType === "fest" ? (
            <div className="checkin-fest">
              {person.fest_checked_in ? (
                <p className="notice">
                  <CheckCircle2 size={15} aria-hidden="true" /> Already marked present at the fest.
                </p>
              ) : (
                <button
                  type="button"
                  className="btn"
                  disabled={busyKey === "fest"}
                  onClick={handleFestCheckIn}
                >
                  <DoorOpen size={15} aria-hidden="true" /> Mark present at fest
                </button>
              )}
            </div>
          ) : person.registrations.length === 0 ? (
            <p className="empty-state">No registrations found for this person.</p>
          ) : (
            <ul className="checkin-row-list">
              {person.registrations.map((reg) => (
                <EventRow
                  key={`${reg.registration_id}.${reg.member_index}`}
                  reg={reg}
                  onToggle={handleToggle}
                  busy={busyKey === `${reg.registration_id}.${reg.member_index}`}
                />
              ))}
            </ul>
          )}

          <button className="btn btn-ghost btn-sm" type="button" onClick={reset}>
            <ScanLine size={15} aria-hidden="true" /> Scan another
          </button>
        </div>
      )}

      {!person && mode === "scan" && (
        <p className="muted checkin-note checkin-note--spaced">
          <XCircle size={13} aria-hidden="true" className="checkin-note__icon" />
          {checkType === "fest"
            ? "Scan the participant's QR to mark them present at the fest."
            : "Scan the participant's QR to check them in for your venue's event."}
        </p>
      )}
    </section>
  );
}
