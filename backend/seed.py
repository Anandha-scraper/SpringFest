"""Populate Firestore with the fest's venues, events and staff.

Safe to re-run: every write is keyed by a deterministic document id, so a
second run updates rather than duplicates.

    ./seed.sh                        # venues, events, roles
    .venv/bin/python seed.py --registrations 120   # + sample registrations
    .venv/bin/python seed.py --wipe-registrations  # clear the samples again

The --registrations flag exists so the admin aggregates (per-person rollups,
revenue, check-in counts) can be exercised without paying through Razorpay a
hundred times. It is deterministic — the same run produces the same numbers,
so a screenshot taken today still matches tomorrow.
"""

import argparse
from datetime import datetime, timedelta, timezone

from app.services.firebase import get_db
from app.services.roles import normalize_email

NOW = datetime.now(timezone.utc).isoformat()

VENUES = [
    ("audi", "Main Auditorium"),
    ("cse-lab-1", "CSE Lab 1"),
    ("cse-lab-2", "CSE Lab 2"),
    ("cse-lab-3", "CSE Lab 3"),
    ("seminar-hall-a", "Seminar Hall A"),
    ("seminar-hall-b", "Seminar Hall B"),
    ("open-air", "Open Air Theatre"),
    ("classroom-101", "Classroom 101"),
]

# One venue per event — the API enforces it on write, and the seed respects it.
EVENTS = [
    {
        "id": "paper-presentation",
        "name": "Paper Presentation",
        "category": "Technical",
        "venue_id": "seminar-hall-a",
        "date": "2026-03-14",
        "start_time": "10:00",
        "end_time": "13:00",
        "fee": 200,
        "description": "Present original research to a panel of faculty and industry judges.",
    },
    {
        "id": "code-sprint",
        "name": "Code Sprint",
        "category": "Technical",
        "venue_id": "cse-lab-1",
        "date": "2026-03-14",
        "start_time": "10:00",
        "end_time": "16:00",
        "fee": 150,
        "description": "Timed competitive programming across three rounds.",
    },
    {
        "id": "circuit-debug",
        "name": "Circuit Debugging",
        "category": "Technical",
        "venue_id": "cse-lab-2",
        "date": "2026-03-15",
        "start_time": "09:30",
        "end_time": "12:30",
        "fee": 100,
        "description": "Find and fix the faults before the clock runs out.",
    },
    {
        "id": "quiz-mania",
        "name": "Quiz Mania",
        "category": "Non-Technical",
        "venue_id": "seminar-hall-b",
        "date": "2026-03-15",
        "start_time": "14:00",
        "end_time": "16:00",
        "fee": 0,
        "is_team_event": True,
        "team_min": 2,
        "team_max": 2,
        "description": "General knowledge and pop culture, in teams of two.",
    },
    {
        "id": "photography",
        "name": "Photo Story",
        "category": "Non-Technical",
        "venue_id": "open-air",
        "date": "2026-03-14",
        "start_time": "09:00",
        "end_time": "17:00",
        "fee": 50,
        "description": "Tell a story in five frames, shot on campus during the fest.",
    },
    {
        "id": "hackathon-24h",
        "name": "Codeathon 24",
        "category": "Hackathon",
        "venue_id": "cse-lab-3",
        "date": "2026-03-14",
        "start_time": "18:00",
        "end_time": "23:59",
        "fee": 500,
        "is_team_event": True,
        "team_min": 2,
        "team_max": 4,
        "description": "A 24-hour build sprint. Teams of up to four, ship by sunrise.",
    },
    {
        "id": "ai-workshop",
        "name": "Applied AI Workshop",
        "category": "Workshop",
        "venue_id": "audi",
        "date": "2026-03-15",
        "start_time": "10:00",
        "end_time": "13:00",
        "fee": 300,
        "description": "Hands-on session on building with modern model APIs.",
    },
    {
        "id": "iot-workshop",
        "name": "IoT Starter Workshop",
        "category": "Workshop",
        "venue_id": "classroom-101",
        "date": "2026-03-16",
        "start_time": "10:00",
        "end_time": "13:30",
        "fee": 250,
        "description": "Wire up sensors and stream readings to a dashboard.",
    },
]

PEOPLE = [
    {"email": "judge.one@example.edu", "name": "Dr. Priya Raman", "role": "judge",
     "event_ids": ["paper-presentation"]},
    {"email": "judge.two@example.edu", "name": "Prof. Arun Kumar", "role": "judge",
     "event_ids": ["code-sprint", "circuit-debug"]},
    {"email": "judge.three@example.edu", "name": "Dr. Meera Nair", "role": "judge",
     "event_ids": []},
    {"email": "vol.one@example.edu", "name": "Karthik S", "role": "volunteer",
     "venue_id": "cse-lab-1"},
    {"email": "vol.two@example.edu", "name": "Divya R", "role": "volunteer",
     "venue_id": "seminar-hall-a"},
    {"email": "vol.three@example.edu", "name": "Nikhil P", "role": "volunteer",
     "venue_id": "open-air"},
    {"email": "vol.four@example.edu", "name": "Anjali M", "role": "volunteer",
     "venue_id": ""},
]


def seed_venues(db):
    for venue_id, name in VENUES:
        db.collection("venues").document(venue_id).set(
            {"name": name, "created_at": NOW}, merge=True
        )
    print(f"venues:  {len(VENUES)}")


def seed_events(db):
    for event in EVENTS:
        data = {
            "is_team_event": False,
            "team_min": 1,
            "team_max": 1,
            "created_at": NOW,
            "updated_at": NOW,
            **{k: v for k, v in event.items() if k != "id"},
        }
        db.collection("events").document(event["id"]).set(data, merge=True)
    print(f"events:  {len(EVENTS)}")


def seed_roles(db):
    for person in PEOPLE:
        key = normalize_email(person["email"])
        db.collection("roles").document(key).set(
            {
                "role": person["role"],
                "name": person["name"],
                "event_ids": person.get("event_ids", []),
                "venue_id": person.get("venue_id", ""),
                "added_by": "seed.py",
                "created_at": NOW,
                "updated_at": NOW,
            },
            merge=True,
        )
    print(f"roles:   {len(PEOPLE)}")


# ── Sample registrations ─────────────────────────────────────

COLLEGES = ["KSRCE", "PSG Tech", "CIT Coimbatore", "Anna University", "SSN College"]
FIRST = ["Aditya", "Sneha", "Rahul", "Isha", "Vikram", "Lakshmi", "Rohit", "Nandini",
         "Sanjay", "Pooja", "Arjun", "Kavya", "Manoj", "Deepa", "Surya", "Ritu"]
LAST = ["Sharma", "Iyer", "Reddy", "Menon", "Gupta", "Pillai", "Krishnan", "Das"]
TEAM_NAMES = ["Team Nova", "Team Falcon", "Team Vertex", "Team Orbit", "Team Photon",
              "Team Cipher", "Team Quantum", "Team Nimbus", "Team Vortex", "Team Ember"]
METHODS = ["upi", "card", "netbanking", "wallet"]


def _person(n: int) -> dict:
    """A deterministic fake participant. The pool is deliberately smaller than
    the registration count, so some people register for several events — which
    is exactly what the per-person admin view has to handle."""
    first, last = FIRST[n % len(FIRST)], LAST[(n // len(FIRST)) % len(LAST)]
    college = COLLEGES[n % len(COLLEGES)]
    slug = college.lower().replace(" ", "")
    return {
        "uid": f"seed-uid-{n:03d}",
        "name": f"{first} {last}",
        "email": f"{first.lower()}.{last.lower()}{n}@{slug}.edu",
        "phone": f"9{800000000 + n * 137}"[:10],
        "college": college,
    }


def seed_registrations(db, count: int):
    people_pool = len(FIRST) * len(LAST) // 4  # 32 distinct people
    base = datetime(2026, 2, 10, 9, 0, tzinfo=timezone.utc)
    batch, written = db.batch(), 0

    for n in range(count):
        # Person cycles every `people_pool`; the event index is offset by which
        # lap we're on, so a repeat visitor always lands on a *different* event.
        # Anything simpler (event = n % 8) would hand the same person the same
        # event twice, which the API's duplicate guard rightly rejects.
        person = _person(n % people_pool)
        event = EVENTS[(n // people_pool + n) % len(EVENTS)]
        # ~5 in 7 pay successfully; the rest are abandoned or failed checkouts.
        bucket = n % 7
        status = "completed" if bucket < 5 else "failed" if bucket == 5 else "pending"
        paid = status == "completed" and event["fee"] > 0
        created = base + timedelta(days=n % 18, minutes=(n * 37) % 600)

        members = []
        if event.get("is_team_event"):
            size = event["team_min"] + (n % (event["team_max"] - event["team_min"] + 1))
            members = [
                {k: v for k, v in _person((n + i + 1) % people_pool).items() if k != "uid"}
                for i in range(size - 1)
            ]

        doc = {
            **person,
            "user_email": person["email"],
            "event_id": event["id"],
            "fee": event["fee"],
            "status": status,
            "checked_in": status == "completed" and n % 3 != 0,
            "team_name": TEAM_NAMES[n % len(TEAM_NAMES)] if members else "",
            "members": members,
            "team_size": 1 + len(members),
            "created_at": created.isoformat(),
            "order_id": f"order_seed{n:04d}" if event["fee"] > 0 else "",
            "payment_id": f"pay_seed{n:04d}" if paid else "",
            "payment_method": METHODS[n % len(METHODS)] if paid else "",
            "paid_at": (created + timedelta(minutes=2)).isoformat() if paid else "",
        }
        if doc["checked_in"]:
            doc |= {
                "checked_in_at": (created + timedelta(days=20)).isoformat(),
                "checked_in_by": "vol.one@example.edu",
            }

        batch.set(db.collection("registrations").document(f"seed-{n:04d}"), doc)
        written += 1
        # Firestore caps a batch at 500 writes.
        if written % 400 == 0:
            batch.commit()
            batch = db.batch()

    batch.commit()
    print(f"registrations: {count} sample rows (ids seed-0000…)")


def _delete_all(db, collection: str) -> int:
    docs = list(db.collection(collection).stream())
    batch, pending = db.batch(), 0
    for doc in docs:
        batch.delete(doc.reference)
        pending += 1
        if pending % 400 == 0:
            batch.commit()
            batch = db.batch()
    if pending:
        batch.commit()
    return len(docs)


def flush(db):
    """Empty every collection: registrations, events, venues and roles.

    Admin access is unaffected — the organiser accounts in ADMIN_EMAILS live in
    backend/.env and were never Firestore documents, so there is always a way
    back in after a flush. Judges and volunteers ARE stored in `roles` and do
    get removed; re-run the seed or re-add them from the Add Roles page.
    """
    for collection in ("registrations", "events", "venues", "roles"):
        print(f"{collection + ':':16} removed {_delete_all(db, collection)}")


def wipe_registrations(db):
    # Batched: deleting a few hundred docs one round trip at a time takes
    # minutes, a batch takes seconds.
    docs = [d for d in db.collection("registrations").stream() if d.id.startswith("seed-")]
    batch, pending = db.batch(), 0
    for doc in docs:
        batch.delete(doc.reference)
        pending += 1
        if pending % 400 == 0:
            batch.commit()
            batch = db.batch()
    if pending:
        batch.commit()
    print(f"removed {len(docs)} sample registrations")


def main():
    parser = argparse.ArgumentParser(description="Seed Firestore for Spring Fest.")
    parser.add_argument("--registrations", type=int, default=0,
                        help="also write N sample registrations for testing the admin views")
    parser.add_argument("--wipe-registrations", action="store_true",
                        help="delete previously seeded sample registrations and exit")
    parser.add_argument("--flush", action="store_true",
                        help="EMPTY every collection and exit (ADMIN_EMAILS access is unaffected)")
    args = parser.parse_args()

    db = get_db()
    if args.flush:
        flush(db)
        return
    if args.wipe_registrations:
        wipe_registrations(db)
        return

    seed_venues(db)
    seed_events(db)
    seed_roles(db)
    if args.registrations:
        seed_registrations(db, args.registrations)
    print("done.")


if __name__ == "__main__":
    main()
