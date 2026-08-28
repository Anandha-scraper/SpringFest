import re
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status
from google.cloud.firestore_v1.base_query import FieldFilter

from app.deps import AdminUser
from app.models.schemas import LOCKED_FIELDS, Event, EventCreate, EventUpdate
from app.services import aggregate, cache
from app.services.firebase import get_db

router = APIRouter(prefix="/events", tags=["events"])

# venues rarely change, but this scan runs on every public GET /events hit
# (the most-visited endpoint in the app), so it's worth a longer TTL than
# aggregate.load_all()'s.
_VENUE_NAMES_KEY = "events:venue_names"
_VENUE_NAMES_TTL_SECONDS = 60


def slugify(value: str) -> str:
    return re.sub(r"^-|-$", "", re.sub(r"[^a-z0-9]+", "-", value.strip().lower()))


def _scan_venue_names() -> dict[str, str]:
    return {d.id: d.to_dict().get("name", d.id) for d in get_db().collection("venues").stream()}


def _venue_names() -> dict[str, str]:
    return cache.cached(_VENUE_NAMES_KEY, _VENUE_NAMES_TTL_SECONDS, _scan_venue_names)


def invalidate_venue_names() -> None:
    """Call after any venue create/rename/delete."""
    cache.invalidate(_VENUE_NAMES_KEY)


def _has_registrations(event_id: str) -> bool:
    """One doc is enough to know an event is live — no need to count them all."""
    hits = (
        get_db()
        .collection("registrations")
        .where(filter=FieldFilter("event_id", "==", event_id))
        .limit(1)
        .stream()
    )
    return any(True for _ in hits)


def _venue_taken_by(venue_id: str, exclude_event_id: str = "") -> str:
    """The event already using this venue, if any. A venue backs at most one
    event, so double-booking a room is rejected at the source."""
    if not venue_id:
        return ""
    query = get_db().collection("events").where(filter=FieldFilter("venue_id", "==", venue_id))
    for d in query.stream():
        if d.id != exclude_event_id:
            return d.to_dict().get("name", d.id)
    return ""


def _to_event(doc_id: str, data: dict, venues: dict[str, str], locked: bool = False) -> Event:
    return Event(
        id=doc_id,
        venue_name=venues.get(data.get("venue_id", ""), ""),
        locked=locked,
        **{k: v for k, v in data.items() if k in Event.model_fields and k != "id"},
    )


# ── Public reads ─────────────────────────────────────────────
@router.get("", response_model=list[Event])
def list_events():
    venues = _venue_names()
    docs = get_db().collection("events").stream()
    return [_to_event(d.id, d.to_dict(), venues) for d in docs]


@router.get("/{event_id}", response_model=Event)
def get_event(event_id: str):
    doc = get_db().collection("events").document(event_id).get()
    if not doc.exists:
        raise HTTPException(404, "Event not found")
    # `locked` only matters when editing, so it's resolved on the single-event
    # read (where the admin form gets its values) and not on the list.
    return _to_event(doc.id, doc.to_dict(), _venue_names(), _has_registrations(event_id))


# ── Admin writes ─────────────────────────────────────────────
@router.post("", response_model=Event, status_code=status.HTTP_201_CREATED)
def create_event(payload: EventCreate, user=AdminUser):
    event_id = slugify(payload.name)
    if not event_id:
        raise HTTPException(400, "Event name must contain letters or numbers")

    db = get_db()
    if db.collection("events").document(event_id).get().exists:
        raise HTTPException(409, "An event with that name already exists")

    taken_by = _venue_taken_by(payload.venue_id)
    if taken_by:
        raise HTTPException(409, f'That venue is already used by "{taken_by}"')

    if payload.start_time and payload.end_time and payload.start_time >= payload.end_time:
        raise HTTPException(400, "End time must be after the start time")
    if payload.is_team_event and payload.team_max < payload.team_min:
        raise HTTPException(400, "team_max must be at least team_min")

    now = datetime.now(timezone.utc).isoformat()
    data = {**payload.model_dump(), "created_at": now, "updated_at": now}
    db.collection("events").document(event_id).set(data)
    aggregate.invalidate_load_all()
    return _to_event(event_id, data, _venue_names())


@router.patch("/{event_id}", response_model=Event)
def update_event(event_id: str, payload: EventUpdate, user=AdminUser):
    db = get_db()
    ref = db.collection("events").document(event_id)
    doc = ref.get()
    if not doc.exists:
        raise HTTPException(404, "Event not found")

    current = doc.to_dict()
    changes = payload.model_dump(exclude_unset=True)

    locked = _has_registrations(event_id)
    if locked:
        # People have already paid against this event's terms, so the terms
        # stop being editable. Venue, time and description still move.
        frozen = sorted(
            f for f in changes if f in LOCKED_FIELDS and changes[f] != current.get(f)
        )
        if frozen:
            raise HTTPException(
                403,
                f"This event already has registrations — {', '.join(frozen)} can no longer "
                "be changed. Venue, time and description are still editable.",
            )

    if "venue_id" in changes:
        taken_by = _venue_taken_by(changes["venue_id"], exclude_event_id=event_id)
        if taken_by:
            raise HTTPException(409, f'That venue is already used by "{taken_by}"')

    start = changes.get("start_time", current.get("start_time", ""))
    end = changes.get("end_time", current.get("end_time", ""))
    if start and end and start >= end:
        raise HTTPException(400, "End time must be after the start time")

    changes["updated_at"] = datetime.now(timezone.utc).isoformat()
    ref.set(changes, merge=True)
    aggregate.invalidate_load_all()
    return _to_event(event_id, {**current, **changes}, _venue_names(), locked)


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(event_id: str, user=AdminUser):
    db = get_db()
    ref = db.collection("events").document(event_id)
    if not ref.get().exists:
        raise HTTPException(404, "Event not found")
    if _has_registrations(event_id):
        raise HTTPException(
            409, "This event has registrations and can't be deleted. Ask an organiser first."
        )
    ref.delete()
    aggregate.invalidate_load_all()
    return None
