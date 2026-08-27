import csv
import io

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from app.deps import AdminUser
from app.services.firebase import get_db

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
