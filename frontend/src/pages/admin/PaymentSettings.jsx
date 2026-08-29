import { useCallback, useEffect, useState } from "react";
import { CreditCard, Camera } from "lucide-react";
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
import FormActions from "../../components/admin/FormActions.jsx";
import { getAppSettings, updateAppSettings } from "../../api/client.js";
import { useApi } from "../../hooks/useApi.js";

const MODES = [
  {
    value: "gateway",
    label: "Payment gateway",
    icon: CreditCard,
    blurb: "Participants pay by card, UPI or netbanking through Razorpay. Confirmed automatically the moment the payment clears.",
  },
  {
    value: "screenshot",
    label: "Screenshot-based",
    icon: Camera,
    blurb: "Participants pay you directly, then upload a transaction ID and a screenshot. You confirm each one from Approvals.",
  },
];

export default function PaymentSettings() {
  const fetcher = useCallback(() => getAppSettings(), []);
  const { data, error: loadError, loading, reload } = useApi(fetcher);

  const [instructions, setInstructions] = useState("");
  const [pendingMode, setPendingMode] = useState(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  const mode = data?.payment_mode || "gateway";

  // Seed the textarea once the settings land, without clobbering an edit in
  // progress on a background reload.
  useEffect(() => {
    if (data) setInstructions((prev) => prev || data.payment_instructions || "");
  }, [data]);

  const save = async (patch, message) => {
    setError("");
    setSaved("");
    try {
      await updateAppSettings(patch);
      await reload();
      setSaved(message);
    } catch (err) {
      setError(err.message);
    }
  };

  const confirmSwitch = async () => {
    const next = pendingMode;
    setPendingMode(null);
    if (next) await save({ payment_mode: next }, `Switched to ${next === "gateway" ? "gateway" : "screenshot"} payments.`);
  };

  if (loading) return <div className="spinner" />;
  if (loadError) return <p className="error">{loadError}</p>;

  const target = MODES.find((m) => m.value === pendingMode);

  return (
    <div className="admin">
      <div className="admin-head">
        <div>
          <span className="eyebrow">Organiser view</span>
          <h1>Payment</h1>
          <p className="muted">
            How participants pay to register. Switch to screenshots if the gateway goes
            down, and back again when it recovers.
          </p>
        </div>
      </div>

      <section className="admin-panel">
        <div className="panel-head">
          <h2>Current method</h2>
          <span className="muted">
            {data?.updated_at
              ? `Changed ${new Date(data.updated_at).toLocaleString()}${data.updated_by ? ` by ${data.updated_by}` : ""}`
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
                  {active && <span className="pill pill-admin">In use</span>}
                </span>
                <span className="muted">{m.blurb}</span>
              </button>
            );
          })}
        </div>

        {error && <p className="error">{error}</p>}
        {saved && <p className="muted">{saved}</p>}
      </section>

      <section className="admin-panel">
        <div className="panel-head">
          <h2>Payment instructions</h2>
        </div>
        <p className="muted">
          Shown to participants when screenshot mode is on — put your UPI ID or account
          details here so they know where to send the money.
        </p>
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            save({ payment_instructions: instructions }, "Instructions saved.");
          }}
        >
          <textarea
            className="input"
            rows={5}
            placeholder={"e.g. Pay ₹250 to springfest@okhdfcbank\nThen upload the screenshot and the UPI reference number."}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
          />
          <FormActions saveLabel="Save instructions" />
        </form>
      </section>

      <AlertDialog open={!!pendingMode} onOpenChange={(o) => !o && setPendingMode(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switch to {target?.label.toLowerCase()}?</AlertDialogTitle>
            <AlertDialogDescription>
              {target?.blurb}
              {" "}Registrations already in progress keep the method they started with —
              only new ones use this.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSwitch}>Switch</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
