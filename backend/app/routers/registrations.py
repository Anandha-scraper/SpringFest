from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from google.cloud.firestore_v1.base_query import FieldFilter

from app.config import settings
from app.deps import CurrentUser
from app.models.schemas import (
    STATUS_COMPLETED,
    STATUS_FAILED,
    STATUS_PENDING,
    OrderResponse,
    PaymentVerify,
    RegistrationCreate,
)
from app.services import aggregate
from app.services.firebase import get_db
from app.services.payment import create_order, fetch_payment_method, verify_signature

router = APIRouter(prefix="/registrations", tags=["registrations"])


def _existing_registration(db, uid: str, event_id: str):
    """This user's live registration for this event, if there is one.

    Guards the admin's per-person view — without it the same account could
    appear under one event several times — and doubles as the resume path for
    an abandoned checkout, which used to create a second document every time.
    """
    query = (
        db.collection("registrations")
        .where(filter=FieldFilter("uid", "==", uid))
        .where(filter=FieldFilter("event_id", "==", event_id))
    )
    for doc in query.stream():
        if doc.to_dict().get("status") in (STATUS_PENDING, STATUS_COMPLETED):
            return doc
    return None


@router.post("", response_model=OrderResponse)
def register(payload: RegistrationCreate, user=CurrentUser):
    db = get_db()
    event = db.collection("events").document(payload.event_id).get()
    if not event.exists:
        raise HTTPException(404, "Event not found")
    event_data = event.to_dict()
    fee = event_data.get("fee", 0)

    # Team rules come from the event, never the client.
    members = payload.members
    if event_data.get("is_team_event"):
        size = 1 + len(members)
        team_min = event_data.get("team_min", 1)
        team_max = event_data.get("team_max", 1)
        if not payload.team_name.strip():
            raise HTTPException(400, "This is a team event — give your team a name")
        if size < team_min or size > team_max:
            raise HTTPException(
                400, f"Teams for this event must have {team_min}–{team_max} members (you have {size})"
            )
    elif members or payload.team_name:
        raise HTTPException(400, "This event is for individuals, not teams")

    existing = _existing_registration(db, user["uid"], payload.event_id)
    if existing:
        row = existing.to_dict()
        if row.get("status") == STATUS_COMPLETED:
            raise HTTPException(409, "You have already registered for this event")
        # Pending: hand back the same document (and order) rather than making
        # a duplicate — the user is finishing a checkout they abandoned.
        reg_ref = existing.reference
        order_id = row.get("order_id", "")
        if fee > 0 and order_id:
            return OrderResponse(
                registration_id=reg_ref.id,
                order_id=order_id,
                amount=fee * 100,
                currency="INR",
                key_id=settings.RAZORPAY_KEY_ID,
            )
    else:
        reg_ref = db.collection("registrations").document()

    reg_ref.set(
        {
            **payload.model_dump(),
            "members": [m.model_dump() for m in members],
            "team_size": 1 + len(members),
            "uid": user["uid"],
            "user_email": user["email"],
            "fee": fee,
            "status": STATUS_PENDING,
            "checked_in": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    aggregate.invalidate_load_all()

    if fee <= 0:
        reg_ref.update({"status": STATUS_COMPLETED})
        return OrderResponse(
            registration_id=reg_ref.id,
            order_id="",
            amount=0,
            currency="INR",
            key_id=settings.RAZORPAY_KEY_ID,
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
    row = reg.to_dict()
    if row.get("uid") != user["uid"]:
        raise HTTPException(403, "Not your registration")
    # The order the client reports must be the one we created for this row.
    if row.get("order_id") and row["order_id"] != payload.razorpay_order_id:
        raise HTTPException(400, "Order does not match this registration")

    ok = verify_signature(
        payload.razorpay_order_id,
        payload.razorpay_payment_id,
        payload.razorpay_signature,
    )
    if not ok:
        reg_ref.update({"status": STATUS_FAILED})
        aggregate.invalidate_load_all()
        raise HTTPException(400, "Payment verification failed")

    reg_ref.update(
        {
            "status": STATUS_COMPLETED,
            "payment_id": payload.razorpay_payment_id,
            "payment_method": fetch_payment_method(payload.razorpay_payment_id),
            "paid_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    aggregate.invalidate_load_all()
    return {"status": STATUS_COMPLETED, "registration_id": payload.registration_id}
