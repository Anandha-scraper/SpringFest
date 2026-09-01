"use client";

import { verifyPayment } from "@/api/client.js";

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

// The checkout script used to be a blocking <script> tag in index.html, on
// every page load. It's only ever needed here, so it's fetched on demand
// instead — cached after the first call, and safe to call more than once in
// a session (won't inject the tag twice).
let checkoutReady = null;
function loadCheckoutScript() {
  if (window.Razorpay) return Promise.resolve();
  if (checkoutReady) return checkoutReady;

  checkoutReady = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${CHECKOUT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", reject);
      return;
    }
    const script = document.createElement("script");
    script.src = CHECKOUT_SRC;
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return checkoutReady;
}

// Opens Razorpay checkout for an order created by the backend.
export async function openCheckout({ order, user, event, onSuccess, onError }) {
  try {
    await loadCheckoutScript();
  } catch {
    onError(new Error("Could not load the payment provider. Check your connection and try again."));
    return;
  }

  const options = {
    key: order.key_id,
    amount: order.amount,
    currency: order.currency,
    name: "Symposium 2026",
    description: event.name,
    order_id: order.order_id,
    prefill: { name: user.name, email: user.email, contact: user.phone },
    theme: { color: "#4f46e5" },
    handler: async (response) => {
      try {
        const result = await verifyPayment({
          registration_id: order.registration_id,
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
        });
        onSuccess(result);
      } catch (e) {
        onError(e);
      }
    },
  };
  const rzp = new window.Razorpay(options);
  rzp.on("payment.failed", (r) => onError(new Error(r.error.description)));
  rzp.open();
}
