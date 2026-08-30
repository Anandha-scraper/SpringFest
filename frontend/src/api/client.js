import { auth } from "@/auth/firebase.js";
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

/** Add one teammate to an already-confirmed team registration. Returns the
 * top-up payment details (screenshot amount, or a Razorpay order). */
export const addTeamMember = (registrationId, member) =>
  req(`/registrations/${encodeURIComponent(registrationId)}/members`, {
    method: "POST",
    body: JSON.stringify(member),
  }, true);

/** Payment details for resuming a teammate top-up the lead didn't finish. */
export const getTopupPayment = (registrationId) =>
  req(`/registrations/${encodeURIComponent(registrationId)}/topup`, {}, true);

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

/** One QR per signed-in person (not per registration). Authenticated, so
 *  it's fetched as a blob rather than being set as a plain <img src>. */
export async function personalQrObjectUrl() {
  const res = await fetch(`${BASE}/me/qr`, { headers: await authHeader() });
  if (!res.ok) throw new Error(`Could not load your QR: ${res.status}`);
  return URL.createObjectURL(await res.blob());
}

export const downloadPersonalQr = () => downloadFile("/me/qr", "spring-fest-qr.png");

/** Upload (or replace) the team's presentation file for a submission-enabled
 * event. Multipart like submitPaymentProof — no Content-Type, browser adds
 * the boundary. Field name must match the server's `.single("file")`. */
export async function submitEventFile(registrationId, file) {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch(
    `${BASE}/registrations/${encodeURIComponent(registrationId)}/submission`,
    { method: "POST", headers: await authHeader(), body }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Upload failed: ${res.status}`);
  }
  return res.json();
}

/** Authenticated blob URL for a team's uploaded submission file. */
export async function eventSubmissionObjectUrl(registrationId) {
  const res = await fetch(
    `${BASE}/me/registrations/${encodeURIComponent(registrationId)}/submission`,
    { headers: await authHeader() }
  );
  if (!res.ok) throw new Error(`Could not load the file: ${res.status}`);
  return URL.createObjectURL(await res.blob());
}

// ── Admin ────────────────────────────────────────────────────
export const getAdminStats = () => req("/admin/stats", {}, true);

/** Signed-in Firebase accounts split into staff vs participants (attendees). */
export const getAuthUsers = () => req("/admin/auth-users", {}, true);

/** One row per person, with their events rolled up. The Registrations screen. */
export const getParticipants = () => req("/admin/participants", {}, true);

/** Per venue: its event, headcount, check-ins and assigned staff. */
export const getVenueRollup = () => req("/admin/venues/rollup", {}, true);

/** Per-event attendance and evaluation progress — the Manage Roles view. */
export const getEventRollup = () => req("/admin/events/rollup", {}, true);

/** The raw event doc, including the judges-only marking criteria that the
 *  public /events routes deliberately never return. */
export const getAdminEvent = (eventId) =>
  req(`/admin/events/${encodeURIComponent(eventId)}`, {}, true);

export const getEventParticipants = (eventId) =>
  req(`/admin/events/${eventId}/participants`, {}, true);

/** The raw registration doc (members[] included) — for prefilling the edit form. */
export const getAdminRegistration = (registrationId) =>
  req(`/admin/registrations/${encodeURIComponent(registrationId)}`, {}, true);

/** Fix a typo in a registration's own details — see the route's own comment
 *  for exactly what can and can't be changed here. */
export const updateAdminRegistration = (registrationId, data) =>
  req(
    `/admin/registrations/${encodeURIComponent(registrationId)}`,
    { method: "PATCH", body: JSON.stringify(data) },
    true
  );

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

/** What's already on file for this email — an existing staff role, or
 *  existing event registrations — so the "Add a person" form can warn
 *  before silently overwriting or double-booking someone. */
export const checkPersonConflicts = (email) =>
  req(`/admin/people/${encodeURIComponent(email)}/lookup`, {}, true);

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

/** The QR participants scan to pay. Multipart, so it follows
 *  submitPaymentProof's no-Content-Type rule. */
export async function uploadPaymentQr(file) {
  const body = new FormData();
  body.append("qr", file);

  const res = await fetch(`${BASE}/admin/settings/payment-qr`, {
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

export const removePaymentQr = () =>
  req("/admin/settings/payment-qr", { method: "DELETE" }, true);

/** An object URL for the payment QR. Callers must revoke it. Served from the
 *  participant-facing /me route, which admins can read too — there's no
 *  admin-only copy of this image. */
export async function paymentQrObjectUrl() {
  const res = await fetch(`${BASE}/me/payment-qr`, { headers: await authHeader() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Could not load the payment QR: ${res.status}`);
  }
  return URL.createObjectURL(await res.blob());
}

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
/** Scan a person's badge: who they are, and every event they're registered
 *  for (as lead or as a team member), each with its own check-in state. */
export const scanPersonToken = (token) =>
  req("/volunteer/scan", { method: "POST", body: JSON.stringify({ token }) }, true);

/** Check one member of one registration in or out. A "no ticket, just their
 *  id" desk fallback is this same call with memberIndex 0 (the lead). */
export const toggleCheckIn = (registrationId, memberIndex, checkedIn) =>
  req(
    "/volunteer/check-in/toggle",
    {
      method: "POST",
      body: JSON.stringify({ registration_id: registrationId, member_index: memberIndex, checked_in: checkedIn }),
    },
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
