from fastapi import APIRouter, HTTPException

from app.models.schemas import Event
from app.services.firebase import get_db

router = APIRouter(prefix="/events", tags=["events"])


@router.get("", response_model=list[Event])
def list_events():
    docs = get_db().collection("events").stream()
    return [Event(id=d.id, **d.to_dict()) for d in docs]


@router.get("/{event_id}", response_model=Event)
def get_event(event_id: str):
    doc = get_db().collection("events").document(event_id).get()
    if not doc.exists:
        raise HTTPException(404, "Event not found")
    return Event(id=doc.id, **doc.to_dict())
