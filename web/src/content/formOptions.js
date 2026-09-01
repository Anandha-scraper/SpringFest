"use client";

// Registration-form dropdown options — keep in sync with backend/src/validate.js
// (DEPARTMENTS / TN_CITIES / STUDY_YEARS there).

export const DEPARTMENTS = ["CSE", "ECE", "IT", "MECH", "EEE", "Others"];

/** Event categories. Keep in sync with EVENT_CATEGORIES in
 * backend/src/validate.js — the server rejects anything else. The admin Events
 * page also groups its listings under these headings, in this order. */
export const EVENT_CATEGORIES = ["Technical", "Non-Technical", "Hackathon", "Workshop"];

// Tamil Nadu districts, plus "Other" for anyone from outside the state —
// picking it reveals a free-text field rather than blocking registration.
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

export const STUDY_YEARS = ["1", "2", "3", "4", "PG"];

/** "Year 2" for numeric years, bare "PG" for postgrads. */
export const yearLabel = (y) => (y === "PG" ? "PG" : `Year ${y}`);

/** Which event fields the admin form must disable, mirroring the two sets in
 *  backend/services/event.service.js — keep in sync with them.
 *
 *  ALWAYS_LOCKED_EVENT_FIELDS is immutable from the moment an event exists;
 *  LOCKED_EVENT_FIELDS freezes only once the event has registrations, because
 *  the allocation code SF<category><event><n> is derived from those two. The
 *  server enforces both; these exist so the form greys out the right inputs
 *  and never PATCHes a field that would 403. */
export const ALWAYS_LOCKED_EVENT_FIELDS = ["fee"];
export const LOCKED_EVENT_FIELDS = ["name", "category"];
