import csv
import io
import re
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from google.cloud.firestore_v1.base_query import FieldFilter

from app.deps import AdminUser
from app.models.schemas import (
    STATUS_COMPLETED,
    Assignments,
    Person,
    PersonCreate,
    Venue,
    VenueCreate,
)
from app.services import aggregate
from app.services import roles as roles_service
from app.services.firebase import get_db

router = APIRouter(prefix="/admin", tags=["admin"])

CSV_COLUMNS = [
    "id", "name", "email", "phone", "college", "event_id", "event_name",
    "status", "checked_in", "fee", "team_name", "team_size",
    "order_id", "payment_id", "payment_method", "created_at", "paid_at",
]


def _all_registrations() -> list[dict]:
    docs = get_db().collection("registrations").stream()
    return [{"id": d.id, **d.to_dict()} for d in docs]


def _apply_filters(rows: list[dict], event_id: str | None, status: str | None) -> list[dict]:
    if event_id:
        rows = [r for r in rows if r.get("event_id") == event_id]
    if status:
        rows = [r for r in rows if r.get("status") == status]
    return rows


# ── Dashboards ───────────────────────────────────────────────
@router.get("/stats")
def stats(user=AdminUser):
    return aggregate.build_stats()


@router.get("/participants")
def participants_list(user=AdminUser):
    """One row per person — the Registrations screen. See services/aggregate.py
    for why this isn't just the registration list."""
    return aggregate.participant_rows()


@router.get("/venues/rollup")
def venues_rollup(user=AdminUser):
    return aggregate.venue_rollup()


@router.get("/registrations")
def registrations(
    event_id: str | None = Query(default=None),
    status: str | None = Query(default=None),
    user=AdminUser,
):
    """The flat, one-row-per-registration list. Kept alongside /participants
    because the CSV export and per-event views work at this grain."""
    data = aggregate.load_all()
    rows = _apply_filters(data["registrations"], event_id, status)
    for r in rows:
        r["event_name"] = aggregate.event_name(data["events"], r.get("event_id", ""))
    rows.sort(key=lambda r: r.get("created_at", ""), reverse=True)
    return rows


@router.get("/events/{event_id}/participants")
def participants(event_id: str, user=AdminUser):
    data = aggregate.load_all()
    event = data["events"].get(event_id)
    if not event:
        raise HTTPException(404, "Event not found")

    rows = [r for r in data["registrations"] if r.get("event_id") == event_id]
    rows.sort(key=lambda r: r.get("created_at", ""), reverse=True)
    for r in rows:
        r["event_name"] = event.get("name", event_id)
    completed = [r for r in rows if r.get("status") == STATUS_COMPLETED]

    return {
        "event": {**event, "venue_name": data["venues"].get(event.get("venue_id", ""), {}).get("name", "")},
        "total": len(rows),
        "completed": len(completed),
        "checked_in": sum(1 for r in rows if r.get("checked_in")),
        "revenue": sum(r.get("fee", 0) for r in completed),
        "participants": rows,
    }


@router.get("/registrations.csv")
def registrations_csv(
    event_id: str | None = Query(default=None),
    status: str | None = Query(default=None),
    user=AdminUser,
):
    data = aggregate.load_all()
    rows = _apply_filters(data["registrations"], event_id, status)
    rows.sort(key=lambda r: r.get("created_at", ""), reverse=True)
    for r in rows:
        r["event_name"] = aggregate.event_name(data["events"], r.get("event_id", ""))

    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=CSV_COLUMNS, extrasaction="ignore")
    writer.writeheader()
    for r in rows:
        writer.writerow({c: r.get(c, "") for c in CSV_COLUMNS})
    buf.seek(0)

    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="registrations.csv"'},
    )


# ── Venues ───────────────────────────────────────────────────
def _slugify(value: str) -> str:
    return re.sub(r"^-|-$", "", re.sub(r"[^a-z0-9]+", "-", value.strip().lower()))


@router.get("/venues", response_model=list[Venue])
def list_venues(user=AdminUser):
    docs = get_db().collection("venues").stream()
    rows = [Venue(id=d.id, **d.to_dict()) for d in docs]
    rows.sort(key=lambda v: v.name)
    return rows


@router.post("/venues", response_model=Venue, status_code=status.HTTP_201_CREATED)
def add_venue(payload: VenueCreate, user=AdminUser):
    venue_id = _slugify(payload.name)
    if not venue_id:
        raise HTTPException(400, "Venue name must contain letters or numbers")

    ref = get_db().collection("venues").document(venue_id)
    if ref.get().exists:
        raise HTTPException(409, "A venue with that name already exists")

    data = {"name": payload.name.strip(), "created_at": datetime.now(timezone.utc).isoformat()}
    ref.set(data)
    return Venue(id=venue_id, **data)


@router.delete("/venues/{venue_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_venue(venue_id: str, user=AdminUser):
    db = get_db()
    ref = db.collection("venues").document(venue_id)
    if not ref.get().exists:
        raise HTTPException(404, "Venue not found")

    # An event pointing at a deleted venue would render as "Unassigned" with no
    # trace of what happened, so the event has to be moved first.
    query = db.collection("events").where(filter=FieldFilter("venue_id", "==", venue_id)).limit(1)
    holder = next(iter(query.stream()), None)
    if holder:
        name = holder.to_dict().get("name", holder.id)
        raise HTTPException(409, f'"{name}" is held at this venue — reassign it first')

    ref.delete()
    return None


# ── People / role management ─────────────────────────────────
@router.get("/people", response_model=list[Person])
def people(role: str | None = Query(default=None), user=AdminUser):
    return roles_service.list_people(role)


@router.post("/people", response_model=Person, status_code=status.HTTP_201_CREATED)
def add_person(payload: PersonCreate, user=AdminUser):
    email = roles_service.normalize_email(payload.email)

    # Changing your own role is the realistic way to lock the last admin out.
    if email == roles_service.normalize_email(user["email"]):
        raise HTTPException(400, "You cannot change your own role")
    # Seeded admins come from ADMIN_EMAILS; a document would be ignored anyway.
    if roles_service.is_seeded_admin(email):
        raise HTTPException(403, "This account is managed in ADMIN_EMAILS")

    row = roles_service.upsert_person(
        email=email,
        role=payload.role,
        name=payload.name,
        added_by=user["email"],
    )
    return Person(**row)


@router.put("/people/{email}/assignments", response_model=Person)
def set_assignments(email: str, payload: Assignments, user=AdminUser):
    """Judges get events, volunteers get a venue."""
    key = roles_service.normalize_email(email)
    db = get_db()

    doc = db.collection(roles_service.COLLECTION).document(key).get()
    if not doc.exists:
        raise HTTPException(404, "No role record for that address")
    role = (doc.to_dict() or {}).get("role")

    event_ids = payload.event_ids
    if event_ids is not None:
        if role != roles_service.ROLE_JUDGE:
            raise HTTPException(400, "Only judges are assigned to events")
        events = {d.id: {"id": d.id, **d.to_dict()} for d in db.collection("events").stream()}
        missing = [e for e in event_ids if e not in events]
        if missing:
            raise HTTPException(404, f"Unknown event(s): {', '.join(missing)}")
        # A judge can hold several events but can't be in two rooms at once.
        clash = roles_service.find_conflict(event_ids, events)
        if clash:
            first, second = clash
            raise HTTPException(
                409,
                f'"{first["name"]}" and "{second["name"]}" overlap in time — '
                "a judge can't cover both.",
            )

    if payload.venue_id is not None:
        if role != roles_service.ROLE_VOLUNTEER:
            raise HTTPException(400, "Only volunteers are allocated to a venue")
        if payload.venue_id and not db.collection("venues").document(payload.venue_id).get().exists:
            raise HTTPException(404, "Venue not found")

    row = roles_service.set_assignments(key, event_ids=event_ids, venue_id=payload.venue_id)
    return Person(**row)


@router.delete("/people/{email}", status_code=status.HTTP_204_NO_CONTENT)
def delete_person(email: str, user=AdminUser):
    key = roles_service.normalize_email(email)

    if key == roles_service.normalize_email(user["email"]):
        raise HTTPException(400, "You cannot remove yourself")
    if roles_service.is_seeded_admin(key):
        raise HTTPException(403, "This account is managed in ADMIN_EMAILS")

    if not roles_service.remove_person(key):
        raise HTTPException(404, "No role record for that address")
    return None
