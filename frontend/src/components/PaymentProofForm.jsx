import { useEffect, useState } from "react";
import { Upload } from "lucide-react";

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ["image/png", "image/jpeg", "image/webp"];

/**
 * Step two of a screenshot-mode registration: the participant has paid us
 * directly, and now proves it. The registration already exists (created
 * `pending` by step one), so this only ever attaches evidence to it — which
 * is why an abandoned upload is recoverable rather than lost.
 *
 * Also used to resubmit after an admin rejects: same endpoint, same form.
 */
export default function PaymentProofForm({
  amount,
  instructions,
  rejectionNote,
  onSubmit,
  submitting,
}) {
  const [transactionId, setTransactionId] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");

  // Object URLs leak until revoked — tie the lifetime to the chosen file.
  useEffect(() => {
    if (!file) return setPreview("");
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pick = (e) => {
    const chosen = e.target.files?.[0];
    setError("");
    if (!chosen) return setFile(null);
    // Checked here as well as server-side so a 5 MB upload isn't wasted only
    // to bounce.
    if (!ACCEPTED.includes(chosen.type)) {
      setFile(null);
      return setError("Please choose a PNG, JPEG or WebP image.");
    }
    if (chosen.size > MAX_BYTES) {
      setFile(null);
      return setError("That image is over 5 MB — try a smaller screenshot.");
    }
    setFile(chosen);
  };

  const submit = (e) => {
    e.preventDefault();
    if (!file) return setError("Attach a screenshot of your payment.");
    onSubmit({ transactionId: transactionId.trim(), file });
  };

  return (
    <form className="form" onSubmit={submit}>
      {rejectionNote && (
        <div className="notice notice-warn">
          <strong>Your last submission was rejected</strong>
          <p>{rejectionNote}</p>
        </div>
      )}

      <div className="notice">
        <strong>Pay ₹{amount}, then upload the proof</strong>
        {instructions ? (
          <p style={{ whiteSpace: "pre-wrap" }}>{instructions}</p>
        ) : (
          <p>
            Use the payment details the organisers gave you, then enter the reference
            number and attach a screenshot below.
          </p>
        )}
      </div>

      <label htmlFor="pp-txn">Transaction / reference ID</label>
      <input
        id="pp-txn"
        placeholder="e.g. 431290871234"
        required
        minLength={4}
        value={transactionId}
        onChange={(e) => setTransactionId(e.target.value)}
      />

      <label htmlFor="pp-file">Payment screenshot</label>
      <input
        id="pp-file"
        type="file"
        accept={ACCEPTED.join(",")}
        required
        onChange={pick}
      />
      <p className="muted" style={{ fontSize: "0.85rem", margin: "4px 0 0" }}>
        PNG, JPEG or WebP, up to 5 MB.
      </p>

      {preview && (
        <img
          src={preview}
          alt="Your payment screenshot"
          style={{ maxHeight: 240, borderRadius: 8, marginTop: 8 }}
        />
      )}

      {error && <p className="error">{error}</p>}

      <button className="btn" type="submit" disabled={submitting}>
        <Upload size={15} aria-hidden="true" />
        {submitting ? " Uploading…" : " Submit for approval"}
      </button>
    </form>
  );
}
