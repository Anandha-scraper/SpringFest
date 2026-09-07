"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "@/styles/pages/admin/payment.css";
import { Camera, CreditCard, Lock, LockOpen, Trash2, Upload } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.jsx";
import { useToast } from "@/components/ui/toast.jsx";
import Loader from "@/components/common/Loader.jsx";
import FormActions from "@/components/admin/FormActions.jsx";
import {
  getAppSettings,
  getEvents,
  paymentQrObjectUrl,
  removePaymentQr,
  updateAppSettings,
  updateEvent,
  uploadPaymentQr,
} from "@/api/client.js";
import { useApi } from "@/hooks/useApi.js";
import { EVENT_CATEGORIES } from "@/content/formOptions.js";

const MODES = [
  {
    value: "gateway",
    label: "Payment gateway",
    icon: CreditCard,
  },
  {
    value: "screenshot",
    label: "Screenshot-based",
    icon: Camera,
  },
];

// Mirrors MAX_INSTRUCTIONS in backend/services/settings.js — the server is
// the authority and rejects a longer list; this just stops the UI offering a
// box that would be refused on save.
const MAX_POINTS = 12;

// Each notice is a heading plus a line of detail — the shape the landing
// page's cards render. Either field may be left empty.
const blankPoint = () => ({ title: "", text: "" });
const isBlank = (p) => !p.title.trim() && !p.text.trim();

/** Saved instructions → editor rows, always with one empty row at the end.
 *  Tolerates the pre-cards shape (a plain string per point) the same way the
 *  server's parser does, so an older saved list still loads. Shared by the
 *  first seed and by Cancel, which has to restore exactly what was saved. */
const pointsFromSettings = (s) => [
  ...(s?.event_instructions || []).map((p) =>
    typeof p === "string" ? { title: "", text: p } : { title: p?.title || "", text: p?.text || "" }
  ),
  blankPoint(),
];

/** Saved caps → editor values. Held as strings so an input can be emptied
 *  mid-edit without snapping back to 0. */
const limitsFromSettings = (s) =>
  Object.fromEntries(EVENT_CATEGORIES.map((c) => [c, String(s?.category_limits?.[c] ?? 0)]));

const QR_TYPES = ["image/png", "image/jpeg", "image/webp"];
const QR_MAX_BYTES = 5 * 1024 * 1024;

const load = () => Promise.all([getAppSettings(), getEvents()]);

/** "Edit" for a panel that is read-only until you ask for it.
 *
 * Purely a client-side guard against a stray click — unlike the payment
 * lock beside it, nothing here is enforced by the server, and it is
 * deliberately not: `registration_open` has to stay something an organiser
 * can flip in seconds when a venue fills up, without unlocking anything
 * first. Renders nothing while the panel is already being edited; Cancel
 * lives in FormActions, next to Save, where a form's controls belong.
 */
function EditToggle({ editing, onEdit, disabled }) {
  if (editing) return null;
  return (
    <button className="btn btn-ghost btn-sm" type="button" disabled={disabled} onClick={onEdit}>
      <LockOpen size={14} aria-hidden="true" /> Edit
    </button>
  );
}

/** The saved QR, fetched as a blob because the route is authenticated.
 *  Re-fetched whenever `version` changes, so a fresh upload replaces it. */
function SavedQr({ version }) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    let url = "";
    let live = true;
    paymentQrObjectUrl()
      .then((u) => {
        if (!live) return URL.revokeObjectURL(u);
        url = u;
        setSrc(u);
      })
      .catch(() => setSrc(""));
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [version]);

  if (!src) return null;
  return <img className="pay-qr-preview" src={src} alt="The payment QR participants see" />;
}

export default function PaymentSettings() {
  const toast = useToast();
  const fetcher = useCallback(load, []);
  const { data, error: loadError, loading, reload } = useApi(fetcher);
  const [settings, events] = data || [];

  const [upiId, setUpiId] = useState("");
  const [whatsappUrl, setWhatsappUrl] = useState("");
  // Always carries one trailing empty row, which is what makes "add a point"
  // need no button. Mirrors the server's own cap.
  const [points, setPoints] = useState([blankPoint()]);
  // What actually gets saved: the trailing empty row, and any the admin
  // cleared in the middle, are never sent. A row with only one of the two
  // fields filled is kept — a bare heading and a bare line are both real
  // cards, and the server agrees.
  const filledPoints = points
    .map((p) => ({ title: p.title.trim(), text: p.text.trim() }))
    .filter((p) => p.title || p.text);

  /** Edit one field, and keep exactly one empty row at the end so adding a
   *  point never needs an "add" button — until the cap, where the trailing
   *  row would be one the server refuses. */
  const setPoint = (index, field, value) => {
    const next = points.map((p, j) => (j === index ? { ...p, [field]: value } : p));
    const filled = next.filter((p) => !isBlank(p)).length;
    if (!isBlank(next[next.length - 1]) && filled < MAX_POINTS) next.push(blankPoint());
    setPoints(next);
  };
  const [qrFile, setQrFile] = useState(null);
  const [qrPreview, setQrPreview] = useState("");
  const [pendingMode, setPendingMode] = useState(null);
  const [confirmingClose, setConfirmingClose] = useState(false);
  const [confirmingUnlock, setConfirmingUnlock] = useState(false);
  const [busy, setBusy] = useState(false);
  const [limits, setLimits] = useState({});
  const fileInput = useRef(null);

  // Which of the three row-2 panels is currently unlocked for editing.
  // Client-side only; see EditToggle.
  const [editing, setEditing] = useState({});
  const isEditing = (key) => Boolean(editing[key]);
  const startEdit = (key) => setEditing((prev) => ({ ...prev, [key]: true }));
  const stopEdit = (key) => setEditing((prev) => ({ ...prev, [key]: false }));

  const mode = settings?.payment_mode || "gateway";
  const registrationOpen = settings?.registration_open !== false;
  const locked = Boolean(settings?.payment_locked);
  const hasQr = Boolean(settings?.payment_qr_path);

  // Seed the field once settings land, without clobbering an edit in progress
  // on a background reload.
  useEffect(() => {
    if (settings) setUpiId((prev) => prev || settings.payment_upi_id || "");
  }, [settings]);

  // Same non-clobbering seed for the group link.
  useEffect(() => {
    if (settings) setWhatsappUrl((prev) => prev || settings.whatsapp_group_url || "");
  }, [settings]);

  // ...and for the instructions. `seeded` rather than a length check: an
  // organiser who deletes every point back to one empty box must not have the
  // saved list poured back in by the next background reload.
  const seeded = useRef(false);
  useEffect(() => {
    if (!settings || seeded.current) return;
    seeded.current = true;
    setPoints(pointsFromSettings(settings));
  }, [settings]);

  // Same non-clobbering seed for the per-category caps.
  useEffect(() => {
    if (!settings) return;
    setLimits((prev) => (Object.keys(prev).length ? prev : limitsFromSettings(settings)));
  }, [settings]);

  /** Abandon an edit: put back exactly what is saved and re-lock the panel.
   *  Re-seeds explicitly rather than leaning on the effects above — `seeded`
   *  deliberately fires once, and the limits effect only fills an empty map,
   *  so neither would restore a value the admin has since typed over. */
  const cancelEdit = (key) => {
    if (key === "instructions") setPoints(pointsFromSettings(settings));
    if (key === "limits") setLimits(limitsFromSettings(settings));
    stopEdit(key);
  };

  // Object URLs leak until revoked — tie the lifetime to the chosen file.
  useEffect(() => {
    if (!qrFile) return setQrPreview("");
    const url = URL.createObjectURL(qrFile);
    setQrPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [qrFile]);

  const eventRows = useMemo(
    () => [...(events || [])].sort((a, b) => a.name.localeCompare(b.name)),
    [events],
  );
  // While a paid event is still taking sign-ups, the QR is the only way its
  // screenshot-mode participants can pay — it can be replaced but not removed.
  const qrLockedByEvents = (events || []).some(
    (e) => (e.fee || 0) > 0 && e.registration_open !== false,
  );

  /** Returns whether the write landed. Callers that lock a panel again on
   *  success need to know — re-locking after a rejected save would hide the
   *  values the admin still has to fix. */
  const save = async (patch, message) => {
    setBusy(true);
    try {
      await updateAppSettings(patch);
      await reload();
      toast.ok(message);
      return true;
    } catch (err) {
      toast.bad(err.message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const confirmSwitch = async () => {
    const next = pendingMode;
    setPendingMode(null);
    if (next) {
      await save(
        { payment_mode: next },
        `Switched to ${next === "gateway" ? "gateway" : "screenshot"} payments.`,
      );
    }
  };

  const confirmCloseToggle = async () => {
    setConfirmingClose(false);
    const next = !registrationOpen;
    await save(
      { registration_open: next },
      next ? "Registration reopened." : "Registration closed — no new sign-ups until reopened.",
    );
  };

  const toggleEvent = async (ev) => {
    const next = ev.registration_open === false;
    setBusy(true);
    try {
      await updateEvent(ev.id, { registration_open: next });
      await reload();
      toast.ok(`${ev.name} is now ${next ? "open" : "closed"}.`);
    } catch (err) {
      toast.bad(err.message);
    } finally {
      setBusy(false);
    }
  };

  const pickQr = (e) => {
    const chosen = e.target.files?.[0];
    if (!chosen) return setQrFile(null);
    // Checked here as well as server-side so a rejected upload doesn't cost a
    // round trip.
    if (!QR_TYPES.includes(chosen.type)) {
      setQrFile(null);
      return toast.bad("The QR must be a PNG, JPEG or WebP image.");
    }
    if (chosen.size > QR_MAX_BYTES) {
      setQrFile(null);
      return toast.bad("That image is over 5 MB.");
    }
    setQrFile(chosen);
  };

  /** UPI id and QR save together — they're one instruction to a participant,
   *  and saving half of it would leave people paying the wrong place. */
  const saveDetails = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (upiId !== (settings.payment_upi_id || "")) {
        await updateAppSettings({ payment_upi_id: upiId });
      }
      if (qrFile) await uploadPaymentQr(qrFile);
      setQrFile(null);
      if (fileInput.current) fileInput.current.value = "";
      await reload();
      toast.ok("Payment details saved.");
    } catch (err) {
      toast.bad(err.message);
    } finally {
      setBusy(false);
    }
  };

  const dropQr = async () => {
    setBusy(true);
    try {
      await removePaymentQr();
      await reload();
      toast.ok("QR removed.");
    } catch (err) {
      toast.bad(err.message);
    } finally {
      setBusy(false);
    }
  };

  const setLock = async (next) => {
    setConfirmingUnlock(false);
    await save(
      { payment_locked: next },
      next ? "Payment details locked." : "Payment details unlocked — edit with care.",
    );
  };

  if (loading) return <Loader />;
  if (loadError) return <p className="error">{loadError}</p>;

  const target = MODES.find((m) => m.value === pendingMode);

  return (
    <div className="admin">
      {/* Row 1 — how money is taken, and how people are reached afterwards.
          The three panels an organiser sets up once and rarely revisits. */}
      <div className="pay-row pay-row--three">
        <section className="admin-panel">
          <div className="panel-head">
            <h2>Current method</h2>
            <span className="muted">
              {settings?.updated_at
                ? `Changed ${new Date(settings.updated_at).toLocaleString()}${settings.updated_by ? ` by ${settings.updated_by}` : ""}`
                : "Never changed"}
            </span>
          </div>

          <div className="mode-grid">
            {MODES.map((m) => {
              const Icon = m.icon;
              const active = mode === m.value;
              return (
                <button
                  key={m.value}
                  type="button"
                  className={`mode-card ${active ? "active" : ""}`}
                  aria-pressed={active}
                  onClick={() => !active && setPendingMode(m.value)}
                >
                  <span className="mode-card-head">
                    <Icon size={18} aria-hidden="true" />
                    <strong>{m.label}</strong>
                    {active && <span className="status-pill status-pill--admin">In use</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="admin-panel">
          <div className="panel-head">
            <h2>Where participants pay</h2>
          {locked && (
            <span className="status-pill status-pill--completed">
              <Lock size={12} aria-hidden="true" /> Locked
            </span>
          )}
        </div>
        {locked ? (
          <div className="pay-locked">
            <div className="pay-locked-row">
              <span className="pay-target-label">UPI ID</span>
              <code className="pay-target-id">{settings.payment_upi_id || "—"}</code>
            </div>
            {hasQr ? (
              <SavedQr version={settings.payment_qr_path} />
            ) : (
              <p className="muted">No QR uploaded.</p>
            )}
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => setConfirmingUnlock(true)}
            >
              <LockOpen size={15} aria-hidden="true" /> Unlock to edit
            </button>
          </div>
        ) : (
          <form className="form" onSubmit={saveDetails}>
            <label htmlFor="upi-id">UPI ID</label>
            <input
              id="upi-id"
              className="input"
              placeholder="e.g. springfest@okhdfcbank"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
            />

            <label htmlFor="qr-file">Payment QR</label>
            <input
              id="qr-file"
              ref={fileInput}
              type="file"
              accept={QR_TYPES.join(",")}
              onChange={pickQr}
            />
            <p className="muted pay-hint">PNG, JPEG or WebP, up to 5 MB.</p>

            {qrPreview ? (
              <img className="pay-qr-preview" src={qrPreview} alt="The QR you're about to save" />
            ) : (
              hasQr && <SavedQr version={settings.payment_qr_path} />
            )}

            <div className="form-actions-row">
              <FormActions saveLabel={qrFile ? "Save & upload QR" : "Save details"} />
              {hasQr && !qrFile && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={busy || qrLockedByEvents}
                  title={
                    qrLockedByEvents
                      ? "Can't remove the QR while a paid event is still open — replace it instead."
                      : undefined
                  }
                  onClick={dropQr}
                >
                  <Trash2 size={14} aria-hidden="true" /> Remove QR
                </button>
              )}
              {(settings.payment_upi_id || hasQr) && (
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={busy}
                  onClick={() => setLock(true)}
                >
                  <Lock size={14} aria-hidden="true" /> Lock these details
                </button>
              )}
            </div>
          </form>
        )}
        </section>

        {/* Not behind the payment lock either, and for the same reason: the
            lock covers the UPI id and the QR. A group link is exactly the kind
            of thing organisers fix at the last minute. */}
        <section className="admin-panel">
          <div className="panel-head">
            <h2>WhatsApp group</h2>
          </div>
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              save({ whatsapp_group_url: whatsappUrl.trim() }, "Group link saved.");
            }}
          >
            <div className="field">
              <label htmlFor="whatsapp-url">Invite link</label>
              <input
                id="whatsapp-url"
                type="url"
                placeholder="https://chat.whatsapp.com/…"
                disabled={busy}
                value={whatsappUrl}
                onChange={(e) => setWhatsappUrl(e.target.value)}
              />
            </div>
            <FormActions editing={false} saveLabel="Save link" disabled={busy} />
          </form>
        </section>
      </div>

      {/* Row 2 — the settings that change what participants are told.
          Limits and the window are short, so they share the narrow column;
          the instructions editor takes the wide one because it holds up to
          twelve two-field rows. */}
      <div className="pay-row pay-row--split">
        <div className="pay-col">
        {/* Deliberately NOT gated by `locked` as every other control here is:
            that lock covers the UPI id and the QR, where a wrong value sends
            real money somewhere wrong. A cap is a policy an organiser may
            legitimately want to change mid-fest. */}
        <section className="admin-panel">
          <div className="panel-head">
            <h2>Registration limits</h2>
            <EditToggle
              editing={isEditing("limits")}
              disabled={busy}
              onEdit={() => startEdit("limits")}
            />
          </div>
          <form
            className="category-limits"
            onSubmit={(e) => {
              e.preventDefault();
              save(
                {
                  category_limits: Object.fromEntries(
                    EVENT_CATEGORIES.map((c) => [c, Number(limits[c]) || 0]),
                  ),
                },
                "Per-category limits saved.",
              ).then((ok) => ok && stopEdit("limits"));
            }}
          >
            <ul className="category-limit-list">
              {EVENT_CATEGORIES.map((c) => (
                <li key={c}>
                  <label htmlFor={`limit-${c}`}>{c}</label>
                  <input
                    id={`limit-${c}`}
                    className="input input-sm"
                    type="number"
                    min="0"
                    disabled={busy || !isEditing("limits")}
                    value={limits[c] ?? ""}
                    onChange={(e) => setLimits({ ...limits, [c]: e.target.value })}
                  />
                  <span className="cell-sub">
                    {Number(limits[c]) > 0 ? "per participant" : "no limit"}
                  </span>
                </li>
              ))}
            </ul>
            {isEditing("limits") && (
              <FormActions
                saveLabel="Save limits"
                disabled={busy}
                onCancel={() => cancelEdit("limits")}
              />
            )}
          </form>
        </section>

        <section className="admin-panel">
          <div className="panel-head">
            <h2>Registration window</h2>
            <span className={`status-pill ${registrationOpen ? "status-pill--completed" : "status-pill--failed"}`}>
              {registrationOpen ? "Open" : "Closed"}
            </span>
            {/* No form here, so no FormActions to hold a Cancel — the toggle
                itself flips back to "Edit" once the panel is re-locked. */}
            {isEditing("window") ? (
              <button
                className="btn btn-ghost btn-sm"
                type="button"
                disabled={busy}
                onClick={() => stopEdit("window")}
              >
                <Lock size={14} aria-hidden="true" /> Done
              </button>
            ) : (
              <EditToggle editing={false} disabled={busy} onEdit={() => startEdit("window")} />
            )}
          </div>
          <button
            type="button"
            className={`btn ${registrationOpen ? "btn-ghost" : ""}`}
            disabled={busy || !isEditing("window")}
            onClick={() => setConfirmingClose(true)}
          >
            {registrationOpen ? (
              <>
                <Lock size={15} aria-hidden="true" /> Close Registration
              </>
            ) : (
              <>
                <LockOpen size={15} aria-hidden="true" /> Reopen Registration
              </>
            )}
          </button>

          {/* Per-event switches under the master. Both must be open for
              someone to register, so these are moot while the fest is shut. */}
          <div className={`event-toggles ${registrationOpen ? "" : "is-disabled"}`}>
            <h3>Individual events</h3>
            {!registrationOpen && (
              <p className="muted">
                Registration is closed fest-wide, so every event below is closed
                regardless of its own setting.
              </p>
            )}
            {!eventRows.length ? (
              <p className="empty-state">No events yet.</p>
            ) : (
              <ul className="event-toggle-list">
                {eventRows.map((ev) => {
                  const open = ev.registration_open !== false;
                  return (
                    <li key={ev.id}>
                      <span className="event-toggle-name">
                        <strong>{ev.name}</strong>
                        <span className="cell-sub">{ev.category}</span>
                      </span>
                      <button
                        type="button"
                        className={`btn btn-sm ${open ? "btn-ghost" : ""}`}
                        disabled={busy || !isEditing("window")}
                        onClick={() => toggleEvent(ev)}
                      >
                        {open ? "Close" : "Reopen"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
        </div>

        <section className="admin-panel">
          <div className="panel-head">
            <h2>Event instructions</h2>
            <span className="muted">{filledPoints.length} of {MAX_POINTS}</span>
            <EditToggle
              editing={isEditing("instructions")}
              disabled={busy}
              onEdit={() => startEdit("instructions")}
            />
          </div>
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              // Blanks are dropped server-side too; trimming here keeps the
              // inputs and what gets saved visibly the same thing.
              save({ event_instructions: filledPoints }, "Instructions saved.").then(
                (ok) => ok && stopEdit("instructions")
              );
            }}
          >
            <ol className="instruction-list">
              {points.map((point, i) => (
                <li key={i}>
                  <span className="instruction-num">{String(i + 1).padStart(2, "0")}</span>
                  <div className="instruction-fields">
                    <input
                      className="instruction-title"
                      aria-label={`Heading ${i + 1}`}
                      placeholder="Heading"
                      maxLength={80}
                      disabled={busy || !isEditing("instructions")}
                      value={point.title}
                      onChange={(e) => setPoint(i, "title", e.target.value)}
                    />
                    <input
                      aria-label={`Detail ${i + 1}`}
                      placeholder={
                        i === points.length - 1 ? "Add another point…" : "What it means"
                      }
                      maxLength={240}
                      disabled={busy || !isEditing("instructions")}
                      value={point.text}
                      onChange={(e) => setPoint(i, "text", e.target.value)}
                    />
                  </div>
                  <button
                    className="btn btn-sm btn-ghost"
                    type="button"
                    aria-label={`Remove point ${i + 1}`}
                    disabled={busy || !isEditing("instructions") || (isBlank(point) && points.length === 1)}
                    onClick={() => {
                      const next = points.filter((_, j) => j !== i);
                      setPoints(next.length ? next : [blankPoint()]);
                    }}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ol>
            {isEditing("instructions") && (
              <FormActions
                saveLabel="Save instructions"
                disabled={busy}
                onCancel={() => cancelEdit("instructions")}
              />
            )}
          </form>
        </section>
      </div>

      <AlertDialog open={!!pendingMode} onOpenChange={(o) => !o && setPendingMode(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switch to {target?.label.toLowerCase()}?</AlertDialogTitle>
            <AlertDialogDescription>
              Registrations already in progress keep the method they started with —
              only new ones use this.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSwitch}>Switch</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmingClose} onOpenChange={(o) => !o && setConfirmingClose(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {registrationOpen ? "Close registration?" : "Reopen registration?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {registrationOpen
                ? "No one will be able to start a new registration, save a draft, or pay for an existing draft until you reopen it. Payments already in progress can still finish."
                : "Participants will be able to register again immediately, for every event that isn't individually closed."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCloseToggle}>
              {registrationOpen ? "Close Registration" : "Reopen Registration"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmingUnlock} onOpenChange={(o) => !o && setConfirmingUnlock(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlock payment details?</AlertDialogTitle>
            <AlertDialogDescription>
              These are where participants send real money. Unlock only if the UPI ID or
              QR is actually wrong, and lock them again straight after.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => setLock(false)}>Unlock</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
