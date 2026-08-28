"""Read-side rollups for the admin screens.

Every admin aggregate is built here so the shapes can't drift between
endpoints. The collections are small (one fest, a few hundred registrations),
so each rollup does a handful of full-collection scans and filters in Python
rather than maintaining composite indexes.

The key idea: a *registration* is one person-or-team signing up for one event,
but the organiser thinks in *people* — "who registered, for how many events,
and what did they pay in total". `participant_rows` is that pivot, grouped on
`uid` (the Firebase account, stored on every registration since the first
version and until now unused by any screen).
"""

from app.models.schemas import STATUS_COMPLETED
from app.services.firebase import get_db
from app.services.roles import ROLE_JUDGE, ROLE_VOLUNTEER, list_people


def load_all() -> dict:
    """One trip for everything the rollups need, so an endpoint that wants two
    of them doesn't re-read the same collections."""
    db = get_db()
    registrations = [{"id": d.id, **d.to_dict()} for d in db.collection("registrations").stream()]
    events = {d.id: {"id": d.id, **d.to_dict()} for d in db.collection("events").stream()}
    venues = {d.id: {"id": d.id, **d.to_dict()} for d in db.collection("venues").stream()}
    return {
        "registrations": registrations,
        "events": events,
        "venues": venues,
        "people": list_people(),
    }


def event_name(events: dict, event_id: str) -> str:
    return events.get(event_id, {}).get("name", event_id)


def _registration_view(r: dict, events: dict) -> dict:
    """One registration as the admin detail panel wants it."""
    return {
        "registration_id": r["id"],
        "event_id": r.get("event_id", ""),
        "event_name": event_name(events, r.get("event_id", "")),
        "status": r.get("status", ""),
        "fee": r.get("fee", 0),
        "checked_in": bool(r.get("checked_in")),
        "team_name": r.get("team_name", ""),
        "team_size": r.get("team_size", 1),
        "members": r.get("members", []),
        "created_at": r.get("created_at", ""),
        "paid_at": r.get("paid_at", ""),
        "payment_id": r.get("payment_id", ""),
        "order_id": r.get("order_id", ""),
        "payment_method": r.get("payment_method", ""),
    }


def participant_rows(data: dict | None = None) -> list[dict]:
    """One row per person, newest registration first.

    `total_paid` counts only completed registrations — an abandoned checkout
    never took money. `status` is "completed" if the person paid for at least
    one event, which is the same definition the Overview's Completed card uses.
    """
    data = data or load_all()
    registrations, events = data["registrations"], data["events"]

    by_uid: dict[str, list[dict]] = {}
    for r in registrations:
        # Fall back to the email for rows written before uid existed.
        by_uid.setdefault(r.get("uid") or r.get("email", "unknown"), []).append(r)

    rows = []
    for uid, regs in by_uid.items():
        regs.sort(key=lambda r: r.get("created_at", ""), reverse=True)
        latest = regs[0]
        completed = [r for r in regs if r.get("status") == STATUS_COMPLETED]
        # The most recent team registration supplies the table's team columns;
        # the full per-event breakdown is in `events`.
        team = next((r for r in regs if r.get("team_name")), None)

        rows.append(
            {
                "uid": uid,
                "name": latest.get("name", ""),
                "email": latest.get("email", ""),
                "phone": latest.get("phone", ""),
                "college": latest.get("college", ""),
                "events_count": len(regs),
                "events": [_registration_view(r, events) for r in regs],
                "total_paid": sum(r.get("fee", 0) for r in completed),
                "status": STATUS_COMPLETED if completed else latest.get("status", ""),
                "checked_in": any(r.get("checked_in") for r in regs),
                "team_name": team.get("team_name", "") if team else "",
                "team_size": team.get("team_size", 1) if team else 1,
                "members": team.get("members", []) if team else [],
                "created_at": latest.get("created_at", ""),
            }
        )

    rows.sort(key=lambda r: r.get("created_at", ""), reverse=True)
    return rows


def build_stats(data: dict | None = None) -> dict:
    """Shaped for the Overview. The three headline numbers count *people*, not
    registration rows — one person registering for four events is one signed
    user, not four."""
    data = data or load_all()
    registrations, events = data["registrations"], data["events"]

    def person_key(r: dict) -> str:
        return r.get("uid") or r.get("email", "unknown")

    completed = [r for r in registrations if r.get("status") == STATUS_COMPLETED]

    per_event = []
    for eid, event in events.items():
        rows = [r for r in registrations if r.get("event_id") == eid]
        done = [r for r in rows if r.get("status") == STATUS_COMPLETED]
        per_event.append(
            {
                "event_id": eid,
                "name": event.get("name", eid),
                "count": len(rows),
                "completed": len(done),
                "revenue": sum(r.get("fee", 0) for r in done),
            }
        )
    per_event.sort(key=lambda e: e["completed"], reverse=True)

    return {
        # Everyone who signed in and registered, paid or not.
        "signed_users": len({person_key(r) for r in registrations}),
        # Of those, the ones who paid for at least one event.
        "completed_users": len({person_key(r) for r in completed}),
        "revenue": sum(r.get("fee", 0) for r in completed),
        "checked_in": sum(1 for r in registrations if r.get("checked_in")),
        "total_registrations": len(registrations),
        "events_count": len(events),
        "per_event": per_event,
    }


def venue_rollup(data: dict | None = None) -> list[dict]:
    """Per venue: the event held there, its headcount, and who is staffing it."""
    data = data or load_all()
    registrations, events, venues, people = (
        data["registrations"],
        data["events"],
        data["venues"],
        data["people"],
    )

    rows = []
    for vid, venue in venues.items():
        venue_events = [e for e in events.values() if e.get("venue_id") == vid]
        event_ids = {e["id"] for e in venue_events}
        regs = [r for r in registrations if r.get("event_id") in event_ids]
        # One venue backs at most one event (enforced on write), so name the
        # single event rather than making the caller unpack a list.
        event = venue_events[0] if venue_events else None

        rows.append(
            {
                "id": vid,
                "name": venue.get("name", vid),
                "event_id": event["id"] if event else "",
                "event_name": event.get("name", "") if event else "",
                "registrations": len(regs),
                "checked_in": sum(1 for r in regs if r.get("checked_in")),
                "completed": sum(1 for r in regs if r.get("status") == STATUS_COMPLETED),
                "judges": [
                    p.get("name") or p["email"]
                    for p in people
                    if p.get("role") == ROLE_JUDGE
                    and set(p.get("event_ids") or []) & event_ids
                ],
                "volunteers": [
                    p.get("name") or p["email"]
                    for p in people
                    if p.get("role") == ROLE_VOLUNTEER and p.get("venue_id") == vid
                ],
            }
        )

    rows.sort(key=lambda v: v["name"])
    return rows
