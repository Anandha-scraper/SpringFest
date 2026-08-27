"""Populate Firestore with mock Spring Fest 2k26 events.

Run once:  python seed_events.py
Safe to re-run — documents are overwritten by id.
"""
from app.services.firebase import get_db

EVENTS = [
    {
        "id": "hackathon-24h",
        "name": "Codeathon 24",
        "category": "Technical",
        "description": "A 24-hour build sprint. Form a team of up to four, pick a track, ship something that works by sunrise.",
        "fee": 500,
        "date": "March 14, 2026",
    },
    {
        "id": "paper-presentation",
        "name": "Paper Presentation",
        "category": "Technical",
        "description": "Present original research to a panel of faculty and industry judges. Abstracts due one week prior.",
        "fee": 200,
        "date": "March 14, 2026",
    },
    {
        "id": "code-sprint",
        "name": "Code Sprint",
        "category": "Technical",
        "description": "Three rounds of competitive programming. Two hours, six problems, one keyboard.",
        "fee": 150,
        "date": "March 14, 2026",
    },
    {
        "id": "robotics-arena",
        "name": "Robotics Arena",
        "category": "Technical",
        "description": "Line-follower and combat bot categories. Bring your own build; pit space provided.",
        "fee": 400,
        "date": "March 15, 2026",
    },
    {
        "id": "ui-ux-challenge",
        "name": "UI/UX Design Challenge",
        "category": "Technical",
        "description": "Design a product screen flow against a surprise brief. Figma provided, four hours on the clock.",
        "fee": 150,
        "date": "March 15, 2026",
    },
    {
        "id": "workshop-applied-ai",
        "name": "Workshop — Applied AI",
        "category": "Workshops",
        "description": "Hands-on session on building with modern LLM APIs. Laptop required, certificate provided.",
        "fee": 300,
        "date": "March 15, 2026",
    },
    {
        "id": "tech-quiz",
        "name": "Tech Quiz",
        "category": "Non-Technical",
        "description": "Teams of two battle through prelims and a live buzzer final on the main stage.",
        "fee": 0,
        "date": "March 15, 2026",
    },
    {
        "id": "treasure-hunt",
        "name": "Campus Treasure Hunt",
        "category": "Non-Technical",
        "description": "Cryptic clues across the campus. Teams of four, two hours, no phones allowed.",
        "fee": 0,
        "date": "March 15, 2026",
    },
    {
        "id": "startup-pitch",
        "name": "Startup Pitch Fest",
        "category": "Non-Technical",
        "description": "Pitch your idea to a panel of founders and investors. Five minutes to pitch, five to defend.",
        "fee": 250,
        "date": "March 16, 2026",
    },
    {
        "id": "gaming-championship",
        "name": "Gaming Championship",
        "category": "Non-Technical",
        "description": "Squad-based LAN tournament. Peripherals welcome, rigs provided.",
        "fee": 200,
        "date": "March 16, 2026",
    },
]


def main():
    db = get_db()
    for event in EVENTS:
        data = dict(event)
        db.collection("events").document(data.pop("id")).set(data)
    print(f"Seeded {len(EVENTS)} events for Spring Fest 2k26")


if __name__ == "__main__":
    main()
