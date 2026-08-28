from fastapi import Depends, Header, HTTPException
from firebase_admin import auth as fb_auth

from app.services.firebase import get_db  # ensures the Firebase app is initialised
from app.services.roles import (
    ROLE_ADMIN,
    ROLE_JUDGE,
    ROLE_VOLUNTEER,
    resolve_role,
)


def get_current_user(authorization: str = Header(default="")) -> dict:
    """Verify the Firebase ID token from the Authorization: Bearer <token> header
    and attach the caller's role.

    The role is resolved server-side on every request (see services/roles.py) —
    one Firestore read, which keeps role changes effective immediately.
    """
    # Cheap checks first: a missing header is a 401 regardless of whether
    # Firebase is reachable, and calling get_db() first turned that into a 500.
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing bearer token")
    token = authorization.split(" ", 1)[1]

    get_db()  # init the Firebase app
    try:
        decoded = fb_auth.verify_id_token(token)
    except Exception:
        raise HTTPException(401, "Invalid or expired token")

    email = decoded.get("email", "")
    try:
        role = resolve_role(email)
    except Exception:
        # Failing closed: better a clear 503 than silently demoting a judge or
        # admin to participant because Firestore blinked.
        raise HTTPException(503, "Role lookup unavailable, please retry")
    return {
        "uid": decoded["uid"],
        "email": email,
        "name": decoded.get("name", ""),
        "picture": decoded.get("picture", ""),
        "role": role,
        "is_admin": role == ROLE_ADMIN,
    }


CurrentUser = Depends(get_current_user)


def require_roles(*allowed: str):
    """Dependency factory. Admins satisfy every check — that rule lives here
    alone so it can't drift between endpoints."""

    def dependency(user: dict = CurrentUser) -> dict:
        if user["role"] != ROLE_ADMIN and user["role"] not in allowed:
            raise HTTPException(403, f"Requires one of: {', '.join(allowed)}")
        return user

    return dependency


def get_admin_user(user: dict = CurrentUser) -> dict:
    if not user["is_admin"]:
        raise HTTPException(403, "Admin access required")
    return user


AdminUser = Depends(get_admin_user)
JudgeUser = Depends(require_roles(ROLE_JUDGE))
VolunteerUser = Depends(require_roles(ROLE_VOLUNTEER))
