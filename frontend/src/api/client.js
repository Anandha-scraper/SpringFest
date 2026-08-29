import { auth } from "../auth/firebase.js";

// Same-origin by default: in production the Express server serves this SPA,
// and local dev runs it behind Vite's `/api` proxy (see vite.config.js).
const BASE = import.meta.env.VITE_API_BASE || "/api";

async function authHeader() {
  const token = await auth?.currentUser?.getIdToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function req(path, options = {}, authRequired = false) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (authRequired) Object.assign(headers, await authHeader());

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Request failed: ${res.status}`);
  }
  // DELETE replies 204 with no body — res.json() would throw on it.
  if (res.status === 204) return null;
  return res.json().catch(() => null);
}

// ── Public ───────────────────────────────────────────────────
export const getEvents = () => req("/events");
export const getEvent = (id) => req(`/events/${id}`);

// ── Authenticated ────────────────────────────────────────────
export const getMe = () => req("/me", {}, true);
export const createRegistration = (data) =>
  req("/registrations", { method: "POST", body: JSON.stringify(data) }, true);
export const verifyPayment = (data) =>
  req("/registrations/verify", { method: "POST", body: JSON.stringify(data) }, true);
export const getMyRegistrations = () => req("/me/registrations", {}, true);

// ── Admin ────────────────────────────────────────────────────
export const getAdminStats = () => req("/admin/stats", {}, true);

/** One row per person, with their events rolled up. The Registrations screen. */
export const getParticipants = () => req("/admin/participants", {}, true);

/** Per venue: its event, headcount, check-ins and assigned staff. */
export const getVenueRollup = () => req("/admin/venues/rollup", {}, true);

export const getAdminRegistrations = (filters = {}) => {
  const qs = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v)
  ).toString();
  return req(`/admin/registrations${qs ? `?${qs}` : ""}`, {}, true);
};

export const getEventParticipants = (eventId) =>
  req(`/admin/events/${eventId}/participants`, {}, true);

// Venues — name only; the API refuses to delete one that still backs an event.
export const getVenues = () => req("/admin/venues", {}, true);

export const addVenue = (data) =>
  req("/admin/venues", { method: "POST", body: JSON.stringify(data) }, true);

export const removeVenue = (id) =>
  req(`/admin/venues/${encodeURIComponent(id)}`, { method: "DELETE" }, true);

// Events — reads are public, writes are admin-only.
export const createEvent = (data) =>
  req("/events", { method: "POST", body: JSON.stringify(data) }, true);

export const updateEvent = (id, data) =>
  req(`/events/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(data) }, true);

export const removeEvent = (id) =>
  req(`/events/${encodeURIComponent(id)}`, { method: "DELETE" }, true);

// People / roles
export const getPeople = (role) =>
  req(`/admin/people${role ? `?role=${encodeURIComponent(role)}` : ""}`, {}, true);

export const addPerson = (data) =>
  req("/admin/people", { method: "POST", body: JSON.stringify(data) }, true);

export const removePerson = (email) =>
  req(`/admin/people/${encodeURIComponent(email)}`, { method: "DELETE" }, true);

/** Judges get `event_ids`, volunteers get `venue_id`. Send only the one that
 *  matches their role; the API rejects the mismatch and any time clash. */
export const setAssignments = (email, data) =>
  req(
    `/admin/people/${encodeURIComponent(email)}/assignments`,
    { method: "PUT", body: JSON.stringify(data) },
    true
  );

// ── Volunteer ────────────────────────────────────────────────
export const checkIn = (registrationId, checkedIn = true) =>
  req(
    "/volunteer/check-in",
    { method: "POST", body: JSON.stringify({ registration_id: registrationId, checked_in: checkedIn }) },
    true
  );

export async function downloadRegistrationsCsv(filters = {}) {
  const qs = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v)
  ).toString();
  const res = await fetch(`${BASE}/admin/registrations.csv${qs ? `?${qs}` : ""}`, {
    headers: await authHeader(),
  });
  if (!res.ok) throw new Error(`Export failed: ${res.status}`);

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `registrations-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
