import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    FIREBASE_CREDENTIALS = os.getenv("FIREBASE_CREDENTIALS", "./serviceAccountKey.json")
    # Firestore database id; "(default)" unless a named database was created.
    FIRESTORE_DATABASE_ID = os.getenv("FIRESTORE_DATABASE_ID", "(default)")
    RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "")
    RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "")
    CORS_ORIGINS = [
        o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
    ]
    # Seeded organiser accounts — any Google login with one of these emails
    # gets admin access. Comma separated, case-insensitive.
    ADMIN_EMAILS = {
        e.strip().lower()
        for e in os.getenv("ADMIN_EMAILS", "").split(",")
        if e.strip()
    }


settings = Settings()
