from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.config import settings
from app.routers import admin, events, me, registrations, volunteer

app = FastAPI(title="Spring Fest 2k26 API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Several admin endpoints return large JSON (full registration/participant
# lists) — compress anything worth compressing rather than shipping it raw.
app.add_middleware(GZipMiddleware, minimum_size=500)

# Every router is mounted under /api; the frontend's VITE_API_BASE points at it.
app.include_router(events.router, prefix="/api")
app.include_router(registrations.router, prefix="/api")
app.include_router(me.router, prefix="/api")
app.include_router(volunteer.router, prefix="/api")
app.include_router(admin.router, prefix="/api")


@app.get("/")
def health():
    return {"status": "ok"}
