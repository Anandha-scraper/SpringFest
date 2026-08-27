import csv
import io

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import StreamingResponse

from app.deps import AdminUser
from app.models.schemas import Person, PersonCreate
from app.services.firebase import get_db
from app.services import roles as roles_service

router = APIRouter(prefix="/admin", tags=["admin"])

CSV_COLUMNS = [
    "id", "name", "email", "phone", "college", "event_id",
    "status", "fee", "order_id", "payment_id", "created_at", "paid_at",
]


def _all_registrations() -> list[dict]:
    docs = get_db().collection("registrations").stream()
    return [{"id": d.id, **d.to_dict()} for d in docs]


def _event_names() -> dict[str, str]:
    return {d.id: d.to_dict().get("name", d.id) for d in get_db().collection("events").stream()}


def _apply_filters(rows: list[dict], event_id: str | None, status: str | None) -> list[dict]:
    if event_id:
        rows = [r for r in rows if r.get("event_id") == event_id]
    if status:
        rows = [r for r in rows if r.get("status") == status]
    return rows


@router.get("/stats")
def stats(user=AdminUser):
    rows = _all_registrations()
    names = _event_names()

    per_event: dict[str, dict] = {}
    for r in rows:
        eid = r.get("event_id", "unknown")
        bucket = per_event.setdefault(
            eid,
            {"event_id": eid, "name": names.get(eid, eid), "count": 0, "confirmed": 0, "revenue": 0},
        )
        bucket["count"] += 1
        if r.get("status") == "confirmed":
            bucket["confirmed"] += 1
            bucket["revenue"] += r.get("fee", 0)

    confirmed = [r for r in rows if r.get("status") == "confirmed"]
    return {
        "total": len(rows),
        "confirmed": len(confirmed),
        "pending": sum(1 for r in rows if r.get("status") == "pending"),
        "failed": sum(1 for r in rows if r.get("status") == "failed"),
        "revenue": sum(r.get("fee", 0) for r in confirmed),
        "events_count": len(names),
        "per_event": sorted(per_event.values(), key=lambda e: e["count"], reverse=True),
    }


@router.get("/registrations")
def registrations(
    event_id: str | None = Query(default=None),
    status: str | None = Query(default=None),
    user=AdminUser,
):
    rows = _apply_filters(_all_registrations(), event_id, status)
    names = _event_names()
    for r in rows:
        r["event_name"] = names.get(r.get("event_id"), r.get("event_id"))
    rows.sort(key=lambda r: r.get("created_at", ""), reverse=True)
    return rows


@router.get("/events/{event_id}/participants")
def participants(event_id: str, user=AdminUser):
    event = get_db().collection("events").document(event_id).get()
    if not event.exists:
        raise HTTPException(404, "Event not found")

    rows = [r for r in _all_registrations() if r.get("event_id") == event_id]
    rows.sort(key=lambda r: r.get("created_at", ""), reverse=True)
    confirmed = [r for r in rows if r.get("status") == "confirmed"]

    return {
        "event": {"id": event.id, **event.to_dict()},
        "total": len(rows),
        "confirmed": len(confirmed),
        "revenue": sum(r.get("fee", 0) for r in confirmed),
        "participants": rows,
    }


@router.get("/registrations.csv")
def registrations_csv(
    event_id: str | None = Query(default=None),
    status: str | None = Query(default=None),
    user=AdminUser,
):
    rows = _apply_filters(_all_registrations(), event_id, status)
    rows.sort(key=lambda r: r.get("created_at", ""), reverse=True)

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
