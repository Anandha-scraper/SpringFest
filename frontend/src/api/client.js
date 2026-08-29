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

/** Proof of an out-of-band payment: transaction reference + screenshot.
 *
 * Multipart, so it sidesteps req()'s JSON body — and deliberately sets no
 * Content-Type, letting the browser add the boundary the server needs to
 * parse the parts. */
export async function submitPaymentProof(registrationId, { transactionId, file }) {
  const body = new FormData();
  body.append("transaction_id", transactionId);
  body.append("screenshot", file);

  const res = await fetch(`${BASE}/registrations/${encodeURIComponent(registrationId)}/proof`, {
    method: "POST",
    headers: await authHeader(),
    body,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Upload failed: ${res.status}`);
  }
  return res.json();
}

/** The URL a QR <img> points at. Authenticated, so it's fetched as a blob
 *  rather than being set as a plain src — see ticketObjectUrl below. */
export const qrTicketPath = (registrationId, memberIndex) =>
  `/me/registrations/${encodeURIComponent(registrationId)}/qr/${memberIndex}`;

/** An object URL for one QR ticket, for display. Callers must revoke it. */
export async function ticketObjectUrl(registrationId, memberIndex) {
  const res = await fetch(`${BASE}${qrTicketPath(registrationId, memberIndex)}`, {
    headers: await authHeader(),
  });
  if (!res.ok) throw new Error(`Could not load ticket: ${res.status}`);
  return URL.createObjectURL(await res.blob());
}

export const downloadTicket = (registrationId, memberIndex, name) =>
  downloadFile(
    qrTicketPath(registrationId, memberIndex),
    `ticket-${(name || `member-${memberIndex}`).replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`
  );

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

// Payment mode — gateway vs. collecting screenshots. Switchable mid-fest.
export const getAppSettings = () => req("/admin/settings", {}, true);

export const updateAppSettings = (data) =>
  req("/admin/settings", { method: "PUT", body: JSON.stringify(data) }, true);

// Screenshot payments waiting on an admin.
export const getApprovals = () => req("/admin/approvals", {}, true);

/** An object URL for a payment screenshot, for display. Callers must revoke
 *  it. Fetched rather than linked because the endpoint is authenticated. */
export async function proofObjectUrl(registrationId) {
  const res = await fetch(`${BASE}/admin/approvals/${encodeURIComponent(registrationId)}/proof`, {
    headers: await authHeader(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Could not load the screenshot: ${res.status}`);
  }
  return URL.createObjectURL(await res.blob());
}

export const reviewApproval = (registrationId, decision, note = "") =>
  req(
    `/admin/approvals/${encodeURIComponent(registrationId)}`,
    { method: "POST", body: JSON.stringify({ decision, note }) },
    true
  );

// ── Volunteer ────────────────────────────────────────────────
/** Check in one person from their scanned QR ticket. */
export const checkInByToken = (token) =>
  req("/volunteer/check-in/scan", { method: "POST", body: JSON.stringify({ token }) }, true);

export const checkIn = (registrationId, checkedIn = true) =>
  req(
    "/volunteer/check-in",
    { method: "POST", body: JSON.stringify({ registration_id: registrationId, checked_in: checkedIn }) },
    true
  );

/** Fetch an authenticated binary endpoint and save it to disk.
 *
 * Bypasses req() because the response isn't JSON — the auth header is still
 * needed, since neither the CSV export nor a QR ticket is public. */
async function downloadFile(path, filename) {
  const res = await fetch(`${BASE}${path}`, { headers: await authHeader() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Download failed: ${res.status}`);
  }

  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadRegistrationsCsv(filters = {}) {
  const qs = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v)
  ).toString();
  return downloadFile(
    `/admin/registrations.csv${qs ? `?${qs}` : ""}`,
    `registrations-${new Date().toISOString().slice(0, 10)}.csv`
  );
}
