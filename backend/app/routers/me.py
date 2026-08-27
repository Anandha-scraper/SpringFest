from fastapi import APIRouter

from app.deps import CurrentUser
from app.services.firebase import get_db

router = APIRouter(prefix="/me", tags=["me"])


@router.get("")
def profile(user=CurrentUser):
    return user


@router.get("/registrations")
def my_registrations(user=CurrentUser):
    db = get_db()
    docs = db.collection("registrations").where("uid", "==", user["uid"]).stream()
    rows = [{"id": d.id, **d.to_dict()} for d in docs]

    names = {e.id: e.to_dict().get("name", e.id) for e in db.collection("events").stream()}
    for r in rows:
        r["event_name"] = names.get(r.get("event_id"), r.get("event_id"))

    rows.sort(key=lambda r: r.get("created_at", ""), reverse=True)
    return rows
