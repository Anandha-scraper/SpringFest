import os

import firebase_admin
from firebase_admin import credentials, firestore

from app.config import settings

_db = None


def _init_app():
    if firebase_admin._apps:
        return
    if os.path.exists(settings.FIREBASE_CREDENTIALS):
        firebase_admin.initialize_app(
            credentials.Certificate(settings.FIREBASE_CREDENTIALS)
        )
    else:
        # Cloud Run / GCP: use Application Default Credentials
        firebase_admin.initialize_app()


def get_db():
    global _db
    if _db is None:
        _init_app()
        _db = firestore.client()
    return _db
