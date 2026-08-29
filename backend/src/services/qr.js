/** QR tickets — one per person, generated the moment a registration is
 * confirmed (gateway payment verified, or admin-approved screenshot).
 *
 * Why one per member rather than one per registration: a team registers as
 * one document, but they arrive at the venue one at a time. Per-member codes
 * let a volunteer check in whoever is standing in front of them.
 *
 * The QR encodes a SIGNED token, not a bare registration id. Registration ids
 * are auto-ids that appear in URLs, on the success page and in the admin CSV;
 * if the QR were just the id, anyone who saw one could hand-craft a ticket
 * for a registration that was never paid for. The HMAC means only this server
 * can mint a scannable code. The signature is the *first* gate — the check-in
 * route still re-reads the registration and refuses anything not `completed`,
 * so a token stays worthless if the registration is later rejected.
 *
 * The PNGs live in Cloud Storage so participants can download and keep them
 * offline; the token is stored alongside on the registration doc so check-in
 * never has to re-derive it.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

import QRCode from "qrcode";

import { settings } from "../config.js";
import { ApiError } from "../errors.js";
import { uploadBuffer } from "./storage.js";

function sign(payload) {
  if (!settings.QR_SECRET) {
    throw new ApiError(503, "QR tickets are not configured (QR_SECRET)");
  }
  return createHmac("sha256", settings.QR_SECRET).update(payload).digest("hex");
}

/** `<base64url(regId.memberIndex)>.<hmac>` — URL-safe so the token survives
 * being put in a query string or scanned into a form field. */
export function signToken(registrationId, memberIndex) {
  const payload = Buffer.from(`${registrationId}.${memberIndex}`, "utf8").toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** Returns { registrationId, memberIndex } for a token this server minted,
 * or null for anything else. Never throws on malformed input — a garbled
 * scan is a failed check-in, not a 500. */
export function verifyToken(token) {
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
  // rsplit on the last dot: Firestore auto-ids are alphanumeric, but slicing
  // from the right is correct regardless of what the id contains.
  const split = decoded.lastIndexOf(".");
  if (split < 1) return null;
  const registrationId = decoded.slice(0, split);
  const memberIndex = Number(decoded.slice(split + 1));
  if (!Number.isInteger(memberIndex) || memberIndex < 0) return null;
  return { registrationId, memberIndex };
}

/** Everyone the registration covers, lead first. Index 0 is always the lead,
 * which is what the token's memberIndex refers to. */
export function ticketHolders(row) {
  const members = Array.isArray(row?.members) ? row.members : [];
  return [
    { name: row?.name || "", email: row?.email || "" },
    ...members.map((m) => ({ name: m?.name || "", email: m?.email || "" })),
  ];
}

/** Generate + store one QR per person on this registration.
 *
 * Idempotent: a re-approval or a retried payment verification returns the
 * existing set rather than churning the bucket and invalidating tickets
 * people have already downloaded. */
export async function generateForRegistration(registrationId, row) {
  if (Array.isArray(row?.qr) && row.qr.length) return row.qr;

  const generatedAt = new Date().toISOString();
  const holders = ticketHolders(row);

  return Promise.all(
    holders.map(async (holder, memberIndex) => {
      const token = signToken(registrationId, memberIndex);
      const png = await QRCode.toBuffer(token, { width: 512, margin: 2, errorCorrectionLevel: "M" });
      const path = `qr/${registrationId}/${memberIndex}.png`;
      await uploadBuffer(path, png, "image/png");
      return { member_index: memberIndex, name: holder.name, path, token, generated_at: generatedAt };
    })
  );
}
