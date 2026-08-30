import { createHmac, timingSafeEqual } from "node:crypto";

import Razorpay from "razorpay";

import { settings } from "../config/index.js";

/** Lazily construct the Razorpay client.
 *
 * The SDK throws from its constructor when `key_id` is missing, so building
 * it at module load would crash the whole server on boot with no payment
 * credentials configured — taking down the public site and every free event
 * along with paid checkout. Instead it's built on first use: an unconfigured
 * deployment serves everything except a paid registration, which fails with
 * a clear error only when someone actually tries to pay. */
let client = null;
function getClient() {
  if (!settings.PAYMENT_KEY_ID || !settings.PAYMENT_KEY_SECRET) {
    throw new Error("Payments are not configured (PAYMENT_KEY_ID / PAYMENT_KEY_SECRET)");
  }
  if (!client) {
    client = new Razorpay({ key_id: settings.PAYMENT_KEY_ID, key_secret: settings.PAYMENT_KEY_SECRET });
  }
  return client;
}

/** amountInr in rupees -> Razorpay order (paise). */
export async function createOrder(amountInr, receipt) {
  return getClient().orders.create({
    amount: amountInr * 100,
    currency: "INR",
    receipt,
    payment_capture: 1,
  });
}

/** How they paid — "upi", "card", "netbanking", "wallet".
 *
 * The checkout handler only hands back ids, so the method has to be
 * fetched. It's decoration on the admin's detail panel, so a failure here
 * returns "" rather than derailing a payment that has already been
 * verified. */
export async function fetchPaymentMethod(paymentId) {
  try {
    const payment = await getClient().payments.fetch(paymentId);
    return payment.method || "";
  } catch {
    return "";
  }
}

/** The Node SDK has no built-in equivalent of Python's
 * client.utility.verify_payment_signature — Razorpay's checkout signature is
 * just HMAC-SHA256("<order_id>|<payment_id>", key_secret), so it's done
 * directly with node:crypto rather than pulling in another dependency. */
export function verifySignature(orderId, paymentId, signature) {
  const expected = createHmac("sha256", settings.PAYMENT_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  const expectedBuf = Buffer.from(expected, "utf8");
  const signatureBuf = Buffer.from(signature || "", "utf8");
  if (expectedBuf.length !== signatureBuf.length) return false;
  return timingSafeEqual(expectedBuf, signatureBuf);
}
