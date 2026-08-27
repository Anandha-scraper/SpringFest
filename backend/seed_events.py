"""Run once to populate sample events: python seed_events.py"""
from app.services.firebase import get_db

EVENTS = [
    {"id": "paper-presentation", "name": "Paper Presentation",
     "description": "Present your research paper.", "fee": 200, "date": "2026-09-15"},
    {"id": "hackathon", "name": "24h Hackathon",
     "description": "Build something cool overnight.", "fee": 500, "date": "2026-09-16"},
    {"id": "tech-quiz", "name": "Tech Quiz",
     "description": "Team quiz on all things tech.", "fee": 0, "date": "2026-09-15"},
]

db = get_db()
for e in EVENTS:
    db.collection("events").document(e.pop("id")).set(e)
print("Seeded", len(EVENTS), "events")
