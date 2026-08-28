"""A minimal in-process TTL cache for the read-side rollups in aggregate.py
and events.py's venue-name lookup.

Every `/admin/*` endpoint used to call `aggregate.load_all()` independently —
four full Firestore collection scans each — with no reuse even when two of
them land within the same request burst (the admin dashboard and
ManageRoles both fire several of these calls in parallel). This collapses
that into one real scan per TTL window, with explicit `invalidate()` calls
from every write path so admin screens still reflect a write immediately
rather than waiting out the TTL.

Deliberately not a real caching library — one process, one dict, `time.monotonic()`
for expiry. Redis or similar would be over-engineering for "a few hundred
registrations" (see CLAUDE.md); the TTL is a safety net, not the primary
correctness mechanism.
"""

import time
from typing import Any, Callable

_store: dict[str, tuple[float, Any]] = {}


def cached(key: str, ttl_seconds: float, loader: Callable[[], Any]) -> Any:
    """Return the cached value for `key` if it hasn't expired, else call
    `loader()`, store the result, and return it."""
    hit = _store.get(key)
    now = time.monotonic()
    if hit is not None and hit[0] > now:
        return hit[1]

    value = loader()
    _store[key] = (now + ttl_seconds, value)
    return value


def invalidate(key: str) -> None:
    """Drop a cached entry so the next read recomputes it. Safe to call even
    if nothing is cached under `key` yet."""
    _store.pop(key, None)
