"""Check-in: marking that someone actually turned up.

Volunteers do this on the day, at the venue. It's separate from payment —
a registration can be completed (paid) but never checked in (didn't show).
Admins satisfy the volunteer guard too, which is what lets the whole flow be
tested from the admin account before the volunteer screens exist.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from app.deps import VolunteerUser
from app.models.schemas import CheckIn
from app.services.firebase import get_db

router = APIRouter(prefix="/volunteer", tags=["volunteer"])


@router.post("/check-in")
def check_in(payload: CheckIn, user=VolunteerUser):
    ref = get_db().collection("registrations").document(payload.registration_id)
    doc = ref.get()
    if not doc.exists:
        raise HTTPException(404, "Registration not found")

    update = {"checked_in": payload.checked_in}
    if payload.checked_in:
        update |= {
            "checked_in_at": datetime.now(timezone.utc).isoformat(),
            "checked_in_by": user["email"],
        }
    else:
        # Undoing a mistaken check-in clears the trail rather than leaving a
        # timestamp that contradicts the flag.
        update |= {"checked_in_at": "", "checked_in_by": ""}

    ref.set(update, merge=True)
    return {"registration_id": payload.registration_id, **update}
