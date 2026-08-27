from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import events, me, registrations

app = FastAPI(title="Symposium API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Served behind Firebase Hosting rewrite "/api/**" -> Cloud Run
app.include_router(events.router, prefix="/api")
app.include_router(registrations.router, prefix="/api")
app.include_router(me.router, prefix="/api")


@app.get("/")
def health():
    return {"status": "ok"}
