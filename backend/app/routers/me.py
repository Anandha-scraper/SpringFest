from fastapi import APIRouter

from app.deps import CurrentUser
from app.services.firebase import get_db

router = APIRouter(prefix="/me", tags=["me"])


@router.get("")
def profile(user=CurrentUser):
    return user


@router.get("/registrations")
def my_registrations(user=CurrentUser):
    docs = (
        get_db()
        .collection("registrations")
        .where("uid", "==", user["uid"])
        .stream()
    )
    return [{"id": d.id, **d.to_dict()} for d in docs]
