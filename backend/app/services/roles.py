"""Role resolution.

Precedence, highest first:

1. ``ADMIN_EMAILS`` in backend/.env — the seeded organiser accounts. These can
   never be removed through the API, so there is always a way back in.
2. The Firestore ``roles`` collection — one document per person, id = the
   lowercased email, written by the admin "manage people" endpoints.
3. Everyone else is a participant.

That last rule is why there is no participant list to maintain: anyone who
signs in and isn't a judge, volunteer or admin simply is one.
"""

from datetime import datetime, timezone

from app.config import settings
from app.services.firebase import get_db

ROLE_ADMIN = "admin"
ROLE_JUDGE = "judge"
ROLE_VOLUNTEER = "volunteer"
ROLE_PARTICIPANT = "participant"

# Every role resolve_role may read back out of a stored document.
KNOWN_ROLES = {ROLE_ADMIN, ROLE_JUDGE, ROLE_VOLUNTEER, ROLE_PARTICIPANT}

# What an admin may hand out. "participant" is absent on purpose: it's the
# absence of a record, so demoting someone is a DELETE, not a write.
ASSIGNABLE_ROLES = {ROLE_ADMIN, ROLE_JUDGE, ROLE_VOLUNTEER}

COLLECTION = "roles"


def normalize_email(email: str) -> str:
    return (email or "").strip().lower()


def resolve_role_and_assignments(email: str) -> tuple[str, dict]:
    """The caller's role, plus whatever they've been assigned (`event_ids` for
    a judge, `venue_id` for a volunteer) — one Firestore read instead of the
    two `GET /me` used to do (resolve_role, then a second doc read for the
    assignments it had already fetched and thrown away).

    Raises whatever Firestore raises if the lookup fails — deliberately. Quietly
    returning "participant" on an outage would demote real judges and admins
    with no signal; deps.py turns the failure into a 503 instead. Seeded env
    admins never reach Firestore, so they stay usable during an outage — and
    have no assignments, same as before.
    """
    key = normalize_email(email)
    if not key:
        return ROLE_PARTICIPANT, {}
    if key in settings.ADMIN_EMAILS:
        return ROLE_ADMIN, {}

    doc = get_db().collection(COLLECTION).document(key).get()
    if doc.exists:
        record = doc.to_dict() or {}
        role = record.get("role")
        assignments = {"event_ids": record.get("event_ids", []), "venue_id": record.get("venue_id", "")}
        if role in KNOWN_ROLES:
            return role, assignments
        return ROLE_PARTICIPANT, assignments
    return ROLE_PARTICIPANT, {}


def resolve_role(email: str) -> str:
    """The caller's role. Thin wrapper for callers that don't need assignments."""
    role, _ = resolve_role_and_assignments(email)
    return role


def list_people(role: str | None = None) -> list[dict]:
    """Everyone with an explicit role record, plus the seeded env admins."""
    by_email = {
        d.id: {"email": d.id, **(d.to_dict() or {})}
        for d in get_db().collection(COLLECTION).stream()
    }

    # Surface the env-seeded admins too, so the UI shows every organiser and not
    # just the ones added through the API. The env always wins over a document.
    for seeded in settings.ADMIN_EMAILS:
        row = by_email.setdefault(seeded, {"email": seeded, "name": ""})
        row["role"] = ROLE_ADMIN
        row["seeded"] = True

    rows = list(by_email.values())
    if role:
        rows = [r for r in rows if r.get("role") == role]
    rows.sort(key=lambda r: (r.get("role", ""), r["email"]))
    return rows


def upsert_person(email: str, role: str, name: str, added_by: str) -> dict:
    # seed_roles.py calls this directly, bypassing the pydantic validation at
    # the API edge — so re-check here.
    if role not in ASSIGNABLE_ROLES:
        raise ValueError(f"Unknown role: {role!r}")

    key = normalize_email(email)
    ref = get_db().collection(COLLECTION).document(key)
    existing = ref.get()
    now = datetime.now(timezone.utc).isoformat()

    payload = {"role": role, "name": name or "", "updated_at": now, "updated_by": added_by}
    if not existing.exists:
        # Only stamp provenance on create, so "added by" doesn't drift into
        # meaning "last edited by".
        payload |= {"added_by": added_by, "created_at": now}

    ref.set(payload, merge=True)
    return {"email": key, **(existing.to_dict() or {}), **payload}


def remove_person(email: str) -> bool:
    """Delete the role record; the person keeps their account and becomes a
    participant again. Returns False if there was nothing to remove — Firestore
    deletes are idempotent, so the caller can't tell otherwise."""
    ref = get_db().collection(COLLECTION).document(normalize_email(email))
    if not ref.get().exists:
        return False
    ref.delete()
    return True


def is_seeded_admin(email: str) -> bool:
    return normalize_email(email) in settings.ADMIN_EMAILS


# ── Assignments: judges work events, volunteers cover a venue ──


def events_overlap(a: dict, b: dict) -> bool:
    """Same day and overlapping [start, end). Times are "HH:MM", so a plain
    string comparison is also a chronological one."""
    if not a or not b or a.get("date") != b.get("date"):
        return False
    a_start, a_end = a.get("start_time", ""), a.get("end_time", "")
    b_start, b_end = b.get("start_time", ""), b.get("end_time", "")
    if not (a_start and a_end and b_start and b_end):
        return False
    return a_start < b_end and b_start < a_end


def find_conflict(event_ids: list[str], events: dict) -> tuple[dict, dict] | None:
    """The first pair of assigned events that collide in time, or None.

    A judge can hold several assignments but can't be in two rooms at once, so
    this runs before an assignment is saved rather than surfacing a
    double-booking on the day.
    """
    chosen = [events[eid] for eid in event_ids if eid in events]
    for i, first in enumerate(chosen):
        for second in chosen[i + 1 :]:
            if events_overlap(first, second):
                return first, second
    return None


def set_assignments(
    email: str, event_ids: list[str] | None = None, venue_id: str | None = None
) -> dict:
    """Write a judge's events or a volunteer's venue onto their role record.

    Uses merge, so the role/name/provenance written by `upsert_person` survive,
    and equally an assignment survives a later role edit.
    """
    key = normalize_email(email)
    ref = get_db().collection(COLLECTION).document(key)
    existing = ref.get()
    if not existing.exists:
        raise LookupError(f"No role record for {key}")

    payload: dict = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if event_ids is not None:
        payload["event_ids"] = event_ids
    if venue_id is not None:
        payload["venue_id"] = venue_id

    ref.set(payload, merge=True)
    return {"email": key, **(existing.to_dict() or {}), **payload}
