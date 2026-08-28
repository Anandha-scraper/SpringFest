from typing import Literal

from pydantic import BaseModel, EmailStr, Field


# ── Venues ───────────────────────────────────────────────────
# Name only. Capacity was dropped deliberately: seats are managed off-system,
# and an inaccurate capacity produced misleading "over capacity" warnings.
class VenueCreate(BaseModel):
    name: str = Field(min_length=2)


class Venue(BaseModel):
    id: str
    name: str
    created_at: str = ""


# ── Events ───────────────────────────────────────────────────
class Event(BaseModel):
    id: str
    name: str
    description: str = ""
    category: str = ""
    venue_id: str = ""
    venue_name: str = ""  # resolved on read; not stored
    date: str = ""  # ISO "2026-03-14"
    start_time: str = ""  # "HH:MM"
    end_time: str = ""
    fee: int = 0  # INR
    is_team_event: bool = False
    team_min: int = 1
    team_max: int = 1
    # True once at least one registration exists: name/fee/date/category freeze.
    locked: bool = False


class EventCreate(BaseModel):
    name: str = Field(min_length=2)
    description: str = ""
    category: str = ""
    venue_id: str = ""
    date: str = ""
    start_time: str = ""
    end_time: str = ""
    fee: int = Field(default=0, ge=0)
    is_team_event: bool = False
    team_min: int = Field(default=1, ge=1)
    team_max: int = Field(default=1, ge=1)


class EventUpdate(BaseModel):
    """Every field optional — only what's sent is changed. Once an event has
    registrations, the locked fields below are rejected (see routers/events.py)."""

    name: str | None = None
    description: str | None = None
    category: str | None = None
    venue_id: str | None = None
    date: str | None = None
    start_time: str | None = None
    end_time: str | None = None
    fee: int | None = Field(default=None, ge=0)
    is_team_event: bool | None = None
    team_min: int | None = Field(default=None, ge=1)
    team_max: int | None = Field(default=None, ge=1)


# Changing any of these after someone has registered would rewrite the deal
# they signed up to, so they freeze. Venue and time can still move.
LOCKED_FIELDS = {"name", "fee", "date", "category", "is_team_event", "team_min", "team_max"}


# ── Registrations ────────────────────────────────────────────
# One vocabulary for the API and the UI. "completed" (not "confirmed") is what
# the admin screens render, so the stored value matches what an organiser reads.
STATUS_PENDING = "pending"
STATUS_COMPLETED = "completed"
STATUS_FAILED = "failed"


class TeamMember(BaseModel):
    name: str = Field(min_length=2)
    email: EmailStr
    phone: str = Field(min_length=8, max_length=15)


class RegistrationCreate(BaseModel):
    event_id: str
    name: str = Field(min_length=2)
    email: EmailStr
    phone: str = Field(min_length=8, max_length=15)
    college: str = ""
    # The signed-in user is the team lead; members are their teammates, who do
    # not sign in themselves. The lead pays one fee for the whole team.
    team_name: str = ""
    members: list[TeamMember] = []


class OrderResponse(BaseModel):
    registration_id: str
    order_id: str
    amount: int
    currency: str
    key_id: str


class PaymentVerify(BaseModel):
    registration_id: str
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


class CheckIn(BaseModel):
    registration_id: str
    checked_in: bool = True


# ── Roles / people management ────────────────────────────────
# "participant" is absent on purpose — demoting someone is a DELETE, not a write.
AssignableRole = Literal["admin", "judge", "volunteer"]


class PersonCreate(BaseModel):
    email: EmailStr
    role: AssignableRole
    name: str = ""


class Assignments(BaseModel):
    """A judge works events; a volunteer covers one venue. Only the field that
    matches the person's role is applied."""

    event_ids: list[str] | None = None
    venue_id: str | None = None


class Person(BaseModel):
    email: str
    role: str
    name: str = ""
    added_by: str = ""
    updated_at: str = ""
    # True for accounts listed in ADMIN_EMAILS — managed in .env, not the API.
    seeded: bool = False
    event_ids: list[str] = []
    venue_id: str = ""
