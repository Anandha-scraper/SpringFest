from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class Event(BaseModel):
    id: str
    name: str
    description: str = ""
    category: str = ""
    fee: int = 0  # INR
    date: str = ""


class RegistrationCreate(BaseModel):
    event_id: str
    name: str = Field(min_length=2)
    email: EmailStr
    phone: str = Field(min_length=8, max_length=15)
    college: str = ""


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


# ── Roles / people management ────────────────────────────────
# "participant" is absent on purpose — demoting someone is a DELETE, not a write.
AssignableRole = Literal["admin", "judge", "volunteer"]


class PersonCreate(BaseModel):
    email: EmailStr
    role: AssignableRole
    name: str = ""


class Person(BaseModel):
    email: str
    role: str
    name: str = ""
    added_by: str = ""
    updated_at: str = ""
    # True for accounts listed in ADMIN_EMAILS — managed in .env, not the API.
    seeded: bool = False
