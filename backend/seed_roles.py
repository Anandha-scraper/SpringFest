"""Populate Firestore with sample judge / volunteer role records.

Run once:  python seed_roles.py
Safe to re-run — documents are overwritten by email.

Admins are NOT seeded here: they come from ADMIN_EMAILS in backend/.env, which
takes precedence over this collection so you can't lock yourself out. Anyone not
listed here and not in ADMIN_EMAILS is a participant by default.
"""
from datetime import datetime, timezone

from app.services.firebase import get_db
from app.services.roles import COLLECTION, normalize_email

PEOPLE = [
    {"email": "judge.one@example.edu", "role": "judge", "name": "Judge One"},
    {"email": "judge.two@example.edu", "role": "judge", "name": "Judge Two"},
    {"email": "volunteer.one@example.edu", "role": "volunteer", "name": "Volunteer One"},
    {"email": "volunteer.two@example.edu", "role": "volunteer", "name": "Volunteer Two"},
]


def main():
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    for person in PEOPLE:
        key = normalize_email(person["email"])
        db.collection(COLLECTION).document(key).set(
            {
                "role": person["role"],
                "name": person["name"],
                "added_by": "seed_roles.py",
                "updated_at": now,
            }
        )
        print(f"  {key} -> {person['role']}")
    print(f"Seeded {len(PEOPLE)} role records into '{COLLECTION}'.")


if __name__ == "__main__":
    main()
