import { verifyPayment } from "./client.js";

// Opens Razorpay checkout for an order created by the backend.
export function openCheckout({ order, user, event, onSuccess, onError }) {
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
