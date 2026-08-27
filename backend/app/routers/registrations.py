from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from app.config import settings
from app.deps import CurrentUser
from app.models.schemas import OrderResponse, PaymentVerify, RegistrationCreate
from app.services.firebase import get_db
from app.services.payment import create_order, verify_signature

router = APIRouter(prefix="/registrations", tags=["registrations"])


@router.post("", response_model=OrderResponse)
def register(payload: RegistrationCreate, user=CurrentUser):
    db = get_db()
    event = db.collection("events").document(payload.event_id).get()
    if not event.exists:
        raise HTTPException(404, "Event not found")
    fee = event.to_dict().get("fee", 0)

    reg_ref = db.collection("registrations").document()
    reg_ref.set(
        {
            **payload.model_dump(),
            "uid": user["uid"],
            "user_email": user["email"],
            "fee": fee,
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )

    if fee <= 0:
        reg_ref.update({"status": "confirmed"})
        return OrderResponse(
            registration_id=reg_ref.id, order_id="", amount=0,
            currency="INR", key_id=settings.RAZORPAY_KEY_ID,
        )

    order = create_order(fee, receipt=reg_ref.id)
    reg_ref.update({"order_id": order["id"]})
    return OrderResponse(
        registration_id=reg_ref.id,
        order_id=order["id"],
        amount=order["amount"],
        currency=order["currency"],
        key_id=settings.RAZORPAY_KEY_ID,
    )


@router.post("/verify")
def verify(payload: PaymentVerify, user=CurrentUser):
    db = get_db()
    reg_ref = db.collection("registrations").document(payload.registration_id)
    reg = reg_ref.get()
    if not reg.exists:
        raise HTTPException(404, "Registration not found")
    if reg.to_dict().get("uid") != user["uid"]:
        raise HTTPException(403, "Not your registration")

    ok = verify_signature(
        payload.razorpay_order_id,
        payload.razorpay_payment_id,
        payload.razorpay_signature,
    )
    if not ok:
        reg_ref.update({"status": "failed"})
        raise HTTPException(400, "Payment verification failed")

    reg_ref.update(
        {
            "status": "confirmed",
            "payment_id": payload.razorpay_payment_id,
            "paid_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    return {"status": "confirmed", "registration_id": payload.registration_id}
