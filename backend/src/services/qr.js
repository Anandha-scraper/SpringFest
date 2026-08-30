/** Rendering half of the personal check-in badge — the token format it wraps
 * lives in `auth/qrToken.js`. */
import QRCode from "qrcode";

import { signPersonToken } from "../auth/qrToken.js";

/** A ready-to-scan PNG for this uid's personal badge. Generated on the fly —
 * no Cloud Storage round-trip, since regenerating is cheap and the whole
 * point is that it never needs to be cached or reissued. */
export async function personalQrPng(uid) {
  const token = signPersonToken(uid);
  return QRCode.toBuffer(token, { width: 512, margin: 2, errorCorrectionLevel: "M" });
}

/** Everyone a registration covers, lead first. Index 0 is always the lead —
 * team members (indices 1+) have no uid of their own on the doc, only the
 * name/email/phone the lead typed in. */
export function ticketHolders(row) {
  const members = Array.isArray(row?.members) ? row.members : [];
  return [
    { name: row?.name || "", email: row?.email || "" },
    ...members.map((m) => ({ name: m?.name || "", email: m?.email || "" })),
  ];
}
