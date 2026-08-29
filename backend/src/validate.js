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

/** A team member entry, matching TeamMember in the old Pydantic schema. */
export function parseTeamMember(raw, index) {
  return {
    name: requireString(raw?.name, { field: `members[${index}].name`, minLength: 2 }),
    email: requireEmail(raw?.email, { field: `members[${index}].email` }),
    phone: requirePhone(raw?.phone, { field: `members[${index}].phone` }),
  };
}
