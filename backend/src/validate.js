/** Small, reusable request-body checks — the hand-rolled replacement for
 * Pydantic's field validation. Each helper throws an ApiError(400, ...) with
 * the same kind of message FastAPI/Pydantic would have produced, so routes
 * stay a single readable list of checks instead of duplicating regexes.
 */
import { ApiError } from "./errors.js";

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

export function requirePhone(value, { field = "phone", minLength = 8, maxLength = 15 } = {}) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (trimmed.length < minLength || trimmed.length > maxLength) {
    throw new ApiError(400, `${field}: string should have ${minLength} to ${maxLength} characters`);
  }
  return trimmed;
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
export const STUDY_YEARS = ["1", "2", "3", "4", "5"];

/** The academic details every participant gives, whether they're the team
 * lead or a member. Shared so the two can't drift apart — the admin CSV
 * and the QR tickets assume both carry the same shape. */
export function parseParticipantDetails(raw, prefix = "") {
  const field = (name) => (prefix ? `${prefix}.${name}` : name);
  return {
    college: requireString(raw?.college, { field: field("college"), minLength: 2 }),
    department: requireString(raw?.department, { field: field("department"), minLength: 2 }),
    year: requireOneOf(typeof raw?.year === "number" ? String(raw.year) : raw?.year, STUDY_YEARS, {
      field: field("year"),
    }),
    location: requireString(raw?.location, { field: field("location"), minLength: 2 }),
  };
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
