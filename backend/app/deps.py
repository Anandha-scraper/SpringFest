from fastapi import Depends, Header, HTTPException
from firebase_admin import auth as fb_auth

from app.config import settings
from app.services.firebase import get_db  # ensures the Firebase app is initialised


def is_admin_email(email: str) -> bool:
    return bool(email) and email.lower() in settings.ADMIN_EMAILS


def get_current_user(authorization: str = Header(default="")) -> dict:
    """Verify the Firebase ID token from the Authorization: Bearer <token> header."""
    get_db()  # init app
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing bearer token")
    token = authorization.split(" ", 1)[1]
    try:
        decoded = fb_auth.verify_id_token(token)
    except Exception:
        raise HTTPException(401, "Invalid or expired token")

    email = decoded.get("email", "")
    return {
        "uid": decoded["uid"],
        "email": email,
        "name": decoded.get("name", ""),
        "picture": decoded.get("picture", ""),
        "is_admin": is_admin_email(email),
    }


CurrentUser = Depends(get_current_user)


def get_admin_user(user: dict = CurrentUser) -> dict:
    if not user["is_admin"]:
        raise HTTPException(403, "Admin access required")
    return user


AdminUser = Depends(get_admin_user)
