import { createHmac, timingSafeEqual } from "node:crypto";

import Razorpay from "razorpay";

import { settings } from "../config.js";

const client = new Razorpay({ key_id: settings.PAYMENT_KEY_ID, key_secret: settings.PAYMENT_KEY_SECRET });

/** amountInr in rupees -> Razorpay order (paise). */
export async function createOrder(amountInr, receipt) {
  return client.orders.create({
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
    const payment = await client.payments.fetch(paymentId);
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
