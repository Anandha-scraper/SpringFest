/** Where to send the money, in screenshot mode.
 *
 * Replaces the free-text "payment instructions" paragraph that used to sit
 * here. Nobody reads prose at a payment step — they scan a QR, or copy a UPI
 * handle. Both come from the single `settings/app` doc an admin fills in on
 * the Payment page.
 *
 * The QR is authenticated (GET /api/me/payment-qr), so it's fetched as a blob
 * rather than set as a plain <img src>; the object URL is revoked when this
 * unmounts. Same pattern as Approvals' proof thumbnail.
 */
import { useEffect, useState } from "react";
import { Check, Copy, QrCode } from "lucide-react";

import { paymentQrObjectUrl } from "../api/client.js";

export default function PaymentTarget({ amount, upiId, hasQr }) {
  const [qrUrl, setQrUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!hasQr) return undefined;
    let url = "";
    let live = true;
    paymentQrObjectUrl()
      .then((u) => {
        // The fetch can land after an unmount — revoke immediately rather
        // than leaking the object URL for the life of the page.
        if (!live) return URL.revokeObjectURL(u);
        url = u;
        setQrUrl(u);
      })
      // A missing QR isn't worth an error here: the UPI id below still works,
      // and the organisers may simply not have uploaded one.
      .catch(() => {});
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [hasQr]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(upiId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard is blocked on insecure origins and in some mobile browsers;
      // the handle is on screen either way, so this is not worth surfacing.
    }
  };

  if (!upiId && !hasQr) {
    return (
      <div className="notice">
        <strong>Pay ₹{amount}, then upload the proof</strong>
        <p>
          Use the payment details the organisers gave you, then enter the reference
          number and attach a screenshot below.
        </p>
      </div>
    );
  }

  return (
    <div className="pay-target">
      <div className="pay-target-head">
        <strong>Pay ₹{amount}</strong>
        <span className="muted">then enter the reference and attach a screenshot below</span>
      </div>

      <div className="pay-target-body">
        {qrUrl && (
          <figure className="pay-target-qr">
            <img src={qrUrl} alt="Scan to pay" />
            <figcaption className="muted">
              <QrCode size={13} aria-hidden="true" /> Scan with any UPI app
            </figcaption>
          </figure>
        )}

        {upiId && (
          <div className="pay-target-upi">
            <span className="pay-target-label">UPI ID</span>
            <code className="pay-target-id">{upiId}</code>
            <button type="button" className="btn btn-ghost btn-sm" onClick={copy}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? " Copied" : " Copy"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
