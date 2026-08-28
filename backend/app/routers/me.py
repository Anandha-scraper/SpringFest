from fastapi import APIRouter
from google.cloud.firestore_v1.base_query import FieldFilter

from app.deps import CurrentUser
from app.services.firebase import get_db

router = APIRouter(prefix="/me", tags=["me"])


@router.get("")
def profile(user=CurrentUser):
    """The caller's identity, role, and whatever they've been assigned.

    A judge's own dashboard needs their event_ids and a volunteer's needs their
    venue_id, and neither should have to hit an admin-only endpoint to get it.
    Both already come off `user` — deps.get_current_user's role lookup reads
    the same roles doc, so there's no second Firestore read here.
    """
    return user


@router.get("/registrations")
def my_registrations(user=CurrentUser):
    db = get_db()
    docs = (
        db.collection("registrations")
        .where(filter=FieldFilter("uid", "==", user["uid"]))
        .stream()
    )
    rows = [{"id": d.id, **d.to_dict()} for d in docs]

    names = {e.id: e.to_dict().get("name", e.id) for e in db.collection("events").stream()}
    for r in rows:
        r["event_name"] = names.get(r.get("event_id"), r.get("event_id"))

    rows.sort(key=lambda r: r.get("created_at", ""), reverse=True)
    return rows
