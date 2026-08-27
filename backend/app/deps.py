from fastapi import Depends, Header, HTTPException
from firebase_admin import auth as fb_auth

from app.services.firebase import get_db  # ensures Firebase app is initialised


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
    return {"uid": decoded["uid"], "email": decoded.get("email", "")}


CurrentUser = Depends(get_current_user)
