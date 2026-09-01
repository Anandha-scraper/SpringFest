/** Small, reusable request-body checks — the hand-rolled replacement for
 * Pydantic's field validation. Each helper throws an ApiError(400, ...) with
 * the same kind of message FastAPI/Pydantic would have produced, so routes
 * stay a single readable list of checks instead of duplicating regexes.
 */
import { ApiError } from "./ApiError.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function requireString(value, { field, minLength = 1 } = {}) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (trimmed.length < minLength) {
    throw new ApiError(400, `${field}: string should have at least ${minLength} character${minLength === 1 ? "" : "s"}`);
  }
  return trimmed;
}

export function optionalString(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export function requireEmail(value, { field = "email" } = {}) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!EMAIL_RE.test(trimmed)) {
    throw new ApiError(400, `${field}: value is not a valid email address`);
  }
  return trimmed;
}

// India mobile numbers: exactly 10 digits. Spaces/dashes a participant might
// type (e.g. "98765 43210") are stripped before checking, but the stored
// value is always the bare 10 digits.
const PHONE_RE = /^\d{10}$/;

export function requirePhone(value, { field = "phone" } = {}) {
  const digits = typeof value === "string" ? value.replace(/[\s-]/g, "") : "";
  if (!PHONE_RE.test(digits)) {
    throw new ApiError(400, `${field}: phone number should be exactly 10 digits`);
  }
  return digits;
}

export function requireInt(value, { field, min } = {}) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n) || (min !== undefined && n < min)) {
    throw new ApiError(400, `${field}: input should be an integer${min !== undefined ? ` >= ${min}` : ""}`);
  }
  return n;
}

export function optionalInt(value, fallback, opts = {}) {
  if (value === undefined || value === null) return fallback;
  return requireInt(value, opts);
}

export function requireBool(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

export function requireOneOf(value, allowed, { field } = {}) {
  if (!allowed.includes(value)) {
    throw new ApiError(400, `${field}: input should be one of ${allowed.join(", ")}`);
  }
  return value;
}

/** Study years offered in the registration form. Strings, not numbers — they
 * come off a <select> and are only ever displayed and exported, never
 * arithmetic. */
export const STUDY_YEARS = ["1", "2", "3", "4", "PG"];

/** Departments offered in the registration form. Keep in sync with
 * web/src/content/formOptions.js. */
export const DEPARTMENTS = ["CSE", "ECE", "IT", "MECH", "EEE", "Others"];

/** Event categories offered in the admin event form. Keep in sync with
 * web/src/content/formOptions.js.
 *
 * Required on create rather than optional: the admin Events page groups every
 * event under one of these headings, so an event stored with an empty
 * category renders under no heading at all and is invisible in the UI. */
export const EVENT_CATEGORIES = ["Technical", "Non-Technical", "Hackathon", "Workshop"];

/** Tamil Nadu districts offered in the registration form, plus "Other" for
 * anyone outside the state — keep in sync with web/src/content/formOptions.js. */
export const TN_CITIES = [
  "Ariyalur", "Chengalpattu", "Chennai", "Coimbatore", "Cuddalore", "Dharmapuri",
  "Dindigul", "Erode", "Kallakurichi", "Kancheepuram", "Kanyakumari", "Karur",
  "Krishnagiri", "Madurai", "Mayiladuthurai", "Nagapattinam", "Namakkal",
  "Nilgiris", "Perambalur", "Pudukkottai", "Ramanathapuram", "Ranipet",
  "Salem", "Sivaganga", "Tenkasi", "Thanjavur", "Theni", "Thoothukudi",
  "Tiruchirappalli", "Tirunelveli", "Tirupathur", "Tiruppur", "Tiruvallur",
  "Tiruvannamalai", "Tiruvarur", "Vellore", "Viluppuram", "Virudhunagar",
  "Other",
];

/** The academic details every participant gives, whether they're the team
 * lead or a member. Shared so the two can't drift apart — the admin CSV
 * and the QR tickets assume both carry the same shape.
 *
 * Location is a Tamil Nadu district picked from a dropdown, except "Other" —
 * picking that reveals a free-text field (`location_other`) so someone from
 * outside the state isn't blocked from registering; the stored `location` is
 * always the real place name, never the literal word "Other". */
export function parseParticipantDetails(raw, prefix = "") {
  const field = (name) => (prefix ? `${prefix}.${name}` : name);
  const college = requireString(raw?.college, { field: field("college"), minLength: 2 });
  const department = requireOneOf(raw?.department, DEPARTMENTS, { field: field("department") });
  const year = requireOneOf(typeof raw?.year === "number" ? String(raw.year) : raw?.year, STUDY_YEARS, {
    field: field("year"),
  });
  const pickedCity = requireOneOf(raw?.location, TN_CITIES, { field: field("location") });
  const location =
    pickedCity === "Other"
      ? requireString(raw?.location_other, { field: field("location_other"), minLength: 2 })
      : pickedCity;

  return { college, department, year, location };
}

/** A team member entry, matching TeamMember in the old Pydantic schema. */
export function parseTeamMember(raw, index) {
  const prefix = `members[${index}]`;
  return {
    name: requireString(raw?.name, { field: `${prefix}.name`, minLength: 2 }),
    email: requireEmail(raw?.email, { field: `${prefix}.email` }),
    phone: requirePhone(raw?.phone, { field: `${prefix}.phone` }),
    ...parseParticipantDetails(raw, prefix),
  };
}
