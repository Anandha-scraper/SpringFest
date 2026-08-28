import razorpay

from app.config import settings

client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))


def create_order(amount_inr: int, receipt: str) -> dict:
    """amount_inr in rupees -> Razorpay order (paise)."""
    return client.order.create(
        {
            "amount": amount_inr * 100,
            "currency": "INR",
            "receipt": receipt,
            "payment_capture": 1,
        }
    )


def fetch_payment_method(payment_id: str) -> str:
    """How they paid — "upi", "card", "netbanking", "wallet".

    The checkout handler only hands back ids, so the method has to be fetched.
    It's decoration on the admin's detail panel, so a failure here returns ""
    rather than derailing a payment that has already been verified.
    """
    try:
        return client.payment.fetch(payment_id).get("method", "")
    except Exception:
        return ""


def verify_signature(order_id: str, payment_id: str, signature: str) -> bool:
    try:
        client.utility.verify_payment_signature(
            {
                "razorpay_order_id": order_id,
                "razorpay_payment_id": payment_id,
                "razorpay_signature": signature,
            }
        )
        return True
    except razorpay.errors.SignatureVerificationError:
        return False
