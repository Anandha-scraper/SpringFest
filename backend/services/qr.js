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
 * details the lead typed in.
 *
 * Lead and member carry the *same* seven personal fields (`parseTeamMember`
 * spreads `parseParticipantDetails`, and the lead's copy lives on the
 * registration root), so this returns one uniform shape for both. That is
 * what lets the admin rollups pivot a registration into people without
 * caring which seat someone occupies.
 *
 * `uid`/`user_email` are the lead's alone and empty for members — a teammate
 * has no account on this document. Note the lead's `email` is the address
 * they *typed*, which can differ from the Google `user_email` they signed in
 * with; both are carried so identity resolution can index either. */
export function ticketHolders(row) {
  const members = Array.isArray(row?.members) ? row.members : [];
  const details = (p) => ({
    name: p?.name || "",
    email: p?.email || "",
    phone: p?.phone || "",
    college: p?.college || "",
    department: p?.department || "",
    year: p?.year || "",
    location: p?.location || "",
  });
  return [
    { member_index: 0, uid: row?.uid || "", user_email: row?.user_email || "", ...details(row) },
    ...members.map((m, i) => ({ member_index: i + 1, uid: "", user_email: "", ...details(m) })),
  ];
}
