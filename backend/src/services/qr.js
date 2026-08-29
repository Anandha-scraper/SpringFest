/** One QR per *person*, not per registration.
 *
 * The QR encodes a signed token that names the holder's Firebase uid — that's
 * it. It never lists what they're registered for, so it never needs
 * regenerating when they sign up for something new: the same code they
 * downloaded on day one still works after a dozen more registrations. When a
 * volunteer scans it, the server resolves who they are and looks up their
 * registrations fresh (`services/registrationLookup.js`), so the badge is
 * always current without ever being reissued.
 *
 * The token is signed (HMAC) so it can't be hand-crafted — anyone could type
 * a Firebase uid into a QR generator otherwise. The signature only proves
 * "this server minted a badge for this uid"; the check-in route still
 * re-reads each registration and refuses anything not `completed`, so a
 * badge is only ever as good as what's actually on file.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

import QRCode from "qrcode";

import { settings } from "../config.js";
import { ApiError } from "../errors.js";

function sign(payload) {
  if (!settings.QR_SECRET) {
    throw new ApiError(503, "QR tickets are not configured (QR_SECRET)");
  }
  return createHmac("sha256", settings.QR_SECRET).update(payload).digest("hex");
}

// Version-prefixed payload so a future format change is unambiguous.
const PERSON_TOKEN_PREFIX = "PID1.";

/** `<base64url("PID1.<uid>")>.<hmac>` */
export function signPersonToken(uid) {
  const payload = Buffer.from(`${PERSON_TOKEN_PREFIX}${uid}`, "utf8").toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** Returns `{ uid }` for a token this server minted, or null for anything
 * else. Never throws — a garbled scan is a failed lookup, not a 500. */
export function verifyPersonToken(token) {
  if (typeof token !== "string") return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  let expected;
  try {
    expected = sign(payload);
  } catch {
    // QR_SECRET missing — nothing can be valid.
    return null;
  }
  const expectedBuf = Buffer.from(expected, "utf8");
  const signatureBuf = Buffer.from(signature, "utf8");
  if (expectedBuf.length !== signatureBuf.length) return null;
  if (!timingSafeEqual(expectedBuf, signatureBuf)) return null;

  const decoded = Buffer.from(payload, "base64url").toString("utf8");
  if (!decoded.startsWith(PERSON_TOKEN_PREFIX)) return null;
  const uid = decoded.slice(PERSON_TOKEN_PREFIX.length);
  if (!uid) return null;
  return { uid };
}

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
